import {
  FunctionsHttpError,
} from '@supabase/supabase-js';

import {
  supabase,
} from './supabase';

async function functionError(
  error,
  fallback,
) {
  if (
    error instanceof
    FunctionsHttpError
  ) {
    try {
      const body =
        await error.context
          .json();

      return new Error(
        body?.message ||
          fallback,
      );
    } catch {
      return new Error(
        fallback,
      );
    }
  }

  return new Error(
    error?.message ||
      fallback,
  );
}

export async function createPaymentSession({
  orderId,
  method,
}) {
  const {
    data,
    error,
  } =
    await supabase.functions
      .invoke(
        'create-payment-session',
        {
          body: {
            orderId,
            method,
          },
        },
      );

  if (error) {
    throw await functionError(
      error,
      'Payment could not be started.',
    );
  }

  if (!data?.success) {
    throw new Error(
      data?.message ||
        'Payment could not be started.',
    );
  }

  return data.payment;
}

export async function verifyPayment(
  paymentId,
) {
  const {
    data,
    error,
  } =
    await supabase.functions
      .invoke(
        'verify-payment',
        {
          body: {
            paymentId,
          },
        },
      );

  if (error) {
    throw await functionError(
      error,
      'Payment could not be verified.',
    );
  }

  return data;
}