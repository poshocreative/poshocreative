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
      'We could not reach the Posho Creative payment server. Check your connection and try again.',
    );
  }

  return new Error(
    error?.message ||
      fallbackMessage,
  );
}

/**
 * Creates a real server-side payment session.
 *
 * Supported methods:
 * - bank_transfer
 * - opay
 *
 * The amount is NOT supplied by the browser.
 * The Edge Function determines the amount from
 * the authenticated customer's real order.
 */
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

/**
 * Re-checks a payment directly through our
 * Supabase backend.
 *
 * The browser does not decide whether a
 * payment succeeded.
 */
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
      'The payment server returned an invalid response.',
    );
  }

  return data;
}

/**
 * Fetch one customer's payment record.
 *
 * RLS ensures authenticated customers can only
 * access payment records belonging to their
 * own orders.
 */
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
        provider,
        provider_reference,
        provider_transaction_id,
        payment_method,
        amount_kobo,
        currency,
        status,
        checkout_url,
        virtual_account_id,
        expires_at,
        verified_at,
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

/**
 * Formats payment status text for display.
 */
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
      (character) =>
        character.toUpperCase(),
    );
}