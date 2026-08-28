import {
  withSupabase,
} from 'npm:@supabase/server@^1';

import {
  getPaymentFeeQuote,
} from '../_shared/payment-fees.ts';

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
        const body =
          await req.json();

        const orderId =
          typeof body
            ?.orderId ===
          'string'
            ? body
                .orderId
                .trim()
            : '';

        if (!orderId) {
          return json(
            {
              success: false,

              message:
                'A project is required before payment can be prepared.',
            },
            400,
          );
        }

        const {
          data:
            order,
          error:
            orderError,
        } =
          await ctx
            .supabase
            .from(
              'orders',
            )
            .select(`
              id,
              reference,
              project_title,
              status,
              review_decision,
              payment_status,
              quoted_amount_kobo,
              paid_amount_kobo,
              currency
            `)
            .eq(
              'id',
              orderId,
            )
            .maybeSingle();

        if (
          orderError ||
          !order
        ) {
          return json(
            {
              success: false,

              message:
                'Project could not be found.',
            },
            404,
          );
        }

        if (
          order
            .review_decision !==
          'approved'
        ) {
          return json(
            {
              success: false,

              message:
                'This project must be approved before payment can begin.',
            },
            409,
          );
        }

        if (
          [
            'completed',
            'cancelled',
          ].includes(
            order.status,
          )
        ) {
          return json(
            {
              success: false,

              message:
                'This project is not currently open for payment.',
            },
            409,
          );
        }

        const quoted =
          Number(
            order
              .quoted_amount_kobo ||
              0,
          );

        const paid =
          Number(
            order
              .paid_amount_kobo ||
              0,
          );

        const fullOutstanding =
          Math.max(
            quoted -
              paid,
            0,
          );

        if (
          fullOutstanding <=
          0
        ) {
          return json(
            {
              success: false,

              message:
                'There is no outstanding balance for this project.',
            },
            409,
          );
        }

        const now =
          new Date();

        const {
          data:
            approvedRequests,
          error:
            partPaymentError,
        } =
          await ctx
            .supabase
            .from(
              'part_payment_requests',
            )
            .select(`
              id,
              approved_amount_kobo,
              approval_expires_at
            `)
            .eq(
              'order_id',
              order.id,
            )
            .eq(
              'status',
              'approved',
            )
            .order(
              'reviewed_at',
              {
                ascending:
                  false,
              },
            )
            .limit(1);

        if (partPaymentError) {
          throw partPaymentError;
        }

        const approvedRequest =
          approvedRequests?.[0] ||
          null;

        const approvalIsCurrent =
          approvedRequest &&
          Number(
            approvedRequest
              .approved_amount_kobo ||
              0,
          ) > 0 &&
          (
            !approvedRequest
              .approval_expires_at ||
            new Date(
              approvedRequest
                .approval_expires_at,
            ) > now
          );

        const outstanding =
          approvalIsCurrent
            ? Math.min(
                Number(
                  approvedRequest
                    .approved_amount_kobo,
                ),
                fullOutstanding,
              )
            : fullOutstanding;

        const paymentScope =
          approvalIsCurrent
            ? 'approved_installment'
            : 'full_balance';

        const currency =
          (
            order.currency ||
            'NGN'
          )
            .trim()
            .toUpperCase();

        const {
          data:
            methodRows,
          error:
            methodsError,
        } =
          await ctx
            .supabaseAdmin
            .from(
              'payment_method_settings',
            )
            .select(`
              method_key,
              display_name,
              description,
              enabled,
              currency,
              sort_order
            `)
            .eq(
              'enabled',
              true,
            )
            .eq(
              'currency',
              currency,
            )
            .order(
              'sort_order',
              {
                ascending:
                  true,
              },
            );

        if (
          methodsError
        ) {
          throw methodsError;
        }

        const methods:
          Record<
            string,
            unknown
          >[] = [];

        for (
          const setting of
          methodRows ||
          []
        ) {
          try {
            const fee =
              await getPaymentFeeQuote({
                method:
                  setting
                    .method_key,

                amountKobo:
                  outstanding,

                currency,
              });

            methods.push({
              key:
                setting
                  .method_key,

              name:
                setting
                  .display_name,

              description:
                setting
                  .description,

              /*
               * Payment-method availability and
               * fee quotation are deliberately
               * separate concerns.
               */
              available:
                true,

              feeAvailable:
                true,

              baseAmountKobo:
                outstanding,

              processingFeeKobo:
                fee.feeKobo,

              customerTotalKobo:
                fee.totalKobo,

              feeBreakdown:
                fee.breakdown,

              currency,
            });
          } catch (
            feeError
          ) {
            console.error(
              'Payment fee quotation failed:',
              {
                method:
                  setting
                    .method_key,

                error:
                  feeError instanceof
                  Error
                    ? feeError
                        .message
                    : feeError,
              },
            );

            /*
             * IMPORTANT:
             *
             * A temporary fee-quote problem must
             * NEVER disable a payment method that
             * Management has enabled.
             *
             * For bank transfer, Flutterwave will
             * return the exact transfer amount when
             * the virtual account is created.
             */
            methods.push({
              key:
                setting
                  .method_key,

              name:
                setting
                  .display_name,

              description:
                setting
                  .description,

              available:
                true,

              feeAvailable:
                false,

              baseAmountKobo:
                outstanding,

              processingFeeKobo:
                null,

              customerTotalKobo:
                null,

              feeBreakdown:
                [],

              currency,

              message:
                'The exact processing fee will be confirmed before you make the payment.',
            });
          }
        }

        return json({
          success: true,

          checkout: {
            orderId:
              order.id,

            reference:
              order.reference,

            projectTitle:
              order
                .project_title,

            baseAmountKobo:
              outstanding,

            fullOutstandingKobo:
              fullOutstanding,

            paymentScope,

            partPaymentRequestId:
              approvalIsCurrent
                ? approvedRequest.id
                : null,

            currency,

            methods,
          },
        });
      } catch (
        error
      ) {
        console.error(
          'payment-fee-quote:',
          error,
        );

        return json(
          {
            success: false,

            message:
              'Payment details could not be prepared. Please try again shortly.',
          },
          500,
        );
      }
    },
  ),
};
