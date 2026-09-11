import {
  FunctionsHttpError,
} from '@supabase/supabase-js';

import {
  supabase,
} from './supabase';

async function operationsError(
  error,
  fallback,
) {
  if (
    error instanceof
    FunctionsHttpError
  ) {
    try {
      const body =
        await error.context.json();

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

export async function runOperationsAction(
  body,
) {
  const {
    data,
    error,
  } =
    await supabase.functions.invoke(
      'operations-action',
      {
        body,
      },
    );

  if (error) {
    throw await operationsError(
      error,
      'The operation could not be completed.',
    );
  }

  if (!data?.success) {
    throw new Error(
      data?.message ||
        'The operation could not be completed.',
    );
  }

  return data;
}

async function tolerantList(
  table,
  select,
  orderBy,
  limit = 500,
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

    if (orderBy) {
      query = query.order(
        orderBy.column,
        {
          ascending:
            orderBy.ascending ??
            false,
        },
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

    return data || [];
  } catch (error) {
    if (
      error?.code ===
        '42P01' ||
      String(
        error?.message ||
          '',
      ).includes(
        'does not exist',
      )
    ) {
      return [];
    }

    throw error;
  }
}

export async function getRequests(
  {
    status = null,
  } = {},
) {
  const rows =
    await tolerantList(
      'service_requests',
      `
        *,
        customer:customers (
          id,
          full_name,
          email,
          business_name
        ),
        assignee:team_members (
          id,
          display_name
        )
      `,
      {
        column:
          'created_at',
      },
    );

  if (
    status &&
    status !==
      'all'
  ) {
    if (
      status ===
      'overdue'
    ) {
      const today =
        new Date()
          .toISOString()
          .slice(
            0,
            10,
          );

      return rows.filter(
        (
          request,
        ) =>
          request.due_date &&
          request.due_date <
            today &&
          ![
            'completed',
            'cancelled',
          ].includes(
            request.status,
          ),
      );
    }

    if (
      status ===
      'unassigned'
    ) {
      return rows.filter(
        (
          request,
        ) =>
          !request.assignee_id &&
          ![
            'completed',
            'cancelled',
          ].includes(
            request.status,
          ),
      );
    }

    if (
      status ===
      'mine'
    ) {
      return rows;
    }

    return rows.filter(
      (
        request,
      ) =>
        request.status ===
        status,
    );
  }

  return rows;
}

export async function getRequestDetail(
  id,
) {
  const {
    data: request,
    error,
  } =
    await supabase
      .from(
        'service_requests',
      )
      .select(`
        *,
        customer:customers (
          id,
          full_name,
          email,
          phone,
          business_name
        )
      `)
      .eq(
        'id',
        id,
      )
      .maybeSingle();

  if (error) {
    throw error;
  }

  if (!request) {
    return null;
  }

  const {
    data: comments,
  } =
    await supabase
      .from(
        'request_comments',
      )
      .select('*')
      .eq(
        'request_id',
        id,
      )
      .order(
        'created_at',
        {
          ascending:
            true,
        },
      );

  return {
    request,
    comments:
      comments ||
      [],
  };
}

export async function getRetainers() {
  const retainers =
    await tolerantList(
      'retainers',
      `
        *,
        customer:customers (
          id,
          full_name,
          email,
          business_name
        )
      `,
      {
        column:
          'created_at',
      },
    );

  const periods =
    await tolerantList(
      'retainer_periods',
      '*',
      {
        column:
          'period_start',
      },
    );

  const byRetainer = new Map();

  for (const period of periods) {
    if (
      !byRetainer.has(
        period.retainer_id,
      )
    ) {
      byRetainer.set(
        period.retainer_id,
        [],
      );
    }

    byRetainer
      .get(
        period.retainer_id,
      )
      .push(
        period,
      );
  }

  return retainers.map(
    (
      retainer,
    ) => ({
      ...retainer,
      periods:
        byRetainer.get(
          retainer.id,
        ) || [],
    }),
  );
}

export async function getOrganizations() {
  const orgs =
    await tolerantList(
      'organizations',
      '*',
      {
        column:
          'created_at',
      },
    );

  const members =
    await tolerantList(
      'organization_members',
      `
        *,
        customer:customers (
          id,
          full_name,
          email,
          business_name
        )
      `,
      {
        column:
          'created_at',
      },
    );

  const byOrg = new Map();

  for (const member of members) {
    if (
      !byOrg.has(
        member.organization_id,
      )
    ) {
      byOrg.set(
        member.organization_id,
        [],
      );
    }

    byOrg
      .get(
        member.organization_id,
      )
      .push(
        member,
      );
  }

  return orgs.map(
    (
      org,
    ) => ({
      ...org,
      members:
        byOrg.get(
          org.id,
        ) || [],
    }),
  );
}

export async function getTeamMembers() {
  const members =
    await tolerantList(
      'team_members',
      'id,display_name,role,status',
      {
        column:
          'created_at',
      },
    );

  return members.filter(
    (
      member,
    ) =>
      member.status ===
      'active',
  );
}

export async function getTeam() {  const members =
    await tolerantList(
      'team_members',
      '*',
      {
        column:
          'created_at',
      },
    );

  const [
    allocations,
    timeEntries,
    tasks,
    dependencies,
  ] =
    await Promise.all([
      tolerantList(
        'resource_allocations',
        '*',
        {
          column:
            'week_start',
        },
        1000,
      ),
      tolerantList(
        'time_entries',
        '*',
        {
          column:
            'entry_date',
        },
        2000,
      ),
      tolerantList(
        'project_tasks',
        `*,
        order:orders (
          id,
          reference,
          project_title,
          status
        ),
        milestone:project_milestones (
          id,
          title
        ),
        assignee:team_members (
          id,
          display_name
        )`,
        {
          column:
            'created_at',
        },
        2000,
      ),
      tolerantList(
        'task_dependencies',
        '*',
        null,
        2000,
      ),
    ]);

  return {
    members,
    allocations,
    timeEntries,
    tasks,
    dependencies,
  };
}

export async function getAutomations() {
  const rules =
    await tolerantList(
      'automations',
      '*',
      {
        column:
          'created_at',
      },
    );

  const runs =
    await tolerantList(
      'automation_runs',
      '*',
      {
        column:
          'created_at',
      },
      200,
    );

  return {
    rules,
    runs,
  };
}

export async function getKnowledge() {
  const sops =
    await tolerantList(
      'sop_articles',
      '*',
      {
        column:
          'created_at',
      },
    );

  let settings = [];

  try {
    const {
      data,
      error,
    } =
      await supabase
        .from(
          'business_settings',
        )
        .select('*');

    if (error) {
      throw error;
    }

    settings =
      data || [];
  } catch (error) {
    if (
      error?.code !==
        '42P01'
    ) {
      throw error;
    }
  }

  let flags = [];

  try {
    const {
      data,
      error,
    } =
      await supabase
        .from(
          'feature_flags',
        )
        .select('*');

    if (error) {
      throw error;
    }

    flags =
      data || [];
  } catch (error) {
    if (
      error?.code !==
        '42P01'
    ) {
      throw error;
    }
  }

  return {
    sops,
    settings,
    flags,
  };
}

export async function getActivityFeed(
  {
    limit = 120,
  } = {},
) {
  const [
    adminActivity,
    notifications,
    leadActivity,
  ] =
    await Promise.all([
      tolerantList(
        'admin_activity_log',
        '*',
        {
          column:
            'created_at',
        },
        limit,
      ),
      tolerantList(
        'notification_events',
        '*',
        {
          column:
            'created_at',
        },
        limit,
      ),
      tolerantList(
        'lead_activity',
        '*',
        {
          column:
            'created_at',
        },
        limit,
      ),
    ]);

  const feed = [
    ...adminActivity.map(
      (
        item,
      ) => ({
        kind: 'admin',
        at: item.created_at,
        title:
          item.description ||
          item.action,
        detail:
          item.action,
        orderId:
          item.order_id,
        raw: item,
      }),
    ),
    ...notifications.map(
      (
        item,
      ) => ({
        kind: 'notification',
        at: item.created_at,
        title:
          item.event_type,
        detail:
          item.channel,
        orderId:
          item.order_id,
        raw: item,
      }),
    ),
    ...leadActivity.map(
      (
        item,
      ) => ({
        kind: 'sales',
        at: item.created_at,
        title:
          item.action,
        detail:
          item.note,
        orderId: null,
        raw: item,
      }),
    ),
  ]
    .filter(
      (
        item,
      ) => Boolean(
        item.at,
      ),
    )
    .sort(
      (
        a,
        b,
      ) =>
        new Date(
          b.at,
        ).getTime() -
        new Date(
          a.at,
        ).getTime(),
    );

  return feed.slice(
    0,
    limit,
  );
}

export async function getInboxStates() {
  const rows =
    await tolerantList(
      'ops_inbox_state',
      '*',
      null,
      500,
    );

  const map = new Map();

  for (const row of rows) {
    map.set(
      row.item_key,
      row,
    );
  }

  return map;
}

export async function getMeetingsForOrder(
  orderId,
) {  if (!orderId) {
    return [];
  }

  try {
    const {
      data,
      error,
    } =
      await supabase
        .from(
          'meetings',
        )
        .select('*')
        .eq(
          'order_id',
          orderId,
        )
        .order(
          'scheduled_at',
          {
            ascending:
              false,
          },
        );

    if (error) {
      throw error;
    }

    return data || [];
  } catch (error) {
    if (
      error?.code ===
      '42P01'
    ) {
      return [];
    }

    throw error;
  }
}

const ORDER_REF = `
  order:orders (
    id,
    reference,
    project_title,
    deadline,
    status,
    customer_id
  )
`;

export async function getOpsSnapshot() {
  const [
    revisions,
    changes,
    deliverables,
    requests,
    leads,
    payments,
    files,
  ] =
    await Promise.all([
      tolerantList(
        'revision_requests',
        `id,order_id,description,status,created_at,${ORDER_REF}`,
        {
          column:
            'created_at',
        },
        200,
      ),
      tolerantList(
        'change_requests',
        `id,order_id,title,status,additional_cost_kobo,created_at,${ORDER_REF}`,
        {
          column:
            'created_at',
        },
        200,
      ),
      tolerantList(
        'project_deliverables',
        `id,order_id,title,client_approval_state,status,created_at,${ORDER_REF}`,
        {
          column:
            'created_at',
        },
        200,
      ),
      tolerantList(
        'service_requests',
        `id,reference,title,status,priority,due_date,customer_id,order_id,created_at,
        customer:customers (
          full_name,
          email
        )`,
        {
          column:
            'created_at',
        },
        200,
      ),
      tolerantList(
        'leads',
        'id,reference,name,company,stage,next_action,next_action_due,created_at',
        {
          column:
            'created_at',
        },
        200,
      ),
      tolerantList(
        'payment_transactions',
        'id,provider_reference,amount_kobo,status,attempt_stage,created_at,order_id',
        {
          column:
            'created_at',
        },
        300,
      ),
      tolerantList(
        'order_files',
        'id,order_id,original_name,upload_status,created_at',
        {
          column:
            'created_at',
        },
        100,
      ),
    ]);

  return {
    revisions,
    changes,
    deliverables,
    requests,
    leads,
    payments,
    files,
  };
}
