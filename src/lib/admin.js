import {
  FunctionsHttpError,
} from '@supabase/supabase-js';

import {
  supabase,
} from './supabase';

async function actionError(
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

export async function getAdminAccessState() {
  const [
    account,
    access,
  ] =
    await Promise.all([
      supabase.rpc(
        'is_admin_account',
      ),

      supabase.rpc(
        'has_admin_access',
      ),
    ]);

  if (account.error) {
    throw account.error;
  }

  if (access.error) {
    throw access.error;
  }

  return {
    isAdminAccount:
      account.data ===
      true,

    hasAccess:
      access.data ===
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
    throw await actionError(
      error,
      'Administrative access could not be verified.',
    );
  }

  if (!data?.success) {
    const custom =
      new Error(
        data?.message ||
          'Administrative access could not be verified.',
      );

    custom.details =
      data;

    throw custom;
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
        .from(
          'customers',
        )
        .select(
          'id',
          {
            count:
              'exact',
          },
        ),

      supabase
        .from(
          'orders',
        )
        .select(`
          id,
          reference,
          project_title,
          service_slug,
          project_type,
          status,
          payment_status,
          review_decision,
          decline_reason,
          quoted_amount_kobo,
          paid_amount_kobo,
          customer_action_required,
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
          status
        `),
    ]);

  if (
    customersResult.error
  ) {
    throw customersResult.error;
  }

  if (
    ordersResult.error
  ) {
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

  const pendingReview =
    orders.filter(
      (order) =>
        order
          .review_decision ===
        'pending',
    ).length;

  const approved =
    orders.filter(
      (order) =>
        order
          .review_decision ===
        'approved',
    ).length;

  const declined =
    orders.filter(
      (order) =>
        order
          .review_decision ===
        'declined',
    ).length;

  const activeProjects =
    orders.filter(
      (order) =>
        order
          .review_decision ===
          'approved' &&
        ![
          'completed',
          'cancelled',
        ].includes(
          order.status,
        ),
    ).length;

  const awaitingPayment =
    orders.filter(
      (order) =>
        order
          .review_decision ===
          'approved' &&
        order.status ===
          'awaiting_payment',
    ).length;

  const revenue =
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

  const outstanding =
    orders
      .filter(
        (order) =>
          order
            .review_decision ===
          'approved',
      )
      .reduce(
        (
          total,
          order,
        ) =>
          total +
          Math.max(
            Number(
              order
                .quoted_amount_kobo ||
                0,
            ) -
              Number(
                order
                  .paid_amount_kobo ||
                  0,
              ),
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

    pendingReview,
    approved,
    declined,
    activeProjects,
    awaitingPayment,
    revenue,
    outstanding,

    recentOrders:
      orders.slice(
        0,
        10,
      ),

    pendingOrders:
      orders
        .filter(
          (order) =>
            order
              .review_decision ===
            'pending',
        )
        .slice(
          0,
          6,
        ),
  };
}

export async function getAdminOrders() {
  const {
    data,
    error,
  } =
    await supabase
      .from(
        'orders',
      )
      .select(`
        id,
        reference,
        project_title,
        service_slug,
        project_type,
        status,
        payment_status,
        review_decision,
        decline_reason,
        reviewed_at,
        requires_quote,
        quoted_amount_kobo,
        paid_amount_kobo,
        customer_action_required,
        created_at,
        customers (
          id,
          full_name,
          email,
          phone,
          business_name
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

export async function getAdminOrder(
  reference,
) {
  const {
    data: order,
    error,
  } =
    await supabase
      .from(
        'orders',
      )
      .select(`
        *,
        customers (
          id,
          full_name,
          email,
          phone,
          business_name,
          preferred_contact_method
        )
      `)
      .eq(
        'reference',
        reference,
      )
      .maybeSingle();

  if (error) {
    throw error;
  }

  if (!order) {
    return null;
  }

  const [
    quotes,
    notes,
    files,
    payments,
    history,
    costs,
  ] =
    await Promise.all([
      supabase
        .from(
          'order_quotes',
        )
        .select('*')
        .eq(
          'order_id',
          order.id,
        )
        .order(
          'created_at',
          {
            ascending:
              false,
          },
        ),

      supabase
        .from(
          'order_notes',
        )
        .select('*')
        .eq(
          'order_id',
          order.id,
        )
        .order(
          'created_at',
          {
            ascending:
              false,
          },
        ),

      supabase
        .from(
          'order_files',
        )
        .select('*')
        .eq(
          'order_id',
          order.id,
        )
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
        .select('*')
        .eq(
          'order_id',
          order.id,
        )
        .order(
          'created_at',
          {
            ascending:
              false,
          },
        ),

      supabase
        .from(
          'order_status_history',
        )
        .select('*')
        .eq(
          'order_id',
          order.id,
        )
        .order(
          'created_at',
          {
            ascending:
              false,
          },
        ),

      supabase
        .from(
          'project_cost_items',
        )
        .select('*')
        .eq(
          'order_id',
          order.id,
        )
        .order(
          'created_at',
          {
            ascending:
              false,
          },
        ),
    ]);

  return {
    ...order,

    quotes:
      quotes.data ||
      [],

    notes:
      notes.data ||
      [],

    files:
      files.data ||
      [],

    payments:
      payments.data ||
      [],

    history:
      history.data ||
      [],

    costs:
      costs.data ||
      [],
  };
}

export async function runAdminOrderAction(
  body,
) {
  const {
    data,
    error,
  } =
    await supabase.functions
      .invoke(
        'admin-order-action',
        {
          body,
        },
      );

  if (error) {
    throw await actionError(
      error,
      'The requested action could not be completed.',
    );
  }

  if (!data?.success) {
    throw new Error(
      data?.message ||
        'The requested action could not be completed.',
    );
  }

  return data;
}

export async function getAdminCustomers() {
  const {
    data,
    error,
  } =
    await supabase
      .from(
        'customers',
      )
      .select(`
        id,
        full_name,
        email,
        phone,
        business_name,
        created_at,
        orders (
          id,
          status,
          review_decision,
          quoted_amount_kobo,
          paid_amount_kobo
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

export async function getAdminPayments() {
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
        provider,
        provider_reference,
        provider_transaction_id,
        payment_method,
        amount_kobo,
        currency,
        status,
        verified_at,
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

export async function getAdminQuotes() {
  const {
    data,
    error,
  } =
    await supabase
      .from(
        'order_quotes',
      )
      .select(`
        id,
        amount_kobo,
        currency,
        status,
        message,
        valid_until,
        sent_at,
        created_at,
        orders (
          reference,
          project_title,
          customers (
            full_name,
            email
          )
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

export async function getAdminCatalog() {
  const {
    data,
    error,
  } =
    await supabase
      .from(
        'service_catalog',
      )
      .select('*')
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

export async function updateCatalogItem(
  id,
  patch,
) {
  const {
    data,
    error,
  } =
    await supabase
      .from(
        'service_catalog',
      )
      .update(
        patch,
      )
      .eq(
        'id',
        id,
      )
      .select()
      .single();

  if (error) {
    throw error;
  }

  return data;
}
