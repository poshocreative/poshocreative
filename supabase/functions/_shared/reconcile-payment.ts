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
      ) * 100,
    );

  if (
    actualReference !==
      expectedReference ||
    actualCurrency !==
      expectedCurrency ||
    actualAmount !==
      expectedAmount
  ) {
    console.error(
      'Payment verification mismatch',
      {
        expectedReference,
        actualReference,
        expectedCurrency,
        actualCurrency,
        expectedAmount,
        actualAmount,
      },
    );

    throw new Error(
      'The payment details did not match the expected transaction.',
    );
  }

  const providerStatus =
    (
      charge.status ||
      ''
    ).toLowerCase();

  if (
    providerStatus !==
    'succeeded'
  ) {
    let localStatus =
      'processing';

    if (
      providerStatus ===
      'failed'
    ) {
      localStatus =
        'failed';
    }

    if (
      providerStatus ===
      'voided'
    ) {
      localStatus =
        'cancelled';
    }

    await admin
      .from(
        'payment_transactions',
      )
      .update({
        status:
          localStatus,

        provider_transaction_id:
          charge.id ||
          payment
            .provider_transaction_id,

        provider_payload:
          charge,
      })
      .eq(
        'id',
        payment.id,
      );

    return {
      success: false,
      status:
        localStatus,
    };
  }

  if (
    payment.status ===
    'successful'
  ) {
    return {
      success: true,
      status:
        'successful',
    };
  }

  const now =
    new Date()
      .toISOString();

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

        provider_transaction_id:
          charge.id,

        provider_payload:
          charge,

        verified_at:
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

  if (totalError) {
    throw totalError;
  }

  const totalPaid =
    (
      successfulPayments ||
      []
    ).reduce(
      (
        sum: number,
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
    error: orderError,
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

  const orderPatch: any = {
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