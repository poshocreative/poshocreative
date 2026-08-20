import {
  withSupabase,
} from 'npm:@supabase/server@^1';

import {
  flutterwaveRequest,
} from '../_shared/flutterwave.ts';

import {
  reconcilePayment,
} from '../_shared/reconcile-payment.ts';

function json(
  body:
    Record<
      string,
      unknown
    >,
  status = 200,
) {
  return Response.json(
    body,
    {
      status,
    },
  );
}

async function diagnostic(
  admin: any,
  paymentId: string,
  eventType: string,
  message: string,
) {
  await admin
    .from(
      'payment_attempt_diagnostics',
    )
    .insert({
      payment_id:
        paymentId,

      event_type:
        eventType,

      stage:
        'admin_recheck',

      internal_message:
        message,
    });
}

export default {
  fetch: withSupabase(
    {
      auth: 'user',
    },

    async (
      req,
      ctx,
    ) => {
      if (
        req.method !==
        'POST'
      ) {
        return json(
          {
            success: false,

            message:
              'Method not allowed.',
          },
          405,
        );
      }

      try {
        const {
          data:
            allowed,
          error:
            accessError,
        } =
          await ctx
            .supabase
            .rpc(
              'has_admin_access',
            );

        if (
          accessError ||
          allowed !==
            true
        ) {
          return json(
            {
              success: false,

              message:
                'Administrative access is required.',
            },
            403,
          );
        }

        const body =
          await req.json();

        const paymentId =
          typeof body
            ?.paymentId ===
          'string'
            ? body.paymentId
                .trim()
            : '';

        if (!paymentId) {
          return json(
            {
              success: false,

              message:
                'Payment attempt is required.',
            },
            400,
          );
        }

        const {
          data:
            payment,
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
              provider_customer_id,
              payment_method,
              amount_kobo,
              currency,
              status
            `)
            .eq(
              'id',
              paymentId,
            )
            .maybeSingle();

        if (
          paymentError ||
          !payment
        ) {
          return json(
            {
              success: false,

              message:
                'Payment attempt could not be found.',
            },
            404,
          );
        }

        if (
          payment.status ===
          'successful'
        ) {
          return json({
            success: true,

            status:
              'successful',

            message:
              'This payment is already confirmed.',
          });
        }

        await diagnostic(
          ctx.supabaseAdmin,
          payment.id,
          'admin_recheck_requested',
          'Management requested an independent provider status check.',
        );

        await ctx
          .supabaseAdmin
          .from(
            'payment_transactions',
          )
          .update({
            last_checked_at:
              new Date()
                .toISOString(),

            attempt_stage:
              'verifying',
          })
          .eq(
            'id',
            payment.id,
          );

        let charge =
          null;

        if (
          payment
            .provider_transaction_id
            ?.startsWith(
              'chg_',
            )
        ) {
          const result =
            await flutterwaveRequest(
              `/charges/${encodeURIComponent(
                payment
                  .provider_transaction_id,
              )}`,
            );

          charge =
            result?.data ||
            null;
        } else if (
          payment
            .virtual_account_id
        ) {
          const result =
            await flutterwaveRequest(
              `/charges?virtual_account_id=${encodeURIComponent(
                payment
                  .virtual_account_id,
              )}`,
            );

          const charges =
            Array.isArray(
              result?.data,
            )
              ? result.data
              : [];

          charge =
            charges.find(
              (
                item:
                  any,
              ) =>
                item.reference ===
                payment
                  .provider_reference,
            ) ||
            charges[0] ||
            null;
        }

        if (!charge) {
          await ctx
            .supabaseAdmin
            .from(
              'payment_transactions',
            )
            .update({
              status:
                'pending',

              attempt_stage:
                'awaiting_confirmation',

              customer_message:
                'This payment is still awaiting confirmation from the payment provider.',
            })
            .eq(
              'id',
              payment.id,
            );

          await diagnostic(
            ctx.supabaseAdmin,
            payment.id,
            'admin_recheck_no_charge',
            'Management recheck did not return a matching provider charge.',
          );

          return json({
            success: true,

            status:
              'pending',

            message:
              'No completed Flutterwave charge has been found yet.',
          });
        }

        const result =
          await reconcilePayment(
            ctx.supabaseAdmin,
            payment,
            charge,
          );

        await diagnostic(
          ctx.supabaseAdmin,
          payment.id,
          'admin_recheck_completed',
          `Management recheck completed with status ${result.status}.`,
        );

        return json({
          success: true,

          ...result,
        });
      } catch (
        error
      ) {
        console.error(
          'admin-payment-action:',
          error,
        );

        return json(
          {
            success: false,

            message:
              error instanceof Error
                ? error.message
                : 'Payment status could not be checked.',
          },
          500,
        );
      }
    },
  ),
};