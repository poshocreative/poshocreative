import {
  withSupabase,
} from 'npm:@supabase/server@^1';

import {
  flutterwaveRequest,
} from '../_shared/flutterwave.ts';

import {
  reconcilePayment,
} from '../_shared/reconcile-payment.ts';

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
        return Response.json(
          {
            success: false,
            message:
              'Method not allowed.',
          },
          {
            status: 405,
          },
        );
      }

      try {
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
          return Response.json(
            {
              success: false,
              message:
                'Payment ID is required.',
            },
            {
              status: 400,
            },
          );
        }

        const {
          data: payment,
          error:
            paymentError,
        } =
          await ctx
            .supabase
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
              'id',
              paymentId,
            )
            .maybeSingle();

        if (
          paymentError ||
          !payment
        ) {
          return Response.json(
            {
              success: false,
              message:
                'Payment could not be found.',
            },
            {
              status: 404,
            },
          );
        }

        if (
          payment.status ===
          'successful'
        ) {
          return Response.json({
            success: true,
            status:
              'successful',
          });
        }

        let charge = null;

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
            result?.data;
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
              (item: any) =>
                item.reference ===
                payment
                  .provider_reference,
            ) ||
            charges[0] ||
            null;
        }

        if (!charge) {
          return Response.json({
            success: false,
            status:
              'pending',

            message:
              'Flutterwave has not confirmed this payment yet.',
          });
        }

        const result =
          await reconcilePayment(
            ctx.supabaseAdmin,
            payment,
            charge,
          );

        return Response.json(
          result,
        );
      } catch (error) {
        console.error(
          'verify-payment:',
          error,
        );

        return Response.json(
          {
            success: false,

            message:
              error instanceof Error
                ? error.message
                : 'Payment verification failed.',
          },
          {
            status: 500,
          },
        );
      }
    },
  ),
};