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

export async function getAdminPaymentAttempts(
  orderId = null,
) {
  let query =
    supabase
      .from(
        'payment_transactions',
      )
      .select(`
        id,
        order_id,
        provider,
        provider_reference,
        provider_transaction_id,
        provider_customer_id,
        payment_method,
        payment_method_id,
        amount_kobo,
        base_amount_kobo,
        estimated_fee_kobo,
        estimated_customer_total_kobo,
        actual_provider_fee_kobo,
        actual_customer_total_kobo,
        provider_fees,
        currency,
        status,
        provider_status,
        provider_response_code,
        attempt_stage,
        failure_code,
        customer_message,
        checkout_url,
        virtual_account_id,
        expires_at,
        verified_at,
        last_checked_at,
        completed_at,
        created_at,
        updated_at,
        orders (
          reference,
          project_title,
          customers (
            full_name,
            email
          )
        ),
        payment_attempt_diagnostics (
          id,
          event_type,
          stage,
          provider_status,
          provider_code,
          internal_message,
          created_at
        )
      `)
      .order(
        'created_at',
        {
          ascending:
            false,
        },
      );

  if (orderId) {
    query =
      query.eq(
        'order_id',
        orderId,
      );
  }

  const {
    data,
    error,
  } =
    await query;

  if (error) {
    throw error;
  }

  return (
    data ||
    []
  ).map(
    (payment) => ({
      ...payment,

      payment_attempt_diagnostics:
        [
          ...(
            payment
              .payment_attempt_diagnostics ||
            []
          ),
        ].sort(
          (
            first,
            second,
          ) =>
            new Date(
              second
                .created_at,
            ) -
            new Date(
              first
                .created_at,
            ),
        ),
    }),
  );
}

export async function getPaymentMethodSettings() {
  const {
    data,
    error,
  } =
    await supabase
      .from(
        'payment_method_settings',
      )
      .select(`
        method_key,
        display_name,
        description,
        enabled,
        currency,
        sort_order,
        updated_at
      `)
      .order(
        'sort_order',
        {
          ascending:
            true,
        },
      );

  if (error) {
    throw error;
  }

  return data || [];
}

export async function updatePaymentMethodEnabled({
  methodKey,
  enabled,
}) {
  const {
    data: {
      user,
    },
  } =
    await supabase.auth
      .getUser();

  const {
    error,
  } =
    await supabase
      .from(
        'payment_method_settings',
      )
      .update({
        enabled:
          Boolean(
            enabled,
          ),

        updated_by:
          user?.id ||
          null,
      })
      .eq(
        'method_key',
        methodKey,
      );

  if (error) {
    throw error;
  }
}

export async function recheckAdminPayment(
  paymentId,
) {
  const {
    data,
    error,
  } =
    await supabase.functions
      .invoke(
        'admin-payment-action',
        {
          body: {
            paymentId,
          },
        },
      );

  if (error) {
    throw await functionError(
      error,
      'Payment status could not be checked.',
    );
  }

  if (!data?.success) {
    throw new Error(
      data?.message ||
        'Payment status could not be checked.',
    );
  }

  return data;
}