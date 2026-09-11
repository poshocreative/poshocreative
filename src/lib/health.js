export const HEALTH_LEVELS = [
  'healthy',
  'attention',
  'at_risk',
  'critical',
];

function daysUntil(
  dateValue,
) {
  if (!dateValue) {
    return null;
  }

  const target =
    new Date(
      dateValue,
    ).getTime();

  if (
    !Number.isFinite(
      target,
    )
  ) {
    return null;
  }

  return Math.ceil(
    (
      target -
      Date.now()
    ) /
      86400000,
  );
}

export function scoreProjectHealth(
  order,
  {
    tasks = [],
    revisions = [],
    changes = [],
    timeEntries = [],
  } = {},
) {
  const reasons = [];
  let score = 0;

  const push = (
    points,
    reason,
  ) => {
    score +=
      points;
    reasons.push(
      reason,
    );
  };

  const outstanding =
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
    );

  // Deadline risk (0-3).
  const days =
    daysUntil(
      order.deadline,
    );

  if (
    days !== null &&
    ![
      'completed',
      'cancelled',
    ].includes(
      order.status,
    )
  ) {
    if (
      days < 0
    ) {
      push(
        3,
        `Deadline passed ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago`,
      );
    } else if (
      days <=
      3
    ) {
      push(
        2,
        `Deadline in ${days} day${days === 1 ? '' : 's'}`,
      );
    } else if (
      days <=
      7
    ) {
      push(
        1,
        `Deadline in ${days} days`,
      );
    }
  }

  // Blocked work (0-2).
  const blocked = tasks.filter(
    (
      task,
    ) =>
      [
        'blocked',
        'waiting_on_client',
      ].includes(
        task.status,
      ),
  );

  if (
    blocked.length >
    0
  ) {
    push(
      blocked.length >=
        3
        ? 2
        : 1,
      `${blocked.length} blocked task${blocked.length === 1 ? '' : 's'} (${blocked
        .slice(
          0,
          2,
        )
        .map(
          (
            task,
          ) => task.title,
        )
        .join(
          '; ',
        )}${blocked.length > 2 ? '…' : ''})`,
    );
  }

  // Overdue client action (0-2).
  if (
    order.customer_action_required
  ) {
    push(
      1,
      'Waiting on client action',
    );
  }

  // Payment risk (0-3).
  if (
    outstanding > 0 &&
    order.review_decision ===
      'approved'
  ) {
    const dueDate =
      order.payment_due_at ||
      order.deadline;

    const dueDays =
      daysUntil(
        dueDate,
      );

    if (
      dueDays !==
        null &&
      dueDays < 0
    ) {
      push(
        3,
        `Payment overdue by ${Math.abs(dueDays)} day${Math.abs(dueDays) === 1 ? '' : 's'}`,
      );
    } else {
      push(
        1,
        'Balance outstanding',
      );
    }
  }

  // Revision load (0-1).
  const openRevisions =
    revisions.filter(
      (
        revision,
      ) =>
        ![
          'resolved',
          'rejected_out_of_scope',
        ].includes(
          revision.status,
        ),
    );

  if (
    openRevisions.length >=
    3
  ) {
    push(
      1,
      `${openRevisions.length} unresolved revision items`,
    );
  }

  // Unresolved change requests (0-1).
  const openChanges =
    changes.filter(
      (
        change,
      ) =>
        [
          'sent',
          'questioned',
        ].includes(
          change.status,
        ),
    );

  if (
    openChanges.length >
    0
  ) {
    push(
      1,
      `${openChanges.length} change request${openChanges.length === 1 ? '' : 's'} awaiting decision`,
    );
  }

  // Budget burn (0-3): estimated vs tracked minutes.
  const estimated =
    tasks.reduce(
      (
        sum,
        task,
      ) =>
        sum +
        Number(
          task.estimate_minutes ||
            0,
        ),
      0,
    );

  const actual =
    timeEntries.reduce(
      (
        sum,
        entry,
      ) =>
        sum +
        Number(
          entry.minutes ||
            0,
        ),
      0,
    );

  let burn = null;

  if (
    estimated > 0 &&
    actual > 0
  ) {
    burn =
      actual /
      estimated;

    if (
      burn >= 1
    ) {
      push(
        2,
        `Tracked time is ${Math.round(burn * 100)}% of estimate`,
      );
    } else if (
      burn >= 0.8
    ) {
      push(
        1,
        `Tracked time is ${Math.round(burn * 100)}% of estimate`,
      );
    }
  }

  let level =
    'healthy';

  if (
    score >=
    6
  ) {
    level =
      'critical';
  } else if (
    score >=
    3
  ) {
    level =
      'at_risk';
  } else if (
    score >=
    1
  ) {
    level =
      'attention';
  }

  return {
    level,
    score,
    reasons,
    facts: {
      daysUntilDeadline:
        days,
      blockedTasks:
        blocked.length,
      openRevisions:
        openRevisions.length,
      openChanges:
        openChanges.length,
      outstandingKobo:
        outstanding,
      estimatedMinutes:
        estimated,
      actualMinutes:
        actual,
      burn,
    },
  };
}

export const HEALTH_LABELS = {
  healthy:
    'Healthy',
  attention:
    'Attention',
  at_risk:
    'At risk',
  critical:
    'Critical',
};

export function buildExecutiveBrief(
  {
    attentionCount = 0,
    expected7dKobo = 0,
    overdueCount = 0,
    overdueKobo = 0,
    deadlineRiskCount = 0,
    pendingApprovals = 0,
    avgUtilization = null,
  } = {},
) {
  const lines = [];

  if (
    attentionCount >
    0
  ) {
    lines.push(
      `${attentionCount} item${attentionCount === 1 ? '' : 's'} need${attentionCount === 1 ? 's' : ''} attention`,
    );
  }

  if (
    expected7dKobo >
    0
  ) {
    lines.push(
      'collection expected within 7 days',
    );
  }

  if (
    overdueCount >
    0
  ) {
    lines.push(
      `${overdueCount} overdue payment${overdueCount === 1 ? '' : 's'}`,
    );
  }

  if (
    deadlineRiskCount >
    0
  ) {
    lines.push(
      `${deadlineRiskCount} project${deadlineRiskCount === 1 ? '' : 's'} at deadline risk`,
    );
  }

  if (
    pendingApprovals >
    0
  ) {
    lines.push(
      `${pendingApprovals} client approval${pendingApprovals === 1 ? '' : 's'} pending`,
    );
  }

  return {
    lines,
    expected7dKobo,
    overdueKobo,
    avgUtilization,
  };
}
