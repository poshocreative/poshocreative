import {
  withSupabase,
} from 'npm:@supabase/server@^1';

import {
  flutterwaveRequest,
} from '../_shared/flutterwave.ts';

function generatePaymentReference() {
  return `PCPAY-${crypto
    .randomUUID()
    .replaceAll('-', '')
    .slice(0, 20)
    .toUpperCase()}`;
}

function nameParts(
  fullName: string,
) {
  const parts =
    fullName
      .trim()
      .split(/\s+/)
      .filter(Boolean);

  return {
    first:
      parts[0] ||
      'Customer',

    last:
      parts.length > 1
        ? parts[
            parts.length -
              1
          ]
        : 'Customer',
  };
}

async function ensureFlutterwaveCustomer(
  admin: any,
  customer: any,
) {
  if (
    customer
      .flutterwave_customer_id
  ) {
    return customer
      .flutterwave_customer_id;
  }

  const search =
    await flutterwaveRequest(
      '/customers/search?page=1&size=10',
      {
        method:
          'POST',

        headers: {
          'X-Idempotency-Key':
            crypto.randomUUID(),
        },

        body:
          JSON.stringify({
            email:
              customer.email,
          }),
      },
    );

  const searchRows =
    Array.isArray(
      search?.data,
    )
      ? search.data
      : Array.isArray(
            search?.data
              ?.customers,
          )
        ? search.data
            .customers
        : [];

  let flutterwaveCustomer =
    searchRows[0];

  if (
    !flutterwaveCustomer
  ) {
    const names =
      nameParts(
        customer.full_name,
      );

    const created =
      await flutterwaveRequest(
        '/customers',
        {
          method:
            'POST',

          headers: {
            'X-Idempotency-Key':
              crypto.randomUUID(),
          },

          body:
            JSON.stringify({
              email:
                customer.email,

              name: {
                first:
                  names.first,

                last:
                  names.last,
              },

              meta: {
                posho_customer_id:
                  customer.id,
              },
            }),
        },
      );

    flutterwaveCustomer =
      created?.data;
  }

  if (
    !flutterwaveCustomer?.id
  ) {
    throw new Error(
      'Flutterwave customer profile could not be created.',
    );
  }

  await admin
    .from(
      'customers',
    )
    .update({
      flutterwave_customer_id:
        flutterwaveCustomer.id,
    })
    .eq(
      'id',
      customer.id,
    );

  return flutterwaveCustomer.id;
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
        const userId =
          ctx.userClaims?.id;

        if (!userId) {
          return Response.json(
            {
              success: false,
              message:
                'Authentication required.',
            },
            {
              status: 401,
            },
          );
        }

        const body =
          await req.json();

        const orderId =
          typeof body
            ?.orderId ===
          'string'
            ? body.orderId
                .trim()
            : '';

        const method =
          typeof body
            ?.method ===
          'string'
            ? body.method
                .trim()
                .toLowerCase()
            : '';

        if (
          !orderId ||
          ![
            'bank_transfer',
            'opay',
          ].includes(
            method,
          )
        ) {
          return Response.json(
            {
              success: false,
              message:
                'Choose a supported payment method.',
            },
            {
              status: 400,
            },
          );
        }

        const {
          data: order,
          error: orderError,
        } =
          await ctx
            .supabase
            .from(
              'orders',
            )
            .select(`
              id,
              reference,
              customer_id,
              project_title,
              status,
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
          return Response.json(
            {
              success: false,
              message:
                'Project could not be found.',
            },
            {
              status: 404,
            },
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
          return Response.json(
            {
              success: false,
              message:
                'This project is not open for payment.',
            },
            {
              status: 409,
            },
          );
        }

        const quotedAmount =
          Number(
            order
              .quoted_amount_kobo ||
              0,
          );

        const paidAmount =
          Number(
            order
              .paid_amount_kobo ||
              0,
          );

        const outstanding =
          quotedAmount -
          paidAmount;

        if (
          quotedAmount <= 0 ||
          outstanding <= 0
        ) {
          return Response.json(
            {
              success: false,
              message:
                outstanding <= 0
                  ? 'This project has already been paid.'
                  : 'A payable quote has not been issued for this project yet.',
            },
            {
              status: 409,
            },
          );
        }

        const {
          data: customer,
          error:
            customerError,
        } =
          await ctx
            .supabase
            .from(
              'customers',
            )
            .select(`
              id,
              full_name,
              email,
              flutterwave_customer_id
            `)
            .eq(
              'id',
              order.customer_id,
            )
            .maybeSingle();

        if (
          customerError ||
          !customer
        ) {
          throw (
            customerError ||
            new Error(
              'Customer profile could not be loaded.',
            )
          );
        }

        const providerReference =
          generatePaymentReference();

        const idempotencyKey =
          crypto.randomUUID();

        const {
          data:
            paymentRecord,
          error:
            paymentError,
        } =
          await ctx
            .supabaseAdmin
            .from(
              'payment_transactions',
            )
            .insert({
              order_id:
                order.id,

              provider:
                'flutterwave',

              provider_reference:
                providerReference,

              amount_kobo:
                outstanding,

              currency:
                order.currency ||
                'NGN',

              status:
                'processing',

              initiated_by:
                userId,

              payment_method:
                method,

              idempotency_key:
                idempotencyKey,

              payment_metadata: {
                order_reference:
                  order.reference,
              },
            })
            .select()
            .single();

        if (
          paymentError ||
          !paymentRecord
        ) {
          throw (
            paymentError ||
            new Error(
              'Payment session could not be created.',
            )
          );
        }

        const amount =
          Number(
            (
              outstanding /
              100
            ).toFixed(2),
          );

        try {
          if (
            method ===
            'bank_transfer'
          ) {
            const flutterwaveCustomerId =
              await ensureFlutterwaveCustomer(
                ctx.supabaseAdmin,
                customer,
              );

            const account =
              await flutterwaveRequest(
                '/virtual-accounts',
                {
                  method:
                    'POST',

                  headers: {
                    'X-Idempotency-Key':
                      idempotencyKey,
                  },

                  body:
                    JSON.stringify({
                      reference:
                        providerReference,

                      customer_id:
                        flutterwaveCustomerId,

                      amount,

                      expiry:
                        3600,

                      currency:
                        order.currency ||
                        'NGN',

                      account_type:
                        'dynamic',

                      narration:
                        `Posho Creative ${order.reference}`.slice(
                          0,
                          60,
                        ),

                      meta: {
                        posho_order_id:
                          order.id,

                        posho_payment_id:
                          paymentRecord.id,
                      },
                    }),
                },
              );

            const details =
              account?.data;

            if (
              !details?.id ||
              !details
                ?.account_number
            ) {
              throw new Error(
                'Flutterwave did not return bank transfer details.',
              );
            }

            await ctx
              .supabaseAdmin
              .from(
                'payment_transactions',
              )
              .update({
                status:
                  'pending',

                provider_transaction_id:
                  details.id,

                virtual_account_id:
                  details.id,

                expires_at:
                  details
                    .account_expiration_datetime ||
                  null,

                provider_payload:
                  account,

                payment_metadata: {
                  order_reference:
                    order.reference,

                  virtual_account: {
                    id:
                      details.id,

                    account_number:
                      details.account_number,

                    bank_name:
                      details
                        .account_bank_name,

                    note:
                      details.note,

                    expiration:
                      details
                        .account_expiration_datetime,

                    amount:
                      details.amount,
                  },
                },
              })
              .eq(
                'id',
                paymentRecord.id,
              );

            return Response.json({
              success: true,

              payment: {
                id:
                  paymentRecord.id,

                method:
                  'bank_transfer',

                reference:
                  providerReference,

                amountKobo:
                  outstanding,

                currency:
                  order.currency ||
                  'NGN',

                account: {
                  accountNumber:
                    details
                      .account_number,

                  bankName:
                    details
                      .account_bank_name,

                  note:
                    details.note,

                  expiresAt:
                    details
                      .account_expiration_datetime,
                },
              },
            });
          }

          const names =
            nameParts(
              customer.full_name,
            );

          const siteUrl =
            (
              Deno.env.get(
                'SITE_URL',
              ) ||
              'https://poshocreative.com.ng'
            ).replace(
              /\/+$/,
              '',
            );

          const charge =
            await flutterwaveRequest(
              '/orchestration/direct-charges',
              {
                method:
                  'POST',

                headers: {
                  'X-Idempotency-Key':
                    idempotencyKey,
                },

                body:
                  JSON.stringify({
                    amount,

                    currency:
                      order.currency ||
                      'NGN',

                    reference:
                      providerReference,

                    payment_method: {
                      type:
                        'opay',
                    },

                    redirect_url:
                      `${siteUrl}/payment-return?payment=${paymentRecord.id}`,

                    customer: {
                      email:
                        customer.email,

                      name: {
                        first:
                          names.first,

                        last:
                          names.last,
                      },

                      meta: {
                        posho_customer_id:
                          customer.id,
                      },
                    },

                    meta: {
                      posho_order_id:
                        order.id,

                      posho_payment_id:
                        paymentRecord.id,
                    },
                  }),
              },
            );

          const chargeData =
            charge?.data;

          const redirectUrl =
            chargeData
              ?.next_action
              ?.redirect_url
              ?.url;

          if (
            !chargeData?.id ||
            !redirectUrl
          ) {
            throw new Error(
              'Flutterwave did not return an OPay authorization link.',
            );
          }

          await ctx
            .supabaseAdmin
            .from(
              'payment_transactions',
            )
            .update({
              status:
                'pending',

              provider_transaction_id:
                chargeData.id,

              checkout_url:
                redirectUrl,

              provider_payload:
                charge,

              payment_metadata: {
                order_reference:
                  order.reference,

                next_action:
                  chargeData
                    .next_action,
              },
            })
            .eq(
              'id',
              paymentRecord.id,
            );

          return Response.json({
            success: true,

            payment: {
              id:
                paymentRecord.id,

              method:
                'opay',

              reference:
                providerReference,

              amountKobo:
                outstanding,

              currency:
                order.currency ||
                'NGN',

              redirectUrl,
            },
          });
        } catch (
          providerError
        ) {
          await ctx
            .supabaseAdmin
            .from(
              'payment_transactions',
            )
            .update({
              status:
                'failed',

              provider_payload: {
                error:
                  providerError instanceof Error
                    ? providerError.message
                    : 'Flutterwave payment initialization failed.',
              },
            })
            .eq(
              'id',
              paymentRecord.id,
            );

          throw providerError;
        }
      } catch (error) {
        console.error(
          'create-payment-session:',
          error,
        );

        return Response.json(
          {
            success: false,

            message:
              error instanceof Error
                ? error.message
                : 'Payment could not be started.',
          },
          {
            status: 500,
          },
        );
      }
    },
  ),
};

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/create-payment-session' \
    --header 'apiKey: sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH' \
    --data '{"name":"Functions"}'

*/
