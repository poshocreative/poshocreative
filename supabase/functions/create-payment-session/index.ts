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
    (
      fullName ||
      ''
    )
      .trim()
      .split(/\s+/)
      .filter(Boolean);

  return {
    first:
      parts[0] ||
      'Customer',

    last:
      parts.length >
      1
        ? parts[
            parts.length -
              1
          ]
        : 'Customer',
  };
}

function nigeriaPhone(
  value: string,
) {
  let digits =
    (
      value ||
      ''
    ).replace(
      /\D/g,
      '',
    );

  if (
    digits.startsWith(
      '234',
    )
  ) {
    digits =
      digits.slice(3);
  }

  if (
    digits.startsWith(
      '0',
    )
  ) {
    digits =
      digits.slice(1);
  }

  if (
    digits.length !==
    10
  ) {
    return null;
  }

  return {
    country_code:
      '234',

    number:
      digits,
  };
}

function processorCode(
  data: any,
) {
  return (
    data
      ?.processor_response
      ?.code ||
    data
      ?.issuer_response
      ?.code ||
    null
  );
}

function safeChargeSummary(
  data: any,
) {
  if (!data) {
    return {};
  }

  return {
    id:
      data.id ||
      null,

    reference:
      data.reference ||
      null,

    amount:
      data.amount ??
      null,

    currency:
      data.currency ||
      null,

    status:
      data.status ||
      null,

    next_action_type:
      data
        ?.next_action
        ?.type ||
      null,

    payment_method_type:
      data
        ?.payment_method_details
        ?.type ||
      null,

    processor_code:
      processorCode(
        data,
      ),
  };
}

async function diagnostic(
  admin: any,
  {
    paymentId,
    eventType,
    stage,
    providerStatus = null,
    providerCode = null,
    internalMessage = null,
    payload = {},
  }: {
    paymentId: string;
    eventType: string;
    stage: string;
    providerStatus?: string | null;
    providerCode?: string | null;
    internalMessage?: string | null;
    payload?: Record<
      string,
      unknown
    >;
  },
) {
  const {
    error,
  } =
    await admin
      .from(
        'payment_attempt_diagnostics',
      )
      .insert({
        payment_id:
          paymentId,

        event_type:
          eventType,

        stage,

        provider_status:
          providerStatus,

        provider_code:
          providerCode,

        internal_message:
          internalMessage,

        payload,
      });

  if (error) {
    console.error(
      'Payment diagnostic write failed:',
      error,
    );
  }
}

async function ensureFlutterwaveCustomer(
  admin: any,
  customer: any,
) {
  /*
   * Search the currently authenticated
   * Flutterwave account first.
   *
   * This is safer than blindly trusting a
   * previously stored provider customer ID,
   * especially after API credential rotation.
   */
  const search =
    await flutterwaveRequest(
      '/customers/search?page=1&size=10',
      {
        method:
          'POST',

        body:
          JSON.stringify({
            email:
              customer.email,
          }),
      },
    );

  const rows =
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

  let providerCustomer =
    rows[0] ||
    null;

  if (
    !providerCustomer
  ) {
    const names =
      nameParts(
        customer.full_name,
      );

    const phone =
      nigeriaPhone(
        customer.phone,
      );

    const customerBody:
      Record<
        string,
        unknown
      > = {
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
      };

    if (phone) {
      customerBody.phone =
        phone;
    }

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
            JSON.stringify(
              customerBody,
            ),
        },
      );

    providerCustomer =
      created?.data ||
      null;
  }

  if (
    !providerCustomer?.id
  ) {
    throw new Error(
      'Payment customer profile could not be prepared.',
    );
  }

  await admin
    .from(
      'customers',
    )
    .update({
      flutterwave_customer_id:
        providerCustomer.id,
    })
    .eq(
      'id',
      customer.id,
    );

  return providerCustomer.id;
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

      let paymentRecord:
        any = null;

      let requestedMethod =
        '';

      try {
        const userId =
          ctx.userClaims?.id;

        if (!userId) {
          return Response.json(
            {
              success: false,

              message:
                'Authentication is required.',
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

        requestedMethod =
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
            requestedMethod,
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
              customer_id,
              project_title,
              status,
              payment_status,
              review_decision,
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
          order
            .review_decision !==
          'approved'
        ) {
          return Response.json(
            {
              success: false,

              message:
                'This project must be approved before payment can begin.',
            },
            {
              status: 409,
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

        const currency =
          (
            order.currency ||
            'NGN'
          ).toUpperCase();

        if (
          requestedMethod ===
            'opay' &&
          currency !==
            'NGN'
        ) {
          return Response.json(
            {
              success: false,

              message:
                'OPay is currently available for Naira payments only.',
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
          quotedAmount <=
            0 ||
          outstanding <=
            0
        ) {
          return Response.json(
            {
              success: false,

              message:
                outstanding <=
                0
                  ? 'This project has already been paid.'
                  : 'A payable quotation has not been issued for this project yet.',
            },
            {
              status: 409,
            },
          );
        }

        const {
          data:
            customer,
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
              phone,
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
            createdPayment,
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

              currency,

              status:
                'processing',

              initiated_by:
                userId,

              payment_method:
                requestedMethod,

              idempotency_key:
                idempotencyKey,

              attempt_stage:
                'initializing',

              customer_message:
                'Preparing your secure payment.',

              payment_metadata: {
                order_reference:
                  order.reference,
              },

              provider_payload:
                {},
            })
            .select()
            .single();

        if (
          paymentError ||
          !createdPayment
        ) {
          throw (
            paymentError ||
            new Error(
              'Payment attempt could not be created.',
            )
          );
        }

        paymentRecord =
          createdPayment;

        await diagnostic(
          ctx.supabaseAdmin,
          {
            paymentId:
              paymentRecord.id,

            eventType:
              'attempt_created',

            stage:
              'initializing',

            internalMessage:
              `Payment attempt created for ${order.reference}.`,
          },
        );

        const providerCustomerId =
          await ensureFlutterwaveCustomer(
            ctx.supabaseAdmin,
            customer,
          );

        await ctx
          .supabaseAdmin
          .from(
            'payment_transactions',
          )
          .update({
            provider_customer_id:
              providerCustomerId,

            attempt_stage:
              'customer_ready',
          })
          .eq(
            'id',
            paymentRecord.id,
          );

        await diagnostic(
          ctx.supabaseAdmin,
          {
            paymentId:
              paymentRecord.id,

            eventType:
              'customer_ready',

            stage:
              'customer_ready',

            internalMessage:
              'Flutterwave customer profile prepared.',
          },
        );

        const amount =
          Number(
            (
              outstanding /
              100
            ).toFixed(2),
          );

        /*
         * =====================================================
         * BANK TRANSFER
         * =====================================================
         */

        if (
          requestedMethod ===
          'bank_transfer'
        ) {
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
                      providerCustomerId,

                    amount,

                    expiry:
                      3600,

                    currency,

                    account_type:
                      'dynamic',

                    narration:
                      `Posho Creative ${order.reference}`
                        .slice(
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
              'Bank transfer details were not returned.',
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

              provider_status:
                'pending',

              provider_transaction_id:
                details.id,

              virtual_account_id:
                details.id,

              expires_at:
                details
                  .account_expiration_datetime ||
                null,

              attempt_stage:
                'awaiting_transfer',

              customer_message:
                'Transfer the exact amount to the account shown. Confirmation may take a few moments.',

              provider_payload: {
                id:
                  details.id,

                type:
                  'virtual_account',

                amount:
                  details.amount,

                currency,

                account_bank_name:
                  details
                    .account_bank_name,

                account_expiration_datetime:
                  details
                    .account_expiration_datetime,
              },

              payment_metadata: {
                order_reference:
                  order.reference,

                virtual_account: {
                  account_number:
                    details
                      .account_number,

                  bank_name:
                    details
                      .account_bank_name,

                  note:
                    details.note,

                  expiration:
                    details
                      .account_expiration_datetime,
                },
              },
            })
            .eq(
              'id',
              paymentRecord.id,
            );

          await diagnostic(
            ctx.supabaseAdmin,
            {
              paymentId:
                paymentRecord.id,

              eventType:
                'bank_transfer_ready',

              stage:
                'awaiting_transfer',

              providerStatus:
                'pending',

              internalMessage:
                'Dynamic virtual account created successfully.',

              payload:
                account,
            },
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

              currency,

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

        /*
         * =====================================================
         * OPAY — DEDICATED FLUTTERWAVE V4 GENERAL FLOW
         *
         * 1. Customer already prepared
         * 2. Create OPay payment method
         * 3. Create charge
         * 4. Redirect customer to OPay
         * =====================================================
         */

        const paymentMethod =
          await flutterwaveRequest(
            '/payment-methods',
            {
              method:
                'POST',

              headers: {
                'X-Idempotency-Key':
                  crypto.randomUUID(),
              },

              body:
                JSON.stringify({
                  type:
                    'opay',
                }),
            },
          );

        const paymentMethodId =
          paymentMethod
            ?.data?.id;

        if (
          !paymentMethodId
        ) {
          throw new Error(
            'OPay payment method could not be prepared.',
          );
        }

        await ctx
          .supabaseAdmin
          .from(
            'payment_transactions',
          )
          .update({
            payment_method_id:
              paymentMethodId,

            attempt_stage:
              'payment_method_ready',
          })
          .eq(
            'id',
            paymentRecord.id,
          );

        await diagnostic(
          ctx.supabaseAdmin,
          {
            paymentId:
              paymentRecord.id,

            eventType:
              'opay_payment_method_created',

            stage:
              'payment_method_ready',

            internalMessage:
              'Flutterwave OPay payment method created.',

            payload:
              paymentMethod,
          },
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
            '/charges',
            {
              method:
                'POST',

              headers: {
                'X-Idempotency-Key':
                  crypto.randomUUID(),
              },

              body:
                JSON.stringify({
                  currency,

                  customer_id:
                    providerCustomerId,

                  payment_method_id:
                    paymentMethodId,

                  amount,

                  reference:
                    providerReference,

                  redirect_url:
                    `${siteUrl}/payment-return?payment=${paymentRecord.id}`,

                  meta: {
                    posho_order_id:
                      order.id,

                    posho_payment_id:
                      paymentRecord.id,

                    posho_order_reference:
                      order.reference,
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
            ?.url ||
          chargeData
            ?.redirect_url ||
          '';

        if (
          !chargeData?.id ||
          !redirectUrl
        ) {
          throw new Error(
            'OPay authorization could not be started.',
          );
        }

        const code =
          processorCode(
            chargeData,
          );

        await ctx
          .supabaseAdmin
          .from(
            'payment_transactions',
          )
          .update({
            status:
              'pending',

            provider_status:
              chargeData.status ||
              'pending',

            provider_response_code:
              code,

            provider_transaction_id:
              chargeData.id,

            checkout_url:
              redirectUrl,

            attempt_stage:
              'awaiting_authorization',

            customer_message:
              'Continue to OPay to log in and authorise this payment.',

            provider_payload:
              safeChargeSummary(
                chargeData,
              ),

            payment_metadata: {
              order_reference:
                order.reference,

              payment_method_id:
                paymentMethodId,

              next_action_type:
                chargeData
                  ?.next_action
                  ?.type ||
                null,
            },
          })
          .eq(
            'id',
            paymentRecord.id,
          );

        await diagnostic(
          ctx.supabaseAdmin,
          {
            paymentId:
              paymentRecord.id,

            eventType:
              'opay_charge_created',

            stage:
              'awaiting_authorization',

            providerStatus:
              chargeData.status ||
              'pending',

            providerCode:
              code,

            internalMessage:
              'OPay charge created and redirect returned.',

            payload:
              charge,
          },
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

            currency,

            redirectUrl,
          },
        });
      } catch (
        error
      ) {
        const internalMessage =
          error instanceof Error
            ? error.message
            : 'Unknown payment initialization error.';

        console.error(
          'create-payment-session:',
          error,
        );

        if (
          paymentRecord?.id
        ) {
          const customerMessage =
            requestedMethod ===
            'opay'
              ? 'OPay could not start this payment. No charge was confirmed. Please try again or use bank transfer.'
              : 'Bank transfer could not be prepared. No charge was confirmed. Please try again shortly.';

          await ctx
            .supabaseAdmin
            .from(
              'payment_transactions',
            )
            .update({
              status:
                'failed',

              attempt_stage:
                'failed',

              failure_code:
                'PAYMENT_INITIALIZATION_FAILED',

              customer_message:
                customerMessage,

              completed_at:
                new Date()
                  .toISOString(),

              last_checked_at:
                new Date()
                  .toISOString(),
            })
            .eq(
              'id',
              paymentRecord.id,
            );

          await diagnostic(
            ctx.supabaseAdmin,
            {
              paymentId:
                paymentRecord.id,

              eventType:
                'initialization_failed',

              stage:
                'failed',

              internalMessage,

              payload: {
                method:
                  requestedMethod,
              },
            },
          );

          return Response.json(
            {
              success: false,

              message:
                customerMessage,

              paymentId:
                paymentRecord.id,
            },
            {
              status: 502,
            },
          );
        }

        return Response.json(
          {
            success: false,

            message:
              'Payment could not be started. No charge was made. Please try again shortly.',
          },
          {
            status: 500,
          },
        );
      }
    },
  ),
};