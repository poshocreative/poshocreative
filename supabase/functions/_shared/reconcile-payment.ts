function providerCustomerId(
  charge: any,
) {
  if (
    typeof charge
      ?.customer ===
    'string'
  ) {
    return charge.customer;
  }

  return (
    charge?.customer
      ?.id ||
    charge
      ?.customer_id ||
    ''
  );
}

function providerCode(
  charge: any,
) {
  return (
    charge
      ?.processor_response
      ?.code ||
    charge
      ?.issuer_response
      ?.code ||
    null
  );
}

function normalizedFees(
  charge: any,
) {
  if (
    !Array.isArray(
      charge?.fees,
    )
  ) {
    return [];
  }

  return charge.fees.map(
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

function actualFeeKobo(
  charge: any,
) {
  return normalizedFees(
    charge,
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

function safeProviderSummary(
  charge: any,
) {
  return {
    id:
      charge?.id ||
      null,

    reference:
      charge
        ?.reference ||
      null,

    amount:
      charge?.amount ??
      null,

    currency:
      charge
        ?.currency ||
      null,

    status:
      charge?.status ||
      null,

    customer_id:
      providerCustomerId(
        charge,
      ) ||
      null,

    processor_code:
      providerCode(
        charge,
      ),

    payment_method_type:
      charge
        ?.payment_method
        ?.type ||
      charge
        ?.payment_method_details
        ?.type ||
      null,

    fees:
      normalizedFees(
        charge,
      ),
  };
}

async function diagnostic(
  admin: any,
  paymentId: string,
  {
    eventType,
    stage,
    providerStatus = null,
    providerCodeValue = null,
    internalMessage = null,
    payload = {},
  }: {
    eventType: string;
    stage: string;
    providerStatus?: string | null;
    providerCodeValue?: string | null;
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
          providerCodeValue,

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

export async function syncSuccessfulPaymentOrder(
  admin: any,
  orderId: string,
) {
  const {
    data:
      successfulPayments,
    error:
      totalError,
  } =
    await admin
      .from(
        'payment_transactions',
      )
      .select(
        'amount_kobo',
      )
      .eq(
        'order_id',
        orderId,
      )
      .eq(
        'status',
        'successful',
      );

  if (totalError) {
    throw totalError;
  }

  const totalPaid =
    (
      successfulPayments ||
      []
    ).reduce(
      (
        sum:
          number,
        row:
          any,
      ) =>
        sum +
        Number(
          row.amount_kobo ||
            0,
        ),
      0,
    );

  const {
    data: order,
    error:
      orderError,
  } =
    await admin
      .from(
        'orders',
      )
      .select(`
        id,
        reference,
        customer_id,
        quoted_amount_kobo,
        status
      `)
      .eq(
        'id',
        orderId,
      )
      .single();

  if (orderError) {
    throw orderError;
  }

  const quoteAmount =
    Number(
      order
        .quoted_amount_kobo ||
        0,
    );

  const fullyPaid =
    quoteAmount > 0 &&
    totalPaid >=
      quoteAmount;

  const remainingBalanceKobo =
    Math.max(
      quoteAmount -
        totalPaid,
      0,
    );

  const orderPatch:
    any = {
    paid_amount_kobo:
      totalPaid,

    payment_status:
      fullyPaid
        ? 'successful'
        : 'processing',

    customer_action_required:
      !fullyPaid,

    customer_action_label:
      fullyPaid
        ? null
        : 'Payment received — remaining balance outstanding',
  };

  if (
    fullyPaid &&
    ![
      'completed',
      'cancelled',
    ].includes(
      order.status,
    )
  ) {
    orderPatch.status =
      'paid';
  }

  const {
    error:
      orderUpdateError,
  } =
    await admin
      .from(
        'orders',
      )
      .update(
        orderPatch,
      )
      .eq(
        'id',
        order.id,
      );

  if (orderUpdateError) {
    throw orderUpdateError;
  }

  return {
    order,
    totalPaid,
    fullyPaid,
    remainingBalanceKobo,
  };
}

export async function reconcilePayment(
  admin: any,
  payment: any,
  charge: any,
) {
  if (
    !payment ||
    !charge
  ) {
    throw new Error(
      'Payment verification data is incomplete.',
    );
  }

  const expectedReference =
    payment
      .provider_reference;

  const actualReference =
    charge.reference;

  const expectedCurrency =
    (
      payment.currency ||
      'NGN'
    ).toUpperCase();

  const actualCurrency =
    (
      charge.currency ||
      ''
    ).toUpperCase();

  const expectedAmount =
    Number(
      payment.amount_kobo,
    );

  const actualAmount =
    Math.round(
      Number(
        charge.amount ||
          0,
      ) *
        100,
    );

  const expectedCustomerId =
    payment
      .provider_customer_id ||
    '';

  const actualCustomerId =
    providerCustomerId(
      charge,
    );

  const providerFee =
    actualFeeKobo(
      charge,
    );

  const fees =
    normalizedFees(
      charge,
    );

  const customerBearsFee =
    payment
      .customer_bears_fee !==
    false;

  const actualCustomerTotal =
    expectedAmount +
    (
      customerBearsFee
        ? providerFee
        : 0
    );

  const mismatches:
    string[] = [];

  if (
    actualReference !==
    expectedReference
  ) {
    mismatches.push(
      'reference',
    );
  }

  if (
    actualCurrency !==
    expectedCurrency
  ) {
    mismatches.push(
      'currency',
    );
  }

  if (
    actualAmount !==
    expectedAmount
  ) {
    mismatches.push(
      'amount',
    );
  }

  if (
    expectedCustomerId &&
    actualCustomerId !==
      expectedCustomerId
  ) {
    mismatches.push(
      'customer',
    );
  }

  const now =
    new Date()
      .toISOString();

  if (
    mismatches.length >
    0
  ) {
    console.error(
      'Payment verification mismatch:',
      {
        paymentId:
          payment.id,

        mismatches,

        expectedReference,
        actualReference,

        expectedCurrency,
        actualCurrency,

        expectedAmount,
        actualAmount,

        expectedCustomerId,
        actualCustomerId,
      },
    );

    await admin
      .from(
        'payment_transactions',
      )
      .update({
        attempt_stage:
          'verification_attention_required',

        failure_code:
          'VERIFICATION_MISMATCH',

        actual_provider_fee_kobo:
          providerFee,

        actual_customer_total_kobo:
          actualCustomerTotal,

        provider_fees:
          fees,

        provider_payload:
          safeProviderSummary(
            charge,
          ),

        customer_message:
          'We could not verify this payment automatically. Posho Creative has been notified.',

        last_checked_at:
          now,
      })
      .eq(
        'id',
        payment.id,
      );

    await diagnostic(
      admin,
      payment.id,
      {
        eventType:
          'verification_mismatch',

        stage:
          'verification_attention_required',

        providerStatus:
          charge.status ||
          null,

        providerCodeValue:
          providerCode(
            charge,
          ),

        internalMessage:
          `Verification mismatch: ${mismatches.join(', ')}.`,

        payload: {
          expected: {
            reference:
              expectedReference,

            currency:
              expectedCurrency,

            amount_kobo:
              expectedAmount,

            customer_id:
              expectedCustomerId,
          },

          actual: {
            reference:
              actualReference,

            currency:
              actualCurrency,

            amount_kobo:
              actualAmount,

            customer_id:
              actualCustomerId,

            provider_fee_kobo:
              providerFee,
          },
        },
      },
    );

    throw new Error(
      'We could not verify this payment automatically. Posho Creative has been notified.',
    );
  }

  const providerStatus =
    (
      charge.status ||
      ''
    )
      .trim()
      .toLowerCase();

  const code =
    providerCode(
      charge,
    );

  const providerSucceeded =
    [
      'succeeded',
      'successful',
    ].includes(
      providerStatus,
    );

  if (
    !providerSucceeded &&
    payment.status !==
      'successful'
  ) {
    let localStatus =
      'pending';

    let stage =
      'awaiting_confirmation';

    let customerMessage =
      'This payment is still awaiting confirmation.';

    if (
      providerStatus ===
      'failed'
    ) {
      localStatus =
        'failed';

      stage =
        'failed';

      customerMessage =
        'This payment attempt was not completed. You can try again using an available payment method.';
    }

    if (
      [
        'voided',
        'cancelled',
      ].includes(
        providerStatus,
      )
    ) {
      localStatus =
        'cancelled';

      stage =
        'cancelled';

      customerMessage =
        'This payment attempt was cancelled. No successful payment was recorded.';
    }

    await admin
      .from(
        'payment_transactions',
      )
      .update({
        status:
          localStatus,

        provider_status:
          providerStatus ||
          null,

        provider_response_code:
          code,

        provider_transaction_id:
          charge.id ||
          payment
            .provider_transaction_id,

        actual_provider_fee_kobo:
          providerFee,

        actual_customer_total_kobo:
          actualCustomerTotal,

        provider_fees:
          fees,

        provider_payload:
          safeProviderSummary(
            charge,
          ),

        attempt_stage:
          stage,

        customer_message:
          customerMessage,

        last_checked_at:
          now,

        completed_at:
          [
            'failed',
            'cancelled',
          ].includes(
            localStatus,
          )
            ? now
            : null,
      })
      .eq(
        'id',
        payment.id,
      );

    await diagnostic(
      admin,
      payment.id,
      {
        eventType:
          'provider_status_checked',

        stage,

        providerStatus:
          providerStatus ||
          null,

        providerCodeValue:
          code,

        internalMessage:
          `Provider returned ${providerStatus || 'unknown'} status.`,

        payload:
          safeProviderSummary(
            charge,
          ),
      },
    );

    return {
      success: false,

      status:
        localStatus,

      providerStatus,

      message:
        customerMessage,
    };
  }

  const wasAlreadySuccessful =
    payment.status ===
    'successful';

  const {
    error:
      paymentUpdateError,
  } =
    await admin
      .from(
        'payment_transactions',
      )
      .update({
        status:
          'successful',

        provider_status:
          'succeeded',

        provider_response_code:
          code,

        provider_transaction_id:
          charge.id,

        actual_provider_fee_kobo:
          providerFee,

        actual_customer_total_kobo:
          actualCustomerTotal,

        provider_fees:
          fees,

        provider_payload:
          safeProviderSummary(
            charge,
          ),

        attempt_stage:
          'completed',

        customer_message:
          null,

        failure_code:
          null,

        verified_at:
          now,

        last_checked_at:
          now,

        completed_at:
          now,
      })
      .eq(
        'id',
        payment.id,
      );

  if (
    paymentUpdateError
  ) {
    throw paymentUpdateError;
  }

  await diagnostic(
    admin,
    payment.id,
    {
      eventType:
        wasAlreadySuccessful
          ? 'payment_reconciled_again'
          : 'payment_verified',

      stage:
        'completed',

      providerStatus:
        'succeeded',

      providerCodeValue:
        code,

      internalMessage:
        `Flutterwave payment verified successfully. Provider fee: ${providerFee} kobo.`,

      payload:
        safeProviderSummary(
          charge,
        ),
    },
  );

  const projectState =
    await syncSuccessfulPaymentOrder(
      admin,
      payment.order_id,
    );

  if (!wasAlreadySuccessful) {
    await admin
      .from(
        'notification_events',
      )
      .insert({
        order_id:
          projectState
            .order
            .id,

        customer_id:
          projectState
            .order
            .customer_id,

        channel:
          'internal',

        event_type:
          'payment_received',

        status:
          'pending',

        payload: {
          payment_id:
            payment.id,

          amount_kobo:
            expectedAmount,

          provider_fee_kobo:
            providerFee,

          customer_total_kobo:
            actualCustomerTotal,

          reference:
            expectedReference,

          provider_transaction_id:
            charge.id,

          project_fully_paid:
            projectState
              .fullyPaid,

          remaining_balance_kobo:
            projectState
              .remainingBalanceKobo,
        },
      });
  }

  return {
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

    providerFeeKobo:
      providerFee,

    customerTotalKobo:
      actualCustomerTotal,

    message:
      projectState
        .fullyPaid
        ? 'Flutterwave confirmed the payment. This project is fully paid.'
        : 'Flutterwave confirmed this payment. The remaining project balance is still outstanding.',
  };
}
