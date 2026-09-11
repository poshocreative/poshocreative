import {
  supabase,
} from './supabase';

async function safeQuery(
  table,
  select,
  search,
  columns,
  limit = 8,
) {
  try {
    let query = supabase
      .from(
        table,
      )
      .select(
        select,
      )
      .limit(
        limit,
      );

    if (
      search &&
      columns.length >
        0
    ) {
      query = query.or(
        columns
          .map(
            (
              column,
            ) =>
              `${column}.ilike.%${search.replace(/[%_,]/g, '')}%`,
          )
          .join(
            ',',
          ),
      );
    } else {
      return [];
    }

    const {
      data,
      error,
    } =
      await query;

    if (error) {
      throw error;
    }

    return data || [];
  } catch {
    return [];
  }
}

export async function globalSearch(
  term,
) {
  const query =
    String(
      term ||
        '',
    ).trim();

  if (
    query.length <
    2
  ) {
    return {
      projects: [],
      clients: [],
      finance: [],
      requests: [],
      leads: [],
    };
  }

  const [
    projects,
    clients,
    payments,
    requests,
    leads,
  ] =
    await Promise.all([
      safeQuery(
        'orders',
        'id,reference,project_title,service_slug,status',
        query,
        [
          'reference',
          'project_title',
        ],
      ),
      safeQuery(
        'customers',
        'id,full_name,email,phone,business_name',
        query,
        [
          'full_name',
          'email',
          'phone',
          'business_name',
        ],
      ),
      safeQuery(
        'payment_transactions',
        'id,provider_reference,amount_kobo,status,order_id',
        query,
        [
          'provider_reference',
        ],
      ),
      safeQuery(
        'service_requests',
        'id,reference,title,status,customer_id',
        query,
        [
          'reference',
          'title',
        ],
      ),
      safeQuery(
        'leads',
        'id,reference,name,company,email,stage',
        query,
        [
          'reference',
          'name',
          'company',
          'email',
        ],
      ),
    ]);

  // Quotes live with orders; surface matching quotes under finance.
  const quotes =
    await (async () => {
      try {
        const {
          data,
        } =
          await supabase
            .from(
              'order_quotes',
            )
            .select(
              'id,amount_kobo,status,order_id,orders(reference,project_title)',
            )
            .limit(
              200,
            );

        const needle =
          query.toLowerCase();

        return (
          data ||
          []
        )
          .filter(
            (
              quote,
            ) =>
              String(
                quote.id ||
                  '',
              )
                .toLowerCase()
                .includes(
                  needle,
                ) ||
              String(
                quote.orders
                  ?.reference ||
                  '',
              )
                .toLowerCase()
                .includes(
                  needle,
                ),
          )
          .slice(
            0,
            8,
          );
      } catch {
        return [];
      }
    })();

  return {
    projects,
    clients,
    finance: [
      ...payments.map(
        (
          payment,
        ) => ({
          kind: 'payment',
          ...payment,
        }),
      ),
      ...quotes.map(
        (
          quote,
        ) => ({
          kind: 'quote',
          ...quote,
        }),
      ),
    ],
    requests,
    leads,
  };
}
