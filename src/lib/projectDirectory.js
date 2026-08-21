import {
  supabase,
} from './supabase';

export async function getProjectDirectory() {
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
        service_slug,
        project_type,
        project_title,
        project_description,
        project_goal,
        budget,
        timeline,
        deadline,
        status,
        payment_status,
        review_decision,
        reviewed_at,
        decline_reason,
        quoted_amount_kobo,
        paid_amount_kobo,
        customer_action_required,
        customer_action_label,
        progress_percent,
        progress_label,
        progress_message,
        progress_updated_at,
        submitted_at,
        created_at,
        updated_at
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

export function getProjectBalance(
  order,
) {
  const quoted =
    Number(
      order
        ?.quoted_amount_kobo ||
        0,
    );

  const paid =
    Number(
      order
        ?.paid_amount_kobo ||
        0,
    );

  return Math.max(
    quoted -
      paid,
    0,
  );
}

export function getProjectProgressPercent(
  order,
) {
  const value =
    Number(
      order
        ?.progress_percent ??
        0,
    );

  if (
    !Number.isFinite(
      value,
    )
  ) {
    return 0;
  }

  return Math.min(
    100,
    Math.max(
      0,
      Math.round(
        value,
      ),
    ),
  );
}

export function getProjectDirectoryState(
  order,
) {
  if (
    order
      ?.review_decision ===
    'pending'
  ) {
    return {
      key:
        'review',

      label:
        'In Review',
    };
  }

  if (
    order
      ?.review_decision ===
    'declined'
  ) {
    return {
      key:
        'declined',

      label:
        'Declined',
    };
  }

  if (
    order?.status ===
    'completed'
  ) {
    return {
      key:
        'completed',

      label:
        'Completed',
    };
  }

  if (
    order?.status ===
    'cancelled'
  ) {
    return {
      key:
        'cancelled',

      label:
        'Closed',
    };
  }

  if (
    order
      ?.customer_action_required
  ) {
    return {
      key:
        'attention',

      label:
        'Needs Your Attention',
    };
  }

  if (
    order
      ?.review_decision ===
    'approved'
  ) {
    return {
      key:
        'active',

      label:
        'Active',
    };
  }

  return {
    key:
      'neutral',

    label:
      'Project',
  };
}

export function projectMatchesFilter(
  order,
  filter,
) {
  if (
    filter ===
    'all'
  ) {
    return true;
  }

  if (
    filter ===
    'review'
  ) {
    return (
      order
        .review_decision ===
      'pending'
    );
  }

  if (
    filter ===
    'active'
  ) {
    return (
      order
        .review_decision ===
        'approved' &&
      ![
        'completed',
        'cancelled',
      ].includes(
        order.status,
      )
    );
  }

  if (
    filter ===
    'attention'
  ) {
    return (
      order
        .review_decision ===
        'approved' &&
      Boolean(
        order
          .customer_action_required,
      )
    );
  }

  if (
    filter ===
    'completed'
  ) {
    return (
      order.status ===
        'completed' &&
      order
        .review_decision ===
        'approved'
    );
  }

  if (
    filter ===
    'declined'
  ) {
    return (
      order
        .review_decision ===
      'declined'
    );
  }

  return true;
}

export function sortProjects(
  rows,
  sort,
) {
  const projects =
    [
      ...rows,
    ];

  if (
    sort ===
    'oldest'
  ) {
    return projects.sort(
      (
        first,
        second,
      ) =>
        new Date(
          first.created_at,
        ) -
        new Date(
          second.created_at,
        ),
    );
  }

  if (
    sort ===
    'deadline'
  ) {
    return projects.sort(
      (
        first,
        second,
      ) => {
        if (
          !first.deadline &&
          !second.deadline
        ) {
          return (
            new Date(
              second.created_at,
            ) -
            new Date(
              first.created_at,
            )
          );
        }

        if (
          !first.deadline
        ) {
          return 1;
        }

        if (
          !second.deadline
        ) {
          return -1;
        }

        return (
          new Date(
            first.deadline,
          ) -
          new Date(
            second.deadline,
          )
        );
      },
    );
  }

  if (
    sort ===
    'progress'
  ) {
    return projects.sort(
      (
        first,
        second,
      ) =>
        getProjectProgressPercent(
          second,
        ) -
        getProjectProgressPercent(
          first,
        ),
    );
  }

  return projects.sort(
    (
      first,
      second,
    ) =>
      new Date(
        second.created_at,
      ) -
      new Date(
        first.created_at,
      ),
  );
}