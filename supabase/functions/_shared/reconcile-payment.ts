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

  if (
    mismatches.length >
    0
  ) {
    const now =
      new Date()
        .toISOString();

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

  const now =
    new Date()
      .toISOString();

  if (
    providerStatus !==
    'succeeded'
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
        'This payment attempt was not completed. You can try again or choose another payment method.';
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
          charge,
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

  if (
    payment.status ===
    'successful'
  ) {
    await admin
      .from(
        'payment_transactions',
      )
      .update({
        provider_status:
          'succeeded',

        provider_response_code:
          code,

        last_checked_at:
          now,

        attempt_stage:
          'completed',

        customer_message:
          null,
      })
      .eq(
        'id',
        payment.id,
      );

    return {
      success: true,

      status:
        'successful',
    };
  }

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
        'payment_verified',

      stage:
        'completed',

      providerStatus:
        'succeeded',

      providerCodeValue:
        code,

      internalMessage:
        'Flutterwave payment independently verified successfully.',

      payload:
        charge,
    },
  );

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
        payment.order_id,
      )
      .eq(
        'status',
        'successful',
      );

  if (
    totalError
  ) {
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
        row: any,
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
        customer_id,
        quoted_amount_kobo,
        status
      `)
      .eq(
        'id',
        payment.order_id,
      )
      .single();

  if (
    orderError
  ) {
    throw orderError;
  }

  const quoteAmount =
    Number(
      order
        .quoted_amount_kobo ||
        0,
    );

  const fullyPaid =
    quoteAmount >
      0 &&
    totalPaid >=
      quoteAmount;

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
        : 'Payment balance outstanding',
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

  if (
    fullyPaid
  ) {
    await admin
      .from(
        'notification_events',
      )
      .insert({
        order_id:
          order.id,

        customer_id:
          order.customer_id,

        channel:
          'internal',

        event_type:
          'payment_received',

        status:
          'pending',

        payload: {
          amount_kobo:
            expectedAmount,

          reference:
            expectedReference,

          provider_transaction_id:
            charge.id,
        },
      });
  }

  return {
    success:
      fullyPaid,

    status:
      fullyPaid
        ? 'successful'
        : 'processing',

    totalPaid,
  };
}