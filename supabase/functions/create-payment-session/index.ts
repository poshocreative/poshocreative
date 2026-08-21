import {
  withSupabase,
} from 'npm:@supabase/server@^1';

import {
  flutterwaveRequest,
  getPaymentGatewayDiagnostic,
} from '../_shared/flutterwave.ts';

import {
  getPaymentFeeQuote,
} from '../_shared/payment-fees.ts';

function generatePaymentReference() {
  return `PCPAY-${crypto
    .randomUUID()
    .replaceAll(
      '-',
      '',
    )
    .slice(
      0,
      20,
    )
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

function providerFees(
  data: any,
) {
  if (
    !Array.isArray(
      data?.fees,
    )
  ) {
    return [];
  }

  return data.fees.map(
    (
      fee: any,
    ) => ({
      type:
        fee?.type ||
        'provider_fee',

      amount:
        Number(
          fee?.amount ||
            0,
        ),
    }),
  );
}

function providerFeeKobo(
  data: any,
) {
  return providerFees(
    data,
  ).reduce(
    (
      total,
      fee,
    ) =>
      total +
      Math.round(
        Number(
          fee.amount ||
            0,
        ) *
          100,
      ),
    0,
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

    fees:
      providerFees(
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
          !requestedMethod
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
          data:
            methodSetting,
          error:
            methodError,
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
              currency
            `)
            .eq(
              'method_key',
              requestedMethod,
            )
            .maybeSingle();

        if (
          methodError
        ) {
          throw methodError;
        }

        if (
          !methodSetting ||
          !methodSetting
            .enabled
        ) {
          return Response.json(
            {
              success: false,

              message:
                'This payment option is temporarily unavailable. Please choose another method.',
            },
            {
              status: 409,
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
          methodSetting
            .currency !==
          currency
        ) {
          return Response.json(
            {
              success: false,

              message:
                'This payment method is not available for the project currency.',
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

        const feeQuote =
          await getPaymentFeeQuote({
            method:
              requestedMethod,

            amountKobo:
              outstanding,

            currency,
          });

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

        const now =
          new Date()
            .toISOString();

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

              base_amount_kobo:
                outstanding,

              estimated_fee_kobo:
                feeQuote
                  .feeKobo,

              estimated_customer_total_kobo:
                feeQuote
                  .totalKobo,

              fee_quoted_at:
                now,

              customer_bears_fee:
                true,

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

                fee_quote: {
                  base_amount_kobo:
                    outstanding,

                  processing_fee_kobo:
                    feeQuote
                      .feeKobo,

                  customer_total_kobo:
                    feeQuote
                      .totalKobo,

                  quoted_at:
                    now,
                },
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
              `Payment attempt created for ${order.reference}. Provider fee quote: ${feeQuote.feeKobo} kobo.`,
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

          const providerTransferAmountKobo =
            Number.isFinite(
              Number(
                details.amount,
              ),
            )
              ? Math.round(
                  Number(
                    details.amount,
                  ) *
                    100,
                )
              : null;

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
                'Transfer the exact amount displayed to the temporary account. Confirmation may take a few moments.',

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

                fee_quote: {
                  base_amount_kobo:
                    outstanding,

                  processing_fee_kobo:
                    feeQuote
                      .feeKobo,

                  customer_total_kobo:
                    feeQuote
                      .totalKobo,
                },

                virtual_account: {
                  account_number:
                    details
                      .account_number,

                  bank_name:
                    details
                      .account_bank_name,

                  provider_transfer_amount_kobo:
                    providerTransferAmountKobo,

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

              payload: {
                virtual_account_id:
                  details.id,

                provider_transfer_amount_kobo:
                  providerTransferAmountKobo,

                estimated_fee_kobo:
                  feeQuote
                    .feeKobo,
              },
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

              baseAmountKobo:
                outstanding,

              processingFeeKobo:
                feeQuote
                  .feeKobo,

              estimatedCustomerTotalKobo:
                feeQuote
                  .totalKobo,

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

                amountKobo:
                  providerTransferAmountKobo,

                expiresAt:
                  details
                    .account_expiration_datetime,
              },
            },
          });
        }

        if (
          requestedMethod !==
          'opay'
        ) {
          throw new Error(
            'Unsupported payment method.',
          );
        }

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

        const actualFee =
          providerFeeKobo(
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

            actual_provider_fee_kobo:
              actualFee,

            actual_customer_total_kobo:
              outstanding +
              actualFee,

            provider_fees:
              providerFees(
                chargeData,
              ),

            customer_message:
              'Continue to OPay to authorise this payment.',

            provider_payload:
              safeChargeSummary(
                chargeData,
              ),
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
              safeChargeSummary(
                chargeData,
              ),
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

            baseAmountKobo:
              outstanding,

            processingFeeKobo:
              actualFee ||
              feeQuote
                .feeKobo,

            estimatedCustomerTotalKobo:
              actualFee
                ? outstanding +
                  actualFee
                : feeQuote
                    .totalKobo,

            currency,

            redirectUrl,
          },
        });
      } catch (
        error
      ) {
        const providerDiagnostic =
          getPaymentGatewayDiagnostic(
            error,
          );

        const internalMessage =
          providerDiagnostic
            .technicalMessage;

        console.error(
          'create-payment-session:',
          {
            method:
              requestedMethod,

            code:
              providerDiagnostic
                .code,

            internalMessage,
          },
        );

        if (
          paymentRecord?.id
        ) {
          const customerMessage =
            requestedMethod ===
            'opay'
              ? 'OPay could not start this payment. No charge was confirmed. Please choose another available payment option.'
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
                providerDiagnostic
                  .code,

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

              providerCode:
                providerDiagnostic
                  .code,

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