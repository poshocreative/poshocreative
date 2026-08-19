import {
  withSupabase,
} from 'npm:@supabase/server@^1';

import {
  flutterwaveRequest,
} from '../_shared/flutterwave.ts';

import {
  reconcilePayment,
} from '../_shared/reconcile-payment.ts';

function safeEqual(
  first: string,
  second: string,
) {
  if (
    first.length !==
    second.length
  ) {
    return false;
  }

  let difference = 0;

  for (
    let index = 0;
    index <
    first.length;
    index += 1
  ) {
    difference |=
      first.charCodeAt(
        index,
      ) ^
      second.charCodeAt(
        index,
      );
  }

  return difference === 0;
}

async function createSignature(
  body: string,
  secret: string,
) {
  const key =
    await crypto.subtle
      .importKey(
        'raw',
        new TextEncoder()
          .encode(secret),

        {
          name:
            'HMAC',

          hash:
            'SHA-256',
        },

        false,

        [
          'sign',
        ],
      );

  const signature =
    await crypto.subtle
      .sign(
        'HMAC',
        key,
        new TextEncoder()
          .encode(body),
      );

  return btoa(
    String.fromCharCode(
      ...new Uint8Array(
        signature,
      ),
    ),
  );
}

export default {
  fetch: withSupabase(
    {
      auth: 'none',
    },

    async (
      req,
      ctx,
    ) => {
      if (
        req.method !==
        'POST'
      ) {
        return new Response(
          'Method not allowed',
          {
            status: 405,
          },
        );
      }

      try {
        const rawBody =
          await req.text();

        const signature =
          req.headers.get(
            'flutterwave-signature',
          ) || '';

        const secret =
          (
            Deno.env.get(
              'FLUTTERWAVE_WEBHOOK_SECRET',
            ) || ''
          ).trim();

        if (!secret) {
          console.error(
            'FLUTTERWAVE_WEBHOOK_SECRET is missing.',
          );

          return new Response(
            'Webhook configuration missing',
            {
              status: 500,
            },
          );
        }

        const expected =
          await createSignature(
            rawBody,
            secret,
          );

        if (
          !signature ||
          !safeEqual(
            signature,
            expected,
          )
        ) {
          return new Response(
            'Invalid signature',
            {
              status: 401,
            },
          );
        }

        const payload =
          JSON.parse(
            rawBody,
          );

        if (
          payload?.type !==
          'charge.completed'
        ) {
          return new Response(
            'OK',
            {
              status: 200,
            },
          );
        }

        const chargeId =
          payload?.data?.id;

        const reference =
          payload?.data
            ?.reference;

        if (
          !chargeId ||
          !reference
        ) {
          return new Response(
            'OK',
            {
              status: 200,
            },
          );
        }

        const {
          data: payment,
          error:
            paymentError,
        } =
          await ctx
            .supabaseAdmin
            .from(
              'payment_transactions',
            )
            .select(`
              id,
              order_id,
              provider_reference,
              provider_transaction_id,
              virtual_account_id,
              amount_kobo,
              currency,
              status
            `)
            .eq(
              'provider_reference',
              reference,
            )
            .maybeSingle();

        if (
          paymentError
        ) {
          throw paymentError;
        }

        if (!payment) {
          console.warn(
            'Webhook reference not found:',
            reference,
          );

          return new Response(
            'OK',
            {
              status: 200,
            },
          );
        }

        const verified =
          await flutterwaveRequest(
            `/charges/${encodeURIComponent(
              chargeId,
            )}`,
          );

        await reconcilePayment(
          ctx.supabaseAdmin,
          payment,
          verified?.data,
        );

        return new Response(
          'OK',
          {
            status: 200,
          },
        );
      } catch (error) {
        console.error(
          'flutterwave-webhook:',
          error,
        );

        return new Response(
          'Webhook processing failed',
          {
            status: 500,
          },
        );
      }
    },
  ),
};