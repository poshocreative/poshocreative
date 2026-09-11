import {
  FunctionsHttpError,
} from '@supabase/supabase-js';

import {
  supabase,
} from './supabase';

async function salesError(
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

export async function runSalesAction(
  body,
) {
  const {
    data,
    error,
  } =
    await supabase.functions.invoke(
      'sales-action',
      {
        body,
      },
    );

  if (error) {
    throw await salesError(
      error,
      'The sales action could not be completed.',
    );
  }

  if (!data?.success) {
    throw new Error(
      data?.message ||
        'The sales action could not be completed.',
    );
  }

  return data;
}

export async function getLeads(
  {
    includeArchived = false,
  } = {},
) {
  let query =
    supabase
      .from(
        'leads',
      )
      .select(`
        *,
        owner:team_members (
          id,
          display_name
        )
      `)
      .order(
        'created_at',
        {
          ascending:
            false,
        },
      )
      .limit(500);

  if (!includeArchived) {
    query = query.is(
      'archived_at',
      null,
    );
  }

  const {
    data,
    error,
  } =
    await query;

  if (error) {
    if (
      error.code ===
      '42P01'
    ) {
      return [];
    }

    throw error;
  }

  return data || [];
}

export async function getLeadDetail(
  id,
) {
  const {
    data: lead,
    error,
  } =
    await supabase
      .from(
        'leads',
      )
      .select(`
        *,
        owner:team_members (
          id,
          display_name
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

  if (!lead) {
    return null;
  }

  const [
    activity,
    proposals,
    meetings,
  ] =
    await Promise.all([
      supabase
        .from(
          'lead_activity',
        )
        .select('*')
        .eq(
          'lead_id',
          id,
        )
        .order(
          'created_at',
          {
            ascending:
              false,
          },
        )
        .limit(50),
      supabase
        .from(
          'proposals',
        )
        .select(
          'id,number,title,total_kobo,status,version,valid_until,created_at',
        )
        .eq(
          'lead_id',
          id,
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
          'meetings',
        )
        .select('*')
        .eq(
          'lead_id',
          id,
        )
        .order(
          'scheduled_at',
          {
            ascending:
              false,
          },
        )
        .limit(20),
    ]);

  return {
    lead,
    activity:
      activity.data ||
      [],
    proposals:
      proposals.data ||
      [],
    meetings:
      meetings.data ||
      [],
  };
}

export async function getProposals(
  {
    status = null,
  } = {},
) {
  let query =
    supabase
      .from(
        'proposals',
      )
      .select(`
        *,
        items:proposal_items (
          id,
          title,
          quantity,
          unit_price_kobo,
          amount_kobo,
          sort_order
        )
      `)
      .order(
        'created_at',
        {
          ascending:
            false,
        },
      )
      .limit(300);

  if (status) {
    query = query.eq(
      'status',
      status,
    );
  }

  const {
    data,
    error,
  } =
    await query;

  if (error) {
    if (
      error.code ===
      '42P01'
    ) {
      return [];
    }

    throw error;
  }

  return (data || []).map(
    (
      proposal,
    ) => ({
      ...proposal,
      items: [
        ...(proposal.items ||
          []),
      ].sort(
        (
          a,
          b,
        ) =>
          (a.sort_order ||
            0) -
          (b.sort_order ||
            0),
      ),
    }),
  );
}

export async function getServicesHub() {
  const [
    catalog,
    packages,
    intake,
    templates,
  ] =
    await Promise.all([
      supabase
        .from(
          'service_catalog',
        )
        .select('*')
        .order(
          'sort_order',
        ),
      supabase
        .from(
          'service_packages',
        )
        .select('*')
        .order(
          'sort_order',
        )
        .then(
          (
            result,
          ) => result,
          () => ({
            data: [],
          }),
        ),
      supabase
        .from(
          'service_intake_fields',
        )
        .select('*')
        .order(
          'sort_order',
        )
        .then(
          (
            result,
          ) => result,
          () => ({
            data: [],
          }),
        ),
      supabase
        .from(
          'service_milestone_templates',
        )
        .select('*')
        .order(
          'sequence',
        )
        .then(
          (
            result,
          ) => result,
          () => ({
            data: [],
          }),
        ),
    ]);

  if (catalog.error) {
    throw catalog.error;
  }

  return {
    catalog:
      catalog.data ||
      [],
    packages:
      packages.data ||
      [],
    intakeFields:
      intake.data ||
      [],
    milestoneTemplates:
      templates.data ||
      [],
  };
}

export async function getAgreementTemplates() {
  const {
    data,
    error,
  } =
    await supabase
      .from(
        'agreement_templates',
      )
      .select('*')
      .order(
        'created_at',
        {
          ascending:
            false,
        },
      );

  if (error) {
    if (
      error.code ===
      '42P01'
    ) {
      return [];
    }

    throw error;
  }

  return data || [];
}

export async function getMeetings(
  {
    upcomingOnly = false,
  } = {},
) {
  let query =
    supabase
      .from(
        'meetings',
      )
      .select(`
        *,
        lead:leads (
          id,
          name,
          company
        )
      `)
      .order(
        'scheduled_at',
        {
          ascending:
            true,
        },
      )
      .limit(200);

  if (upcomingOnly) {
    query = query
      .gte(
        'scheduled_at',
        new Date()
          .toISOString(),
      )
      .eq(
        'status',
        'scheduled',
      );
  }

  const {
    data,
    error,
  } =
    await query;

  if (error) {
    if (
      error.code ===
      '42P01'
    ) {
      return [];
    }

    throw error;
  }

  return data || [];
}
