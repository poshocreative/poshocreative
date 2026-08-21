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
            ? body.orderId
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
          data: order,
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

        const outstanding =
          Math.max(
            quoted -
              paid,
            0,
          );

        if (
          outstanding <=
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

        const currency =
          (
            order.currency ||
            'NGN'
          ).toUpperCase();

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

        const methods =
          [];

        for (
          const setting of
          methodRows || []
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

              currency,
            });
          } catch (
            feeError
          ) {
            console.error(
              'Fee quotation failed:',
              {
                method:
                  setting
                    .method_key,

                error:
                  feeError,
              },
            );

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
                false,

              feeAvailable:
                false,

              baseAmountKobo:
                outstanding,

              processingFeeKobo:
                null,

              customerTotalKobo:
                null,

              currency,

              message:
                'This payment option is temporarily unavailable.',
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
              'Payment pricing could not be prepared. Please try again shortly.',
          },
          500,
        );
      }
    },
  ),
};