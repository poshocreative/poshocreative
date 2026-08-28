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

function moneyToKobo(
  value: unknown,
) {
  if (
    value ===
      null ||
    value ===
      undefined ||
    value ===
      ''
  ) {
    return null;
  }

  const amount =
    Number(value);

  if (
    !Number.isFinite(
      amount,
    ) ||
    amount < 0
  ) {
    return null;
  }

  return Math.round(
    amount *
      100,
  );
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
        ? search
            .data
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

async function safeFeeQuote({
  method,
  amountKobo,
  currency,
}: {
  method: string;
  amountKobo: number;
  currency: string;
}) {
  try {
    return await getPaymentFeeQuote({
      method,
      amountKobo,
      currency,
    });
  } catch (
    error
  ) {
    console.warn(
      'Continuing payment without pre-payment fee quote:',
      {
        method,

        message:
          error instanceof
          Error
            ? error.message
            : String(
                error,
              ),
      },
    );

    return null;
  }
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
            ? body
                .orderId
                .trim()
            : '';

        requestedMethod =
          typeof body
            ?.method ===
          'string'
            ? body
                .method
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
          )
            .trim()
            .toUpperCase();

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

        const fullOutstanding =
          quotedAmount -
          paidAmount;

        if (
          quotedAmount <=
            0 ||
          fullOutstanding <=
            0
        ) {
          return Response.json(
            {
              success: false,

              message:
                fullOutstanding <=
                0
                  ? 'This project has already been paid.'
                  : 'A payable quotation has not been issued for this project yet.',
            },
            {
              status: 409,
            },
          );
        }

        const currentTime =
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
            ) > currentTime
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

        if (approvalIsCurrent) {
          const recentAttemptCutoff =
            new Date(
              currentTime.getTime() -
                60 *
                  60 *
                  1000,
            ).toISOString();

          const {
            data:
              openAttempts,
            error:
              openAttemptError,
          } =
            await ctx
              .supabaseAdmin
              .from(
                'payment_transactions',
              )
              .select(`
                id,
                status,
                created_at
              `)
              .eq(
                'part_payment_request_id',
                approvedRequest.id,
              )
              .in(
                'status',
                [
                  'processing',
                  'pending',
                ],
              )
              .gte(
                'created_at',
                recentAttemptCutoff,
              )
              .limit(1);

          if (openAttemptError) {
            throw openAttemptError;
          }

          if (openAttempts?.length) {
            return Response.json(
              {
                success: false,

                message:
                  'An installment payment is already in progress. Complete it or wait for the current payment session to expire before trying again.',
              },
              {
                status: 409,
              },
            );
          }
        }

        /*
         * Fee quotation is useful for transparency
         * but is NOT allowed to block a payment.
         */
        const feeQuote =
          await safeFeeQuote({
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

              part_payment_request_id:
                approvalIsCurrent
                  ? approvedRequest.id
                  : null,

              payment_scope:
                paymentScope,

              base_amount_kobo:
                outstanding,

              estimated_fee_kobo:
                feeQuote
                  ?.feeKobo ??
                null,

              estimated_customer_total_kobo:
                feeQuote
                  ?.totalKobo ??
                null,

              fee_quoted_at:
                feeQuote
                  ? now
                  : null,

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

                payment_scope:
                  paymentScope,

                full_outstanding_kobo:
                  fullOutstanding,

                part_payment_request_id:
                  approvalIsCurrent
                    ? approvedRequest.id
                    : null,

                fee_quote: feeQuote
                  ? {
                      available:
                        true,

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
                    }
                  : {
                      available:
                        false,
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
              feeQuote
                ? `Payment attempt created. Fee quote: ${feeQuote.feeKobo} kobo.`
                : 'Payment attempt created. Pre-payment fee quote was unavailable; payment processing continued.',
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
              'Payment customer profile prepared.',
          },
        );

        const amount =
          Number(
            (
              outstanding /
              100
            ).toFixed(
              2,
            ),
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

          /*
           * Flutterwave's dynamic virtual-account
           * response gives us the exact amount the
           * customer must send.
           *
           * When customer fees are enabled this may
           * be greater than the project/base amount.
           */
          const providerTotalKobo =
            moneyToKobo(
              details.amount,
            ) ??
            outstanding;

          const exactFeeKobo =
            Math.max(
              providerTotalKobo -
                outstanding,
              0,
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
                details.status ||
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

              estimated_fee_kobo:
                exactFeeKobo,

              estimated_customer_total_kobo:
                providerTotalKobo,

              fee_quoted_at:
                new Date()
                  .toISOString(),

              customer_message:
                'Transfer the exact amount displayed to the temporary account. Confirmation may take a few moments.',

              provider_payload: {
                id:
                  details.id,

                type:
                  'virtual_account',

                amount:
                  details.amount,

                currency:
                  details.currency ||
                  currency,

                status:
                  details.status ||
                  null,

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
                  source:
                    'virtual_account',

                  base_amount_kobo:
                    outstanding,

                  processing_fee_kobo:
                    exactFeeKobo,

                  customer_total_kobo:
                    providerTotalKobo,
                },

                virtual_account: {
                  account_number:
                    details
                      .account_number,

                  bank_name:
                    details
                      .account_bank_name,

                  exact_transfer_amount_kobo:
                    providerTotalKobo,

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
                details.status ||
                'pending',

              internalMessage:
                `Dynamic virtual account created. Exact customer transfer amount: ${providerTotalKobo} kobo; processing fee: ${exactFeeKobo} kobo.`,

              payload: {
                virtual_account_id:
                  details.id,

                base_amount_kobo:
                  outstanding,

                processing_fee_kobo:
                  exactFeeKobo,

                customer_total_kobo:
                  providerTotalKobo,
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
                exactFeeKobo,

              estimatedCustomerTotalKobo:
                providerTotalKobo,

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
                  providerTotalKobo,

                expiresAt:
                  details
                    .account_expiration_datetime,
              },
            },
          });
        }

        /*
         * =====================================================
         * OPAY
         * =====================================================
         */

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
              'OPay payment method created successfully.',
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

        const chargeFeeKobo =
          providerFeeKobo(
            chargeData,
          );

        const finalFeeKobo =
          chargeFeeKobo >
          0
            ? chargeFeeKobo
            : feeQuote
                ?.feeKobo ??
              0;

        const customerTotalKobo =
          outstanding +
          finalFeeKobo;

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

            estimated_fee_kobo:
              finalFeeKobo,

            estimated_customer_total_kobo:
              customerTotalKobo,

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
              'OPay charge created and customer authorization URL returned.',

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
              finalFeeKobo,

            estimatedCustomerTotalKobo:
              customerTotalKobo,

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

        console.error(
          'create-payment-session:',
          {
            method:
              requestedMethod,

            code:
              providerDiagnostic
                .code,

            internalMessage:
              providerDiagnostic
                .technicalMessage,
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

              internalMessage:
                providerDiagnostic
                  .technicalMessage,

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
