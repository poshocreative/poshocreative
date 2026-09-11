import {
  supabase,
} from './supabase';

export function toCsv(
  filename,
  rows,
) {
  if (
    !rows ||
    rows.length ===
      0
  ) {
    return null;
  }

  const headers = Object.keys(
    rows[0],
  );

  const escape = (
    value,
  ) => {
    const text =
      value ===
        null ||
      value ===
        undefined
        ? ''
        : String(
            value,
          );

    return /[",\n]/.test(
      text,
    )
      ? `"${text.replace(
          /"/g,
          '""',
        )}"`
      : text;
  };

  const csv = [
    headers
      .map(
        escape,
      )
      .join(
        ',',
      ),
    ...rows.map(
      (
        row,
      ) =>
        headers
          .map(
            (
              header,
            ) =>
              escape(
                row[
                  header
                ],
              ),
          )
          .join(
            ',',
          ),
    ),
  ].join(
    '\n',
  );

  const blob =
    new Blob(
      [csv],
      {
        type: 'text/csv;charset=utf-8',
      },
    );

  const url =
    URL.createObjectURL(
      blob,
    );

  const link =
    document.createElement(
      'a',
    );

  link.href =
    url;
  link.download =
    filename;

  document.body.appendChild(
    link,
  );
  link.click();
  link.remove();

  window.setTimeout(
    () =>
      URL.revokeObjectURL(
        url,
      ),
    5000,
  );

  return filename;
}

export function nairaKobo(
  kobo,
) {
  return (
    Number(
      kobo ||
        0,
    ) / 100
  );
}

export function formatNaira(
  kobo,
) {
  return new Intl.NumberFormat(
    'en-NG',
    {
      style: 'currency',
      currency: 'NGN',
      maximumFractionDigits:
        0,
    },
  ).format(
    nairaKobo(
      kobo,
    ),
  );
}

export function groupSum(
  rows,
  keyFn,
  valueFn,
) {
  const map = new Map();

  for (const row of rows ||
    []) {
    const key =
      keyFn(
        row,
      ) || 'Unspecified';

    map.set(
      key,
      (map.get(
        key,
      ) || 0) +
        Number(
          valueFn(
            row,
          ) || 0,
        ),
    );
  }

  return [...map.entries()]
    .map(
      ([
        key,
        total,
      ]) => ({
        key,
        total,
      }),
    )
    .sort(
      (
        a,
        b,
      ) =>
        b.total -
        a.total,
    );
}

export function agingBucket(
  daysOverdue,
) {
  if (
    daysOverdue <=
    0
  ) {
    return 'Current';
  }

  if (
    daysOverdue <=
    7
  ) {
    return '1–7 days';
  }

  if (
    daysOverdue <=
    30
  ) {
    return '8–30 days';
  }

  if (
    daysOverdue <=
    60
  ) {
    return '31–60 days';
  }

  if (
    daysOverdue <=
    90
  ) {
    return '61–90 days';
  }

  return '90+ days';
}

export function startOfDay(
  date = new Date(),
) {
  const copy =
    new Date(
      date,
    );

  copy.setHours(
    0,
    0,
    0,
    0,
  );

  return copy;
}

export function addDays(
  date,
  days,
) {
  const copy =
    new Date(
      date,
    );

  copy.setDate(
    copy.getDate() +
      days,
  );

  return copy;
}

export function weekStart(
  date = new Date(),
) {
  const copy =
    startOfDay(
      date,
    );

  const day =
    copy.getDay();

  copy.setDate(
    copy.getDate() -
      day,
  );

  return copy;
}

export function monthKey(
  dateValue,
) {
  const date =
    new Date(
      dateValue,
    );

  if (
    !Number.isFinite(
      date.getTime(),
    )
  ) {
    return 'Unknown';
  }

  return `${date.getFullYear()}-${String(
    date.getMonth() +
      1,
  ).padStart(
    2,
    '0',
  )}`;
}

async function tolerantTable(
  table,
  select,
  limit = 2000,
) {
  try {
    const {
      data,
      error,
    } =
      await supabase
        .from(
          table,
        )
        .select(
          select,
        )
        .limit(
          limit,
        );

    if (error) {
      throw error;
    }

    return data || [];
  } catch {
    return [];
  }
}

export async function getReportData() {
  const [
    orders,
    payments,
    costs,
    timeEntries,
    tasks,
    leads,
    proposals,
    requests,
    members,
    feedback,
  ] =
    await Promise.all([
      tolerantTable(
        'orders',
        `id,reference,project_title,service_slug,status,payment_status,
        review_decision,quoted_amount_kobo,paid_amount_kobo,deadline,
        created_at,completed_at,customer_id,
        customers (
          id,
          full_name,
          email,
          business_name
        )`,
      ),
      tolerantTable(
        'payment_transactions',
        'id,amount_kobo,status,payment_method,created_at,order_id',
      ),
      tolerantTable(
        'internal_costs',
        'id,order_id,amount_kobo,category,incurred_at',
      ),
      tolerantListSafe(
        'time_entries',
      ),
      tolerantListSafe(
        'project_tasks',
      ),
      tolerantListSafe(
        'leads',
      ),
      tolerantListSafe(
        'proposals',
      ),
      tolerantListSafe(
        'service_requests',
      ),
      tolerantListSafe(
        'team_members',
      ),
      tolerantListSafe(
        'project_feedback',
      ),
    ]);

  return {
    orders,
    payments,
    costs,
    timeEntries,
    tasks,
    leads,
    proposals,
    requests,
    members,
    feedback,
  };
}

async function tolerantListSafe(
  table,
) {
  try {
    const {
      data,
      error,
    } =
      await supabase
        .from(
          table,
        )
        .select('*')
        .limit(
          2000,
        );

    if (error) {
      throw error;
    }

    return data || [];
  } catch {
    return [];
  }
}
