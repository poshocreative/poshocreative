import {
  withSupabase,
} from 'npm:@supabase/server@^1';

import {
  flutterwaveRequest,
} from '../_shared/flutterwave.ts';

import {
  reconcilePayment,
  syncSuccessfulPaymentOrder,
} from '../_shared/reconcile-payment.ts';

async function diagnostic(
  admin: any,
  paymentId: string,
  eventType: string,
  internalMessage: string,
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
        'verifying',

      internal_message:
        internalMessage,
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
                'Payment reference is required.',
            },
            {
              status: 400,
            },
          );
        }

        const {
          data:
            payment,
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
              provider_customer_id,
              payment_method,
              amount_kobo,
              customer_bears_fee,
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
                'Payment attempt could not be found.',
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
          const projectState =
            await syncSuccessfulPaymentOrder(
              ctx.supabaseAdmin,
              payment.order_id,
            );

          return Response.json({
            success: true,

            status:
              'successful',

            projectFullyPaid:
              projectState
                .fullyPaid,

            orderReference:
              projectState
                .order
                .reference,

            totalPaid:
              projectState
                .totalPaid,

            remainingBalanceKobo:
              projectState
                .remainingBalanceKobo,

            message:
              projectState
                .fullyPaid
                ? 'Flutterwave confirmed the payment. This project is fully paid.'
                : 'Flutterwave confirmed this payment. The remaining project balance is still outstanding.',
          });
        }

        const now =
          new Date()
            .toISOString();

        await ctx
          .supabaseAdmin
          .from(
            'payment_transactions',
          )
          .update({
            attempt_stage:
              'verifying',

            last_checked_at:
              now,
          })
          .eq(
            'id',
            payment.id,
          );

        await diagnostic(
          ctx.supabaseAdmin,
          payment.id,
          'verification_requested',
          'Customer requested a payment verification check.',
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
                'Your payment has not been confirmed yet. Please allow a little more time and check again.',

              last_checked_at:
                now,
            })
            .eq(
              'id',
              payment.id,
            );

          await diagnostic(
            ctx.supabaseAdmin,
            payment.id,
            'provider_charge_not_found',
            'No matching Flutterwave charge was returned during verification.',
          );

          return Response.json({
            success: false,

            status:
              'pending',

            message:
              'Your payment has not been confirmed yet. Please allow a little more time and check again.',
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
      } catch (
        error
      ) {
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
                : 'Payment verification could not be completed.',
          },
          {
            status: 500,
          },
        );
      }
    },
  ),
};
