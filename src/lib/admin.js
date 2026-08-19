import {
  FunctionsHttpError,
} from '@supabase/supabase-js';

import {
  supabase,
} from './supabase';

export async function getAdminAccessState() {
  const [
    accountResult,
    accessResult,
  ] =
    await Promise.all([
      supabase.rpc(
        'is_admin_account',
      ),

      supabase.rpc(
        'has_admin_access',
      ),
    ]);

  if (
    accountResult.error
  ) {
    throw accountResult.error;
  }

  if (
    accessResult.error
  ) {
    throw accessResult.error;
  }

  return {
    isAdminAccount:
      accountResult.data ===
      true,

    hasAccess:
      accessResult.data ===
      true,
  };
}

export async function verifyAdminAccessCode(
  code,
) {
  const {
    data,
    error,
  } =
    await supabase.functions
      .invoke(
        'verify-admin-access',
        {
          body: {
            code,
          },
        },
      );

  if (error) {
    if (
      error instanceof
      FunctionsHttpError
    ) {
      try {
        const response =
          await error.context
            .json();

        const customError =
          new Error(
            response?.message ||
              'Administrative access could not be verified.',
          );

        customError.details =
          response;

        throw customError;
      } catch (
        parseError
      ) {
        if (
          parseError?.details
        ) {
          throw parseError;
        }
      }
    }

    throw new Error(
      'Administrative access could not be verified.',
    );
  }

  if (!data?.success) {
    const customError =
      new Error(
        data?.message ||
          'Administrative access could not be verified.',
      );

    customError.details =
      data;

    throw customError;
  }

  return data;
}

export async function getAdminOverview() {
  const [
    customersResult,
    ordersResult,
    paymentsResult,
  ] =
    await Promise.all([
      supabase
        .from('customers')
        .select(
          'id',
          {
            count: 'exact',
          },
        ),

      supabase
        .from('orders')
        .select(`
          id,
          reference,
          project_title,
          service_slug,
          status,
          payment_status,
          created_at,
          customers (
            full_name,
            email
          )
        `)
        .order(
          'created_at',
          {
            ascending:
              false,
          },
        ),

      supabase
        .from(
          'payment_transactions',
        )
        .select(`
          id,
          amount_kobo,
          currency,
          status
        `),
    ]);

  if (
    customersResult.error
  ) {
    throw customersResult.error;
  }

  if (ordersResult.error) {
    throw ordersResult.error;
  }

  if (
    paymentsResult.error
  ) {
    throw paymentsResult.error;
  }

  const orders =
    ordersResult.data ||
    [];

  const payments =
    paymentsResult.data ||
    [];

  const activeOrders =
    orders.filter(
      (order) =>
        ![
          'completed',
          'cancelled',
        ].includes(
          order.status,
        ),
    ).length;

  const successfulRevenue =
    payments
      .filter(
        (payment) =>
          payment.status ===
          'successful',
      )
      .reduce(
        (
          total,
          payment,
        ) =>
          total +
          Number(
            payment
              .amount_kobo ||
              0,
          ),
        0,
      );

  return {
    customers:
      customersResult.count ||
      0,

    totalOrders:
      orders.length,

    activeOrders,

    successfulRevenue,

    recentOrders:
      orders.slice(
        0,
        8,
      ),
  };
}