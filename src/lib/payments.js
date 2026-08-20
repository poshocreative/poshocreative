import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
} from '@supabase/supabase-js';

import {
  supabase,
} from './supabase';

async function getFunctionError(
  error,
  fallbackMessage,
) {
  if (
    error instanceof
    FunctionsHttpError
  ) {
    try {
      const response =
        await error.context
          .json();

      return new Error(
        response?.message ||
          fallbackMessage,
      );
    } catch {
      return new Error(
        fallbackMessage,
      );
    }
  }

  if (
    error instanceof
      FunctionsFetchError ||
    error instanceof
      FunctionsRelayError
  ) {
    return new Error(
      'The payment service could not be reached. No charge was confirmed. Please try again shortly.',
    );
  }

  return new Error(
    error?.message ||
      fallbackMessage,
  );
}

export async function createPaymentSession({
  orderId,
  method,
}) {
  if (!orderId) {
    throw new Error(
      'A valid project is required before payment can begin.',
    );
  }

  if (
    ![
      'bank_transfer',
      'opay',
    ].includes(method)
  ) {
    throw new Error(
      'Choose a valid payment method.',
    );
  }

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
    throw await getFunctionError(
      error,
      'Payment could not be started.',
    );
  }

  if (
    !data?.success ||
    !data?.payment
  ) {
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
  if (!paymentId) {
    throw new Error(
      'A valid payment reference is required.',
    );
  }

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
    throw await getFunctionError(
      error,
      'Payment verification could not be completed.',
    );
  }

  if (!data) {
    throw new Error(
      'Payment verification returned an invalid response.',
    );
  }

  return data;
}

export async function getMyPaymentAttempts() {
  const {
    data,
    error,
  } =
    await supabase
      .from(
        'payment_transactions',
      )
      .select(`
        id,
        order_id,
        provider_reference,
        payment_method,
        amount_kobo,
        currency,
        status,
        provider_status,
        attempt_stage,
        customer_message,
        verified_at,
        last_checked_at,
        completed_at,
        created_at,
        orders (
          reference,
          project_title
        )
      `)
      .order(
        'created_at',
        {
          ascending:
            false,
        },
      );

  if (error) {
    throw error;
  }

  return data || [];
}

export async function getPaymentById(
  paymentId,
) {
  if (!paymentId) {
    return null;
  }

  const {
    data,
    error,
  } =
    await supabase
      .from(
        'payment_transactions',
      )
      .select(`
        id,
        order_id,
        provider_reference,
        provider_transaction_id,
        payment_method,
        amount_kobo,
        currency,
        status,
        provider_status,
        attempt_stage,
        customer_message,
        checkout_url,
        virtual_account_id,
        expires_at,
        verified_at,
        last_checked_at,
        completed_at,
        created_at,
        orders (
          reference,
          project_title,
          service_slug,
          status,
          payment_status
        )
      `)
      .eq(
        'id',
        paymentId,
      )
      .maybeSingle();

  if (error) {
    throw error;
  }

  return data || null;
}

export function formatPaymentStatus(
  status,
) {
  if (!status) {
    return '';
  }

  return status
    .replaceAll(
      '_',
      ' ',
    )
    .replace(
      /\b\w/g,
      (
        character,
      ) =>
        character
          .toUpperCase(),
    );
}