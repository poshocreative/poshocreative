import {
  FunctionsHttpError,
} from '@supabase/supabase-js';

import {
  supabase,
} from './supabase';

async function clientError(
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

export async function runClientProjectAction(
  body,
) {
  const {
    data,
    error,
  } =
    await supabase.functions.invoke(
      'client-project-action',
      {
        body,
      },
    );

  if (error) {
    throw await clientError(
      error,
      'This action could not be completed.',
    );
  }

  if (!data?.success) {
    throw new Error(
      data?.message ||
        'This action could not be completed.',
    );
  }

  return data;
}

export async function getMyRequests() {
  const {
    data: {
      user,
    },
  } =
    await supabase.auth.getUser();

  if (!user) {
    return [];
  }

  const {
    data: customer,
  } =
    await supabase
      .from(
        'customers',
      )
      .select(
        'id',
      )
      .eq(
        'user_id',
        user.id,
      )
      .maybeSingle();

  if (!customer) {
    return [];
  }

  const {
    data,
    error,
  } =
    await supabase
      .from(
        'service_requests',
      )
      .select(`
        *,
        comments:request_comments (
          id,
          body,
          author_kind,
          internal,
          created_at
        )
      `)
      .eq(
        'customer_id',
        customer.id,
      )
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

  return (data || []).map(
    (
      request,
    ) => ({
      ...request,
      comments: (
        request.comments ||
        []
      ).filter(
        (
          comment,
        ) =>
          comment.internal !==
          true,
      ),
    }),
  );
}

export async function getMyProposals() {
  const {
    data,
    error,
  } =
    await supabase
      .from(
        'proposals',
      )
      .select(`
        *,
        items:proposal_items (
          id,
          title,
          description,
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
      .limit(50);

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

export async function getMyAgreements() {
  const {
    data,
    error,
  } =
    await supabase
      .from(
        'agreements',
      )
      .select(
        'id,order_id,title,body,version,status,accepted_at,created_at',
      )
      .order(
        'created_at',
        {
          ascending:
            false,
        },
      )
      .limit(50);

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

export async function getMyRetainers() {
  const {
    data,
    error,
  } =
    await supabase
      .from(
        'retainers',
      )
      .select(`
        *,
        periods:retainer_periods (
          id,
          period_start,
          period_end,
          included_minutes,
          used_minutes,
          requests_total,
          requests_completed,
          revenue_kobo,
          status
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

export async function getMyOrganization() {
  const {
    data: {
      user,
    },
  } =
    await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const {
    data: customer,
  } =
    await supabase
      .from(
        'customers',
      )
      .select(
        'id',
      )
      .eq(
        'user_id',
        user.id,
      )
      .maybeSingle();

  if (!customer) {
    return null;
  }

  const {
    data: memberships,
    error,
  } =
    await supabase
      .from(
        'organization_members',
      )
      .select(`
        *,
        organization:organizations (
          id,
          name
        )
      `)
      .eq(
        'customer_id',
        customer.id,
      );

  if (error) {
    if (
      error.code ===
      '42P01'
    ) {
      return null;
    }

    throw error;
  }

  if (
    !memberships ||
    memberships.length ===
      0
  ) {
    return null;
  }

  return memberships[0];
}

export async function getVersionAnnotations(
  versionId,
) {
  if (!versionId) {
    return [];
  }

  const {
    data,
    error,
  } =
    await supabase
      .from(
        'proof_annotations',
      )
      .select('*')
      .eq(
        'version_id',
        versionId,
      )
      .order(
        'created_at',
        {
          ascending:
            true,
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

export async function getMyMeetings() {
  const {
    data,
    error,
  } =
    await supabase
      .from(
        'meetings',
      )
      .select('*')
      .order(
        'scheduled_at',
        {
          ascending:
            true,
        },
      )
      .limit(50);

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
