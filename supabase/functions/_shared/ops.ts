-- ============================================================
-- Shared helpers for Phase 3 operations edge functions.
-- Import from '../_shared/ops.ts'.
-- Automation executes in-app actions only. Never email (SMTP
-- unconfigured), never financial/destructive operations.
-- ============================================================

export function clean(
  value: unknown,
  maxLength = 5000,
) {
  if (
    typeof value !==
    'string'
  ) {
    return '';
  }

  return value
    .trim()
    .slice(
      0,
      maxLength,
    );
}

export function json(
  body: Record<
    string,
    unknown
  >,
  status = 200,
) {
  return Response.json(
    body,
    {
      status,
    },
  );
}

export function makeReference(
  prefix: string,
) {
  return `${prefix}-${crypto
    .randomUUID()
    .replaceAll(
      '-',
      '',
    )
    .slice(
      0,
      10,
    )
    .toUpperCase()}`;
}

export async function requireCapability(
  ctx: any,
  capability:
    | string
    | string[],
) {
  const {
    data:
      hasAdminAccess,
  } =
    await ctx
      .supabase
      .rpc(
        'has_admin_access',
      );

  if (
    hasAdminAccess ===
    true
  ) {
    return {
      adminUserId:
        ctx.userClaims?.id,
      via: 'owner',
    };
  }

  const caps =
    Array.isArray(
      capability,
    )
      ? capability
      : [
          capability,
        ];

  for (const cap of caps) {
    const {
      data: allowed,
    } =
      await ctx
        .supabase
        .rpc(
          'has_capability',
          {
            cap,
          },
        );

    if (
      allowed ===
      true
    ) {
      return {
        adminUserId:
          ctx.userClaims?.id,
        via: 'capability',
      };
    }
  }

  return null;
}

export async function logAdminAction(
  admin: any,
  {
    adminUserId,
    orderId = null,
    action,
    description,
    metadata = {},
  }: {
    adminUserId: string;
    orderId?: string | null;
    action: string;
    description: string;
    metadata?: Record<
      string,
      unknown
    >;
  },
) {
  await admin
    .from(
      'admin_activity_log',
    )
    .insert({
      admin_user_id:
        adminUserId,

      order_id:
        orderId,

      action,

      description,

      metadata,
    });
}

export async function notifyCustomer(
  admin: any,
  {
    order,
    type,
    payload,
  }: {
    order: {
      id: string;
      customer_id: string;
      reference?: string;
      project_title?: string;
    };
    type: string;
    payload: Record<
      string,
      unknown
    >;
  },
) {
  await admin
    .from(
      'notification_events',
    )
    .insert({
      order_id:
        order.id,

      customer_id:
        order.customer_id,

      channel:
        'internal',

      event_type:
        type,

      status:
        'pending',

      payload: {
        reference:
          order.reference,

        project_title:
          order.project_title,

        ...payload,
      },
    });
}

/* ============================================================
   AUTOMATION ENGINE (deterministic, loop-guarded)
   Supported triggers: documented in AUTOMATION_TRIGGERS.
   Supported conditions: service_equals, min_project_value_kobo,
   has_outstanding_balance, client_action_pending,
   days_before_deadline_lte, milestone_title_contains.
   Supported actions: create_task, set_project_phase,
   set_deadline, create_client_action, notify_client.
   ============================================================ */

export const AUTOMATION_TRIGGERS = [
  'lead_created',
  'lead_stage_changed',
  'proposal_accepted',
  'project_submitted',
  'project_approved',
  'project_declined',
  'payment_confirmed',
  'installment_paid',
  'milestone_completed',
  'deliverable_published',
  'deliverable_approved',
  'revision_requested',
  'client_file_uploaded',
  'change_request_accepted',
  'request_created',
  'request_completed',
  'project_completed',
] as const;

export const AUTOMATION_ACTIONS = [
  'create_task',
  'set_project_phase',
  'set_deadline',
  'create_client_action',
  'notify_client',
] as const;

type AutomationContext = {
  orderId?: string | null;
  leadId?: string | null;
  requestId?: string | null;
  depth?: number;
  origin?: string;
};

function conditionMet(
  condition: any,
  facts: Record<
    string,
    any
  >,
): boolean {
  const kind = String(
    condition?.kind || '',
  );

  if (
    kind ===
    'service_equals'
  ) {
    return (
      String(
        facts.service_slug || '',
      ) ===
      String(
        condition.service_slug || '',
      )
    );
  }

  if (
    kind ===
    'min_project_value_kobo'
  ) {
    return (
      Number(
        facts.total_kobo || 0,
      ) >=
      Number(
        condition.value_kobo || 0,
      )
    );
  }

  if (
    kind ===
    'has_outstanding_balance'
  ) {
    const outstanding =
      Number(
        facts.outstanding_kobo || 0,
      );

    return condition.expected ===
      false
      ? outstanding <= 0
      : outstanding > 0;
  }

  if (
    kind ===
    'client_action_pending'
  ) {
    return Boolean(
      facts.customer_action_required,
    ) ===
      (condition.expected !==
        false);
  }

  if (
    kind ===
    'days_before_deadline_lte'
  ) {
    if (!facts.deadline) {
      return false;
    }

    const days =
      Math.ceil(
        (
          new Date(
            facts.deadline,
          ).getTime() -
          Date.now()
        ) /
          86400000,
      );

    return (
      days <=
      Number(
        condition.days || 0,
      )
    );
  }

  if (
    kind ===
    'milestone_title_contains'
  ) {
    return String(
      facts.milestone_title || '',
    )
      .toLowerCase()
      .includes(
        String(
          condition.text || '',
        ).toLowerCase(),
      );
  }

  return false;
}

async function executeAction(
  admin: any,
  automation: any,
  action: any,
  facts: Record<string, any>,
  actorId: string,
): Promise<string> {
  const kind = String(
    action?.kind || '',
  );

  if (
    !(
      AUTOMATION_ACTIONS as readonly string[]
    ).includes(
      kind,
    )
  ) {
    return `skipped:unsupported-action:${kind}`;
  }

  const orderId: string | null =
    facts.order_id || null;

  if (
    kind ===
    'create_task'
  ) {
    if (!orderId) {
      return 'skipped:no-order';
    }

    const {
      error,
    } =
      await admin
        .from(
          'project_tasks',
        )
        .insert({
          order_id:
            orderId,

          title:
            String(
              action.title ||
                'Follow-up task',
            ).slice(
              0,
              200,
            ),

          description:
            typeof action.description ===
            'string'
              ? action.description.slice(
                  0,
                  2000,
                )
              : null,

          priority:
            [
              'low',
              'normal',
              'high',
              'urgent',
            ].includes(
              action.priority,
            )
              ? action.priority
              : 'normal',

          client_visible:
            action.client_visible ===
            true,

          created_by:
            actorId,
        });

    return error
      ? `failed:${error.message}`
      : 'completed:create_task';
  }

  if (
    kind ===
    'set_project_phase'
  ) {
    if (!orderId) {
      return 'skipped:no-order';
    }

    const phase = String(
      action.phase || '',
    );

    const allowed = [
      'submitted',
      'management_review',
      'approved',
      'awaiting_payment',
      'planning',
      'production',
      'internal_review',
      'client_review',
      'revision',
      'final_review',
      'awaiting_final_payment',
      'ready_for_delivery',
      'delivered',
      'completed',
      'archived',
    ];

    if (
      !allowed.includes(
        phase,
      )
    ) {
      return `skipped:invalid-phase:${phase}`;
    }

    const {
      error,
    } =
      await admin
        .from(
          'orders',
        )
        .update({
          project_phase:
            phase,
        })
        .eq(
          'id',
          orderId,
        );

    return error
      ? `failed:${error.message}`
      : 'completed:set_project_phase';
  }

  if (
    kind ===
    'set_deadline'
  ) {
    if (!orderId) {
      return 'skipped:no-order';
    }

    const days = Number(
      action.days_from_now,
    );

    if (
      !Number.isFinite(
        days,
      )
    ) {
      return 'skipped:invalid-days';
    }

    const date =
      new Date(
        Date.now() +
          days *
            86400000,
      )
        .toISOString()
        .slice(
          0,
          10,
        );

    const {
      error,
    } =
      await admin
        .from(
          'orders',
        )
        .update({
          deadline:
            date,
        })
        .eq(
          'id',
          orderId,
        );

    return error
      ? `failed:${error.message}`
      : 'completed:set_deadline';
  }

  if (
    kind ===
    'create_client_action'
  ) {
    if (!orderId) {
      return 'skipped:no-order';
    }

    const {
      error,
    } =
      await admin
        .from(
          'orders',
        )
        .update({
          customer_action_required:
            true,

          customer_action_label:
            String(
              action.label ||
                'Your attention is required.',
            ).slice(
              0,
              200,
            ),
        })
        .eq(
          'id',
          orderId,
        );

    return error
      ? `failed:${error.message}`
      : 'completed:create_client_action';
  }

  // notify_client
  if (
    !orderId ||
    !facts.customer_id
  ) {
    return 'skipped:no-order';
  }

  const {
    error,
  } =
    await admin
      .from(
        'notification_events',
      )
      .insert({
        order_id:
          orderId,

        customer_id:
          facts.customer_id,

        channel:
          'internal',

        event_type:
          'project_update',

        status:
          'pending',

        payload: {
          reference:
            facts.reference,

          project_title:
            facts.project_title,

          message:
            String(
              action.message ||
                'There is an update on your project.',
            ).slice(
              0,
              2000,
            ),

          automated: true,

          automation_id:
            automation.id,
        },
      });

  return error
    ? `failed:${error.message}`
    : 'completed:notify_client';
}

export async function runAutomations(
  admin: any,
  triggerEvent: string,
  context: AutomationContext,
  actorId: string,
): Promise<void> {
  const depth =
    context.depth || 0;

  // Loop protection: automations never chain.
  if (
    depth > 0
  ) {
    return;
  }

  if (
    !(
      AUTOMATION_TRIGGERS as readonly string[]
    ).includes(
      triggerEvent,
    )
  ) {
    return;
  }

  const {
    data: automations,
  } =
    await admin
      .from(
        'automations',
      )
      .select(
        'id,name,conditions,actions,enabled,run_count',
      )
      .eq(
        'trigger_event',
        triggerEvent,
      )
      .eq(
        'enabled',
        true,
      );

  if (
    !automations ||
    automations.length ===
      0
  ) {
    return;
  }

  // Gather facts once per trigger.
  let facts: Record<
    string,
    any
  > = {
    order_id:
      context.orderId || null,
  };

  if (
    context.orderId
  ) {
    const {
      data: order,
    } =
      await admin
        .from(
          'orders',
        )
        .select(`
          id,
          reference,
          customer_id,
          service_slug,
          quoted_amount_kobo,
          paid_amount_kobo,
          deadline,
          customer_action_required
        `)
        .eq(
          'id',
          context.orderId,
        )
        .maybeSingle();

    if (order) {
      facts = {
        ...facts,
        customer_id:
          order.customer_id,
        reference:
          order.reference,
        project_title:
          (order as any)
            .project_title,
        service_slug:
          order.service_slug,
        total_kobo:
          Number(
            order.quoted_amount_kobo ||
              0,
          ),
        outstanding_kobo:
          Math.max(
            Number(
              order.quoted_amount_kobo ||
                0,
            ) -
              Number(
                order.paid_amount_kobo ||
                  0,
              ),
            0,
          ),
        deadline:
          order.deadline,
        customer_action_required:
          (order as any)
            .customer_action_required,
      };
    }
  }

  for (const automation of automations) {
    const conditions: any[] =
      Array.isArray(
        automation.conditions,
      )
        ? automation.conditions
        : [];

    const matches =
      conditions.length ===
        0 ||
      conditions.every(
        (condition) =>
          conditionMet(
            condition,
            facts,
          ),
      );

    if (!matches) {
      await admin
        .from(
          'automation_runs',
        )
        .insert({
          automation_id:
            automation.id,

          trigger_event:
            triggerEvent,

          entity_type:
            context.leadId
              ? 'lead'
              : context.requestId
                ? 'service_request'
                : context.orderId
                  ? 'order'
                  : null,

          entity_id:
            context.leadId ||
            context.requestId ||
            context.orderId ||
            null,

          order_id:
            context.orderId ||
            null,

          status:
            'skipped',

          detail: {
            reason:
              'conditions-not-met',
          },
        });

      continue;
    }

    const actions: any[] =
      Array.isArray(
        automation.actions,
      )
        ? automation.actions
        : [];

    const results: string[] =
      [];

    for (const action of actions.slice(
      0,
      10,
    )) {
      try {
        results.push(
          await executeAction(
            admin,
            automation,
            action,
            facts,
            actorId,
          ),
        );
      } catch (actionError) {
        results.push(
          `failed:${actionError instanceof Error ? actionError.message : 'unknown'}`,
        );
      }
    }

    const failed =
      results.filter(
        (result) =>
          result.startsWith(
            'failed',
          ),
      );

    await admin
      .from(
        'automation_runs',
      )
      .insert({
        automation_id:
          automation.id,

        trigger_event:
          triggerEvent,

        entity_type:
          context.leadId
            ? 'lead'
            : context.requestId
              ? 'service_request'
              : context.orderId
                ? 'order'
                : null,

        entity_id:
          context.leadId ||
          context.requestId ||
          context.orderId ||
          null,

        order_id:
          context.orderId ||
          null,

        status:
          failed.length ===
          0
            ? 'completed'
            : failed.length ===
                results.length
              ? 'failed'
              : 'partial',

        detail: {
          results,
          origin:
            context.origin ||
            'edge',
        },
      });

    await admin
      .from(
        'automations',
      )
      .update({
        run_count:
          Number(
            (automation as any)
              .run_count || 0,
          ) + 1,
        last_run_at:
          new Date()
            .toISOString(),
      })
      .eq(
        'id',
        automation.id,
      );
  }
}
