import {
  withSupabase,
} from 'npm:@supabase/server@^1';

import {
  clean,
  json,
  logAdminAction,
  makeReference,
  notifyCustomer,
  publicMessage,
  requireCapability,
  runAutomations,
} from '../_shared/ops.ts';

const REQUEST_STATUSES = [
  'new',
  'assigned',
  'active',
  'waiting_on_client',
  'awaiting_review',
  'completed',
  'cancelled',
];

const REQUEST_PRIORITIES = [
  'low',
  'normal',
  'high',
  'urgent',
];

const BILLING_STATUSES = [
  'included',
  'billable',
  'billed',
  'courtesy',
  'one_off',
];

const RETAINER_STATUSES = [
  'draft',
  'active',
  'paused',
  'cancelled',
  'expired',
];

const OVERAGE_POLICIES = [
  'stop',
  'charge',
  'approve',
  'upgrade',
];

const ORG_ROLES = [
  'owner',
  'billing',
  'member',
  'reviewer',
  'viewer',
];

const TEAM_ROLES = [
  'owner',
  'administrator',
  'project_manager',
  'finance',
  'creative',
  'developer',
  'client_success',
  'support',
  'viewer',
];

const KNOWN_SETTINGS = [
  'quote_validity_days',
  'payment_deadline_days',
  'default_revision_allowance',
  'currency',
  'business_timezone',
  'business_hours',
  'reference_prefixes',
];

async function getOrder(
  admin: any,
  orderId: string,
) {
  const {
    data,
  } =
    await admin
      .from(
        'orders',
      )
      .select(
        'id,reference,customer_id,project_title',
      )
      .eq(
        'id',
        orderId,
      )
      .maybeSingle();

  return data || null;
}

export default {
  fetch: withSupabase(
    {
      auth: 'user',
    },

    async (
      req,
      ctx,
    ) => {
      if (
        req.method !==
        'POST'
      ) {
        return json(
          {
            success: false,
            message:
              'Method not allowed.',
          },
          405,
        );
      }

      try {
        const body =
          await req.json();

        const action =
          clean(
            body?.action,
            60,
          );

        const capability =
          action.startsWith(
            'team_',
          ) ||
          action.startsWith(
            'allocation_',
          )
            ? 'team.manage'
            : action.startsWith(
                  'time_',
                )
              ? [
                  'team.manage',
                  'requests.manage',
                ]
              : action.startsWith(
                    'automation_',
                  )
                ? 'automations.manage'
                : action.startsWith(
                      'setting_',
                    ) ||
                    action.startsWith(
                      'flag_',
                    ) ||
                    action.startsWith(
                      'sop_',
                    ) ||
                    action.startsWith(
                      'inbox_',
                    )
                  ? 'settings.manage'
                    : action.startsWith(
                        'retainer_',
                      ) ||
                      action.startsWith(
                        'internal_cost',
                      ) ||
                      action ===
                        'delete_internal_cost' ||
                      action ===
                        'request_bill' ||
                      action ===
                        'postmortem_save' ||
                      action ===
                        'project_budget_save'
                    ? 'finance.manage'
                    : action.startsWith(
                          'org_',
                        )
                      ? 'sales.manage'
                      : 'requests.manage';

        const access =
          await requireCapability(
            ctx,
            capability,
          );

        if (!access) {
          return json(
            {
              success: false,
              message:
                'You do not have permission for this action.',
            },
            403,
          );
        }

        const adminUserId =
          access.adminUserId;

        if (!adminUserId) {
          return json(
            {
              success: false,
              message:
                'Session could not be identified.',
            },
            401,
          );
        }

        const admin =
          ctx.supabaseAdmin;

        /* ====================================================
           SERVICE REQUESTS
           ==================================================== */

        if (
          action ===
          'request_save'
        ) {
          const id =
            clean(
              body?.id,
              100,
            ) ||
            null;

          const title =
            clean(
              body?.title,
              200,
            );

          const description =
            clean(
              body?.description,
              5000,
            );

          if (
            !title ||
            !description
          ) {
            return json(
              {
                success: false,
                message:
                  'Title and description are required.',
              },
              400,
            );
          }

          const customerId =
            clean(
              body?.customer_id,
              100,
            );

          if (
            !id &&
            !customerId
          ) {
            return json(
              {
                success: false,
                message:
                  'Choose the client first.',
              },
              400,
            );
          }

          const priority =
            clean(
              body?.priority,
              20,
            ) ||
            'normal';

          if (
            !REQUEST_PRIORITIES.includes(
              priority,
            )
          ) {
            return json(
              {
                success: false,
                message:
                  'Choose a valid priority.',
              },
              400,
            );
          }

          const status =
            clean(
              body?.status,
              30,
            ) ||
            'new';

          if (
            !REQUEST_STATUSES.includes(
              status,
            )
          ) {
            return json(
              {
                success: false,
                message:
                  'Choose a valid request status.',
              },
              400,
            );
          }

          const row: Record<
            string,
            unknown
          > = {
            customer_id:
              customerId ||
              undefined,
            organization_id:
              clean(
                body?.organization_id,
                100,
              ) ||
              null,
            order_id:
              clean(
                body?.order_id,
                100,
              ) ||
              null,
            retainer_id:
              clean(
                body?.retainer_id,
                100,
              ) ||
              null,
            service_slug:
              clean(
                body?.service_slug,
                80,
              ) ||
              'creative-solutions',
            title,
            description,
            priority,
            status,
            assignee_id:
              clean(
                body?.assignee_id,
                100,
              ) ||
              null,
            due_date:
              body?.due_date ||
              null,
            checklist:
              Array.isArray(
                body?.checklist,
              )
                ? body.checklist
                    .slice(
                      0,
                      50,
                    )
                    .map(
                      (
                        item: any,
                      ) => ({
                        label:
                          String(
                            item?.label ||
                              '',
                          ).slice(
                            0,
                            200,
                          ),
                        done:
                          item?.done ===
                          true,
                      }),
                    )
                    .filter(
                      (
                        item: any,
                      ) =>
                        Boolean(
                          item.label,
                        ),
                    )
                : [],
            billing_status:
              BILLING_STATUSES.includes(
                clean(
                  body?.billing_status,
                  30,
                ),
              )
                ? clean(
                    body?.billing_status,
                    30,
                  )
                : 'included',
          };

          if (
            row.customer_id ===
            undefined
          ) {
            delete row.customer_id;
          }

          let requestId =
            id;

          if (id) {
            const {
              error,
            } =
              await admin
                .from(
                  'service_requests',
                )
                .update(
                  row,
                )
                .eq(
                  'id',
                  id,
                );

            if (error) {
              throw error;
            }
          } else {
            const {
              data: created,
              error,
            } =
              await admin
                .from(
                  'service_requests',
                )
                .insert({
                  ...row,
                  reference:
                    makeReference(
                      'REQ',
                    ),
                  creator_user_id:
                    adminUserId,
                  creator_kind:
                    'team',
                })
                .select(
                  'id,reference',
                )
                .single();

            if (
              error ||
              !created
            ) {
              throw (
                error ||
                new Error(
                  'The request could not be created.',
                )
              );
            }

            requestId =
              created.id;

            await runAutomations(
              admin,
              'request_created',
              {
                requestId,
                orderId:
                  (row.order_id as string) ||
                  null,
                origin:
                  'operations-action',
              },
              adminUserId,
            );
          }

          await logAdminAction(
            admin,
            {
              adminUserId,
              orderId:
                (row.order_id as string) ||
                null,
              action:
                id
                  ? 'request_updated'
                  : 'request_created',
              description:
                `Service request "${title}" ${id ? 'updated' : 'created'}.`,
              metadata: {
                request_id:
                  requestId,
              },
            },
          );

          return json({
            success: true,
            requestId,
          });
        }

        if (
          action ===
          'request_status'
        ) {
          const id =
            clean(
              body?.id,
              100,
            );

          const status =
            clean(
              body?.status,
              30,
            );

          if (
            !REQUEST_STATUSES.includes(
              status,
            )
          ) {
            return json(
              {
                success: false,
                message:
                  'Choose a valid request status.',
              },
              400,
            );
          }

          const {
            data: request,
          } =
            await admin
              .from(
                'service_requests',
              )
              .select(
                'id,order_id,retainer_id,title,customer_id,reference',
              )
              .eq(
                'id',
                id,
              )
              .maybeSingle();

          if (!request) {
            return json(
              {
                success: false,
                message:
                  'The request could not be found.',
              },
              404,
            );
          }

          const patch: Record<
            string,
            unknown
          > = {
            status,
          };

          if (
            status ===
            'completed'
          ) {
            patch.completed_at =
              new Date()
                .toISOString();
          }

          const {
            error,
          } =
            await admin
              .from(
                'service_requests',
              )
              .update(
                patch,
              )
              .eq(
                'id',
                id,
              );

          if (error) {
            throw error;
          }

          const minutesSpent =
            Math.round(
              Number(
                body?.minutes_spent ||
                  0,
              ),
            );

          // Retainer usage is recorded explicitly — never silently.
          if (
            status ===
              'completed' &&
            request.retainer_id &&
            minutesSpent > 0
          ) {
            const today =
              new Date()
                .toISOString()
                .slice(
                  0,
                  10,
                );

            const {
              data: period,
            } =
              await admin
                .from(
                  'retainer_periods',
                )
                .select(
                  'id,used_minutes,requests_completed',
                )
                .eq(
                  'retainer_id',
                  request.retainer_id,
                )
                .lte(
                  'period_start',
                  today,
                )
                .gte(
                  'period_end',
                  today,
                )
                .eq(
                  'status',
                  'open',
                )
                .maybeSingle();

            if (period) {
              await admin
                .from(
                  'retainer_periods',
                )
                .update({
                  used_minutes:
                    Number(
                      period.used_minutes ||
                        0,
                    ) +
                    minutesSpent,
                  requests_completed:
                    Number(
                      period.requests_completed ||
                        0,
                    ) + 1,
                })
                .eq(
                  'id',
                  period.id,
                );
            }
          }

          if (
            status ===
            'completed'
          ) {
            await runAutomations(
              admin,
              'request_completed',
              {
                requestId: id,
                orderId:
                  request.order_id,
                origin:
                  'operations-action',
              },
              adminUserId,
            );
          }

          await admin
            .from(
              'notification_events',
            )
            .insert({
              order_id:
                request.order_id,
              customer_id:
                request.customer_id,
              channel:
                'internal',
              event_type:
                'request_updated',
              status:
                'pending',
              payload: {
                request_id:
                  id,
                request_reference:
                  request.reference,
                title:
                  request.title,
                status,
              },
            });

          await logAdminAction(
            admin,
            {
              adminUserId,
              orderId:
                request.order_id,
              action:
                'request_status_changed',
              description:
                `Request "${request.title}" moved to ${status.replaceAll('_', ' ')}.`,
              metadata: {
                request_id: id,
                status,
              },
            },
          );

          return json({
            success: true,
          });
        }

        if (
          action ===
          'request_comment'
        ) {
          const id =
            clean(
              body?.id,
              100,
            );

          const commentBody =
            clean(
              body?.body,
              5000,
            );

          if (
            !id ||
            !commentBody
          ) {
            return json(
              {
                success: false,
                message:
                  'Write the comment first.',
              },
              400,
            );
          }

          const {
            data: target,
          } =
            await admin
              .from(
                'service_requests',
              )
              .select(
                'id,status',
              )
              .eq(
                'id',
                id,
              )
              .maybeSingle();

          if (
            target &&
            [
              'completed',
              'cancelled',
            ].includes(
              target.status,
            )
          ) {
            return json(
              {
                success: false,
                message:
                  'This request is closed. Create a new request for new work.',
              },
              409,
            );
          }

          const {
            error,
          } =
            await admin
              .from(
                'request_comments',
              )
              .insert({
                request_id:
                  id,
                author_user_id:
                  adminUserId,
                author_kind:
                  'team',
                body: commentBody,
                internal:
                  body?.internal ===
                  true,
              });

          if (error) {
            throw error;
          }

          if (
            body?.internal !==
            true
          ) {
            const {
              data: target,
            } =
              await admin
                .from(
                  'service_requests',
                )
                .select(
                  'id,reference,title,customer_id,order_id',
                )
                .eq(
                  'id',
                  id,
                )
                .maybeSingle();

            if (target) {
              await admin
                .from(
                  'notification_events',
                )
                .insert({
                  order_id:
                    target.order_id,
                  customer_id:
                    target.customer_id,
                  channel:
                    'internal',
                  event_type:
                    'request_updated',
                  status:
                    'pending',
                  payload: {
                    request_id:
                      target.id,
                    request_reference:
                      target.reference,
                    title:
                      target.title,
                    message:
                      commentBody.slice(
                        0,
                        500,
                      ),
                },
              });
            }
          }

          return json({
            success: true,
          });
        }

        if (
          action ===
          'request_bill'
        ) {
          const id =
            clean(
              body?.id,
              100,
            );

          const amountKobo =
            Math.round(
              Number(
                body?.amount_kobo ||
                  0,
              ),
            );

          if (
            !Number.isFinite(
              amountKobo,
            ) ||
            amountKobo <= 0
          ) {
            return json(
              {
                success: false,
                message:
                  'Enter a valid charge above zero.',
              },
              400,
            );
          }

          const {
            data: request,
          } =
            await admin
              .from(
                'service_requests',
              )
              .select(
                'id,order_id,title,billing_cost_id',
              )
              .eq(
                'id',
                id,
              )
              .maybeSingle();

          if (!request) {
            return json(
              {
                success: false,
                message:
                  'The request could not be found.',
              },
              404,
            );
          }

          if (
            !request.order_id
          ) {
            return json(
              {
                success: false,
                message:
                  'Link a project before billing this request.',
              },
              409,
            );
          }

          if (
            request.billing_cost_id
          ) {
            return json(
              {
                success: false,
                message:
                  'This request already has a linked charge.',
              },
              409,
            );
          }

          const {
            data: cost,
            error:
              costError,
          } =
            await admin
              .from(
                'project_cost_items',
              )
              .insert({
                order_id:
                  request.order_id,
                title:
                  `Request: ${String(request.title).slice(0, 120)}`,
                description:
                  clean(
                    body?.description,
                    2000,
                  ) ||
                  `One-off charge for service request.`,
                amount_kobo:
                  amountKobo,
                created_by:
                  adminUserId,
              })
              .select(
                'id',
              )
              .single();

          if (
            costError ||
            !cost
          ) {
            throw (
              costError ||
              new Error(
                'The charge could not be created.',
              )
            );
          }

          await admin
            .from(
              'service_requests',
            )
            .update({
              billing_status:
                'billed',
              billing_amount_kobo:
                amountKobo,
              billing_cost_id:
                cost.id,
            })
            .eq(
              'id',
              id,
            );

          await logAdminAction(
            admin,
            {
              adminUserId,
              orderId:
                request.order_id,
              action:
                'request_billed',
              description:
                `Service request billed ${amountKobo} kobo as an additional project cost.`,
              metadata: {
                request_id: id,
                cost_id:
                  cost.id,
              },
            },
          );

          return json({
            success: true,
            costId:
              cost.id,
          });
        }

        /* ====================================================
           RETAINERS
           ==================================================== */

        if (
          action ===
          'retainer_save'
        ) {
          const id =
            clean(
              body?.id,
              100,
            ) ||
            null;

          const customerId =
            clean(
              body?.customer_id,
              100,
            );

          const title =
            clean(
              body?.title,
              200,
            );

          if (
            !customerId ||
            !title
          ) {
            return json(
              {
                success: false,
                message:
                  'Client and retainer title are required.',
              },
              400,
            );
          }

          const status =
            clean(
              body?.status,
              30,
            ) ||
            'draft';

          if (
            !RETAINER_STATUSES.includes(
              status,
            )
          ) {
            return json(
              {
                success: false,
                message:
                  'Choose a valid retainer status.',
              },
              400,
            );
          }

          const policy =
            clean(
              body?.overage_policy,
              30,
            ) ||
            'approve';

          if (
            !OVERAGE_POLICIES.includes(
              policy,
            )
          ) {
            return json(
              {
                success: false,
                message:
                  'Choose a valid overage policy.',
              },
              400,
            );
          }

          const row: Record<
            string,
            unknown
          > = {
            customer_id:
              customerId,
            organization_id:
              clean(
                body?.organization_id,
                100,
              ) ||
              null,
            service_slug:
              clean(
                body?.service_slug,
                80,
              ) ||
              'creative-solutions',
            title,
            monthly_amount_kobo:
              Math.max(
                0,
                Math.round(
                  Number(
                    body?.monthly_amount_kobo ||
                      0,
                  ),
                ),
              ),
            included_minutes:
              Math.max(
                0,
                Math.round(
                  Number(
                    body?.included_minutes ||
                      0,
                  ),
                ),
              ),
            billing_day:
              Math.min(
                28,
                Math.max(
                  1,
                  Math.round(
                    Number(
                      body?.billing_day ||
                        1,
                    ),
                  ),
                ),
              ),
            start_date:
              body?.start_date ||
              new Date()
                .toISOString()
                .slice(
                  0,
                  10,
                ),
            end_date:
              body?.end_date ||
              null,
            status,
            overage_policy:
              policy,
            created_by:
              adminUserId,
          };

          if (id) {
            const {
              error,
            } =
              await admin
                .from(
                  'retainers',
                )
                .update(
                  row,
                )
                .eq(
                  'id',
                  id,
                );

            if (error) {
              throw error;
            }

            return json({
              success: true,
              retainerId: id,
            });
          }

          const {
            data: created,
            error,
          } =
            await admin
              .from(
                'retainers',
              )
              .insert(
                row,
              )
              .select(
                'id',
              )
              .single();

          if (
            error ||
            !created
          ) {
            throw (
              error ||
              new Error(
                'The retainer could not be saved.',
              )
            );
          }

          await logAdminAction(
            admin,
            {
              adminUserId,
              orderId: null,
              action:
                'retainer_created',
              description:
                `Retainer "${title}" created.`,
              metadata: {
                retainer_id:
                  created.id,
              },
            },
          );

          return json({
            success: true,
            retainerId:
              created.id,
          });
        }

        if (
          action ===
          'retainer_period_ensure'
        ) {
          const retainerId =
            clean(
              body?.retainer_id,
              100,
            );

          const {
            data: retainer,
          } =
            await admin
              .from(
                'retainers',
              )
              .select(
                'id,included_minutes,monthly_amount_kobo',
              )
              .eq(
                'id',
                retainerId,
              )
              .maybeSingle();

          if (!retainer) {
            return json(
              {
                success: false,
                message:
                  'The retainer could not be found.',
              },
              404,
            );
          }

          const now =
            new Date();

          const periodStart =
            new Date(
              Date.UTC(
                now.getUTCFullYear(),
                now.getUTCMonth(),
                1,
              ),
            )
              .toISOString()
              .slice(
                0,
                10,
              );

          const periodEnd =
            new Date(
              Date.UTC(
                now.getUTCFullYear(),
                now.getUTCMonth() +
                  1,
                0,
              ),
            )
              .toISOString()
              .slice(
                0,
                10,
              );

          const {
            data: period,
            error,
          } =
            await admin
              .from(
                'retainer_periods',
              )
              .upsert(
                {
                  retainer_id:
                    retainerId,
                  period_start:
                    periodStart,
                  period_end:
                    periodEnd,
                  included_minutes:
                    retainer.included_minutes,
                  revenue_kobo:
                    retainer.monthly_amount_kobo,
                },
                {
                  onConflict:
                    'retainer_id,period_start',
                  ignoreDuplicates: true,
                },
              )
              .select(
                'id',
              );

          if (error) {
            throw error;
          }

          return json({
            success: true,
            periodId:
              period?.[0]?.id ||
              null,
          });
        }

        if (
          action ===
          'retainer_period_close'
        ) {
          const id =
            clean(
              body?.id,
              100,
            );

          const {
            error,
          } =
            await admin
              .from(
                'retainer_periods',
              )
              .update({
                status:
                  'closed',
              })
              .eq(
                'id',
                id,
              );

          if (error) {
            throw error;
          }

          return json({
            success: true,
          });
        }

        /* ====================================================
           ORGANIZATIONS
           ==================================================== */

        if (
          action ===
          'org_save'
        ) {
          const id =
            clean(
              body?.id,
              100,
            ) ||
            null;

          const name =
            clean(
              body?.name,
              160,
            );

          if (!name) {
            return json(
              {
                success: false,
                message:
                  'Name the organization.',
              },
              400,
            );
          }

          if (id) {
            const {
              error,
            } =
              await admin
                .from(
                  'organizations',
                )
                .update({
                  name,
                  primary_customer_id:
                    clean(
                      body?.primary_customer_id,
                      100,
                    ) ||
                    null,
                })
                .eq(
                  'id',
                  id,
                );

            if (error) {
              throw error;
            }

            return json({
              success: true,
              organizationId:
                id,
            });
          }

          const {
            data: created,
            error,
          } =
            await admin
              .from(
                'organizations',
              )
              .insert({
                name,
                primary_customer_id:
                  clean(
                    body?.primary_customer_id,
                    100,
                  ) ||
                  null,
              })
              .select(
                'id',
              )
              .single();

          if (
            error ||
            !created
          ) {
            throw (
              error ||
              new Error(
                'The organization could not be saved.',
              )
            );
          }

          return json({
            success: true,
            organizationId:
              created.id,
          });
        }

        if (
          action ===
          'org_member_save'
        ) {
          const organizationId =
            clean(
              body?.organization_id,
              100,
            );

          const customerId =
            clean(
              body?.customer_id,
              100,
            );

          const orgRole =
            clean(
              body?.org_role,
              30,
            ) ||
            'member';

          if (
            !organizationId ||
            !customerId
          ) {
            return json(
              {
                success: false,
                message:
                  'Organization and client are required.',
              },
              400,
            );
          }

          if (
            !ORG_ROLES.includes(
              orgRole,
            )
          ) {
            return json(
              {
                success: false,
                message:
                  'Choose a valid organization role.',
              },
              400,
            );
          }

          // Owners can always pay, view finance and approve.
          const isOwner =
            orgRole ===
            'owner';

          const {
            error,
          } =
            await admin
              .from(
                'organization_members',
              )
              .upsert(
                {
                  organization_id:
                    organizationId,
                  customer_id:
                    customerId,
                  org_role:
                    orgRole,
                  can_pay:
                    isOwner ||
                    body?.can_pay ===
                      true,
                  can_view_finance:
                    isOwner ||
                    orgRole ===
                      'billing' ||
                    body?.can_view_finance ===
                      true,
                  can_approve:
                    isOwner ||
                    body?.can_approve ===
                      true,
                  can_upload:
                    body?.can_upload !==
                    false,
                  can_request:
                    body?.can_request !==
                    false,
                  can_invite:
                    isOwner ||
                    body?.can_invite ===
                      true,
                },
                {
                  onConflict:
                    'organization_id,customer_id',
                },
              );

          if (error) {
            throw error;
          }

          await logAdminAction(
            admin,
            {
              adminUserId,
              orderId: null,
              action:
                'org_member_saved',
              description:
                'Organization membership saved.',
              metadata: {
                organization_id:
                  organizationId,
                customer_id:
                  customerId,
                org_role:
                  orgRole,
              },
            },
          );

          return json({
            success: true,
          });
        }

        if (
          action ===
          'org_member_remove'
        ) {
          const organizationId =
            clean(
              body?.organization_id,
              100,
            );

          const customerId =
            clean(
              body?.customer_id,
              100,
            );

          const {
            error,
          } =
            await admin
              .from(
                'organization_members',
              )
              .delete()
              .eq(
                'organization_id',
                organizationId,
              )
              .eq(
                'customer_id',
                customerId,
              );

          if (error) {
            throw error;
          }

          return json({
            success: true,
          });
        }

        /* ====================================================
           TEAM
           ==================================================== */

        if (
          action ===
          'team_save'
        ) {
          const id =
            clean(
              body?.id,
              100,
            ) ||
            null;

          const displayName =
            clean(
              body?.display_name,
              160,
            );

          if (!displayName) {
            return json(
              {
                success: false,
                message:
                  'Name the team member.',
              },
              400,
            );
          }

          const role =
            clean(
              body?.role,
              40,
            ) ||
            'support';

          if (
            !TEAM_ROLES.includes(
              role,
            )
          ) {
            return json(
              {
                success: false,
                message:
                  'Choose a valid team role.',
              },
              400,
            );
          }

          const status =
            clean(
              body?.status,
              20,
            ) ||
            'active';

          if (
            ![
              'active',
              'disabled',
            ].includes(
              status,
            )
          ) {
            return json(
              {
                success: false,
                message:
                  'Choose a valid member status.',
              },
              400,
            );
          }

          const row: Record<
            string,
            unknown
          > = {
            display_name:
              displayName,
            email:
              clean(
                body?.email,
                160,
              ) ||
              null,
            role,
            capabilities:
              Array.isArray(
                body?.capabilities,
              )
                ? body.capabilities.filter(
                    (
                      cap: unknown,
                    ) =>
                      typeof cap ===
                      'string',
                  )
                : [],
            status,
            weekly_capacity_minutes:
              Math.max(
                0,
                Math.round(
                  Number(
                    body?.weekly_capacity_minutes ??
                      2400,
                  ),
                ),
              ),
            timezone:
              clean(
                body?.timezone,
                60,
              ) ||
              'Africa/Lagos',
            skills:
              Array.isArray(
                body?.skills,
              )
                ? body.skills
                    .map(
                      (
                        skill: unknown,
                      ) =>
                        String(
                          skill ||
                            '',
                        ).slice(
                          0,
                          60,
                        ),
                    )
                    .filter(
                      Boolean,
                    )
                : [],
          };

          // Owner-role assignment is owner-only.
          if (
            role ===
              'owner' ||
            (
              Array.isArray(
                body?.capabilities,
              ) &&
              body.capabilities.includes(
                'team.manage',
              )
            )
          ) {
            const {
              data: isOwner,
            } =
              await ctx
                .supabase
                .rpc(
                  'has_admin_access',
                );

            if (
              isOwner !==
              true
            ) {
              return json(
                {
                  success: false,
                  message:
                    'Only the owner can grant owner-level access.',
                },
                403,
              );
            }
          }

          if (id) {
            const {
              error,
            } =
              await admin
                .from(
                  'team_members',
                )
                .update(
                  row,
                )
                .eq(
                  'id',
                  id,
                );

            if (error) {
              throw error;
            }

            return json({
              success: true,
              memberId: id,
            });
          }

          const {
            data: created,
            error,
          } =
            await admin
              .from(
                'team_members',
              )
              .insert(
                row,
              )
              .select(
                'id',
              )
              .single();

          if (
            error ||
            !created
          ) {
            throw (
              error ||
              new Error(
                'The team member could not be saved.',
              )
            );
          }

          await logAdminAction(
            admin,
            {
              adminUserId,
              orderId: null,
              action:
                'team_member_saved',
              description:
                `Team member "${displayName}" saved as ${role}.`,
              metadata: {
                member_id:
                  created.id,
                role,
              },
            },
          );

          return json({
            success: true,
            memberId:
              created.id,
          });
        }

        if (
          action ===
          'team_link'
        ) {
          const id =
            clean(
              body?.id,
              100,
            );

          const email =
            clean(
              body?.email,
              160,
            );

          if (
            !id ||
            !email
          ) {
            return json(
              {
                success: false,
                message:
                  'Member and sign-in email are required.',
              },
              400,
            );
          }

          let userId: string | null =
            null;

          try {
            const {
              data,
            } =
              await admin.auth.admin.listUsers();

            const match = (
              data?.users ||
              []
            ).find(
              (
                user: any,
              ) =>
                String(
                  user?.email ||
                    '',
                ).toLowerCase() ===
                email.toLowerCase(),
            );

            userId =
              match?.id ||
              null;
          } catch {
            userId =
              null;
          }

          if (!userId) {
            return json(
              {
                success: false,
                message:
                  'No signed-up account uses that email yet. The member signs up first, then link the account.',
              },
              404,
            );
          }

          const {
            error,
          } =
            await admin
              .from(
                'team_members',
              )
              .update({
                user_id:
                  userId,
              })
              .eq(
                'id',
                id,
              );

          if (error) {
            throw error;
          }

          await logAdminAction(
            admin,
            {
              adminUserId,
              orderId: null,
              action:
                'team_member_linked',
              description:
                'Team member linked to a sign-in account.',
              metadata: {
                member_id: id,
              },
            },
          );

          return json({
            success: true,
          });
        }

        if (
          action ===
          'allocation_save'
        ) {
          const memberId =
            clean(
              body?.member_id,
              100,
            );

          const weekStart =
            clean(
              body?.week_start,
              20,
            );

          const minutes =
            Math.round(
              Number(
                body?.minutes ||
                  0,
              ),
            );

          if (
            !memberId ||
            !weekStart ||
            !Number.isFinite(
              minutes,
            ) ||
            minutes <= 0
          ) {
            return json(
              {
                success: false,
                message:
                  'Member, week and hours above zero are required.',
              },
              400,
            );
          }

          const {
            data: member,
          } =
            await admin
              .from(
                'team_members',
              )
              .select(
                'id,weekly_capacity_minutes',
              )
              .eq(
                'id',
                memberId,
              )
              .maybeSingle();

          if (!member) {
            return json(
              {
                success: false,
                message:
                  'The team member could not be found.',
              },
              404,
            );
          }

          const {
            data: existing,
          } =
            await admin
              .from(
                'resource_allocations',
              )
              .select(
                'minutes',
              )
              .eq(
                'member_id',
                memberId,
              )
              .eq(
                'week_start',
                weekStart,
              );

          const alreadyAllocated = (
            existing ||
            []
          ).reduce(
            (
              sum: number,
              row: any,
            ) =>
              sum +
              Number(
                row.minutes ||
                  0,
              ),
            0,
          );

          const {
            error,
          } =
            await admin
              .from(
                'resource_allocations',
              )
              .insert({
                member_id:
                  memberId,
                order_id:
                  clean(
                    body?.order_id,
                    100,
                  ) ||
                  null,
                week_start:
                  weekStart,
                minutes,
                tentative:
                  body?.tentative ===
                  true,
                note:
                  clean(
                    body?.note,
                    500,
                  ) ||
                  null,
                created_by:
                  adminUserId,
              });

          if (error) {
            throw error;
          }

          const capacity =
            Number(
              member.weekly_capacity_minutes ||
                0,
            );

          return json({
            success: true,
            overallocated:
              capacity >
                0 &&
              alreadyAllocated +
                minutes >
                capacity,
            weekAllocatedMinutes:
              alreadyAllocated +
              minutes,
            weekCapacityMinutes:
              capacity,
          });
        }

        if (
          action ===
          'allocation_delete'
        ) {
          const id =
            clean(
              body?.id,
              100,
            );

          const {
            error,
          } =
            await admin
              .from(
                'resource_allocations',
              )
              .delete()
              .eq(
                'id',
                id,
              );

          if (error) {
            throw error;
          }

          return json({
            success: true,
          });
        }

        if (
          action ===
          'time_save'
        ) {
          const orderId =
            clean(
              body?.order_id,
              100,
            );

          const minutes =
            Math.round(
              Number(
                body?.minutes ||
                  0,
              ),
            );

          if (
            !orderId ||
            !Number.isFinite(
              minutes,
            ) ||
            minutes <= 0
          ) {
            return json(
              {
                success: false,
                message:
                  'Project and minutes above zero are required.',
              },
              400,
            );
          }

          const order =
            await getOrder(
              admin,
              orderId,
            );

          if (!order) {
            return json(
              {
                success: false,
                message:
                  'The project could not be found.',
              },
              404,
            );
          }

          const memberId =
            clean(
              body?.member_id,
              100,
            ) ||
            null;

          const {
            error,
          } =
            await admin
              .from(
                'time_entries',
              )
              .insert({
                order_id:
                  orderId,
                task_id:
                  clean(
                    body?.task_id,
                    100,
                  ) ||
                  null,
                member_id:
                  memberId,
                entry_date:
                  body?.entry_date ||
                  new Date()
                    .toISOString()
                    .slice(
                      0,
                      10,
                    ),
                minutes,
                billable:
                  body?.billable !==
                  false,
                description:
                  clean(
                    body?.description,
                    2000,
                  ) ||
                  null,
                created_by:
                  adminUserId,
              });

          if (error) {
            throw error;
          }

          return json({
            success: true,
          });
        }

        if (
          action ===
          'time_delete'
        ) {
          const id =
            clean(
              body?.id,
              100,
            );

          const {
            error,
          } =
            await admin
              .from(
                'time_entries',
              )
              .delete()
              .eq(
                'id',
                id,
              );

          if (error) {
            throw error;
          }

          return json({
            success: true,
          });
        }

        /* ====================================================
           AUTOMATIONS
           ==================================================== */

        if (
          action ===
          'automation_save'
        ) {
          const id =
            clean(
              body?.id,
              100,
            ) ||
            null;

          const name =
            clean(
              body?.name,
              160,
            );

          if (!name) {
            return json(
              {
                success: false,
                message:
                  'Name the automation.',
              },
              400,
            );
          }

          const {
            AUTOMATION_TRIGGERS: triggers,
            AUTOMATION_ACTIONS: allowed,
          } = await import(
            '../_shared/ops.ts'
          );

          const triggerEvent =
            clean(
              body?.trigger_event,
              60,
            );

          if (
            !(
              triggers as readonly string[]
            ).includes(
              triggerEvent,
            )
          ) {
            return json(
              {
                success: false,
                message:
                  'Choose a valid trigger.',
              },
              400,
            );
          }

          const conditions = Array.isArray(
            body?.conditions,
          )
            ? body.conditions.slice(
                0,
                10,
              )
            : [];

          const actions = Array.isArray(
            body?.actions,
          )
            ? body.actions.slice(
                0,
                10,
              )
            : [];

          if (
            actions.length ===
            0
          ) {
            return json(
              {
                success: false,
                message:
                  'Add at least one action.',
              },
              400,
            );
          }

          for (const item of actions) {
            const kind = String(
              item?.kind || '',
            );

            if (
              !(
                allowed as readonly string[]
              ).includes(
                kind,
              )
            ) {
              return json(
                {
                  success: false,
                  message:
                    `Unsupported action: ${kind || 'unknown'}. Email and financial actions are never automated.`,
                },
                400,
              );
            }
          }

          const row: Record<
            string,
            unknown
          > = {
            name,
            description:
              clean(
                body?.description,
                2000,
              ) ||
              null,
            trigger_event:
              triggerEvent,
            conditions,
            actions,
            enabled:
              body?.enabled !==
              false,
            created_by:
              adminUserId,
          };

          if (id) {
            const {
              error,
            } =
              await admin
                .from(
                  'automations',
                )
                .update(
                  row,
                )
                .eq(
                  'id',
                  id,
                );

            if (error) {
              throw error;
            }

            return json({
              success: true,
              automationId:
                id,
            });
          }

          const {
            data: created,
            error,
          } =
            await admin
              .from(
                'automations',
              )
              .insert(
                row,
              )
              .select(
                'id',
              )
              .single();

          if (
            error ||
            !created
          ) {
            throw (
              error ||
              new Error(
                'The automation could not be saved.',
              )
            );
          }

          await logAdminAction(
            admin,
            {
              adminUserId,
              orderId: null,
              action:
                'automation_saved',
              description:
                `Automation "${name}" saved.`,
              metadata: {
                automation_id:
                  created.id,
              },
            },
          );

          return json({
            success: true,
            automationId:
              created.id,
          });
        }

        if (
          action ===
          'automation_toggle'
        ) {
          const id =
            clean(
              body?.id,
              100,
            );

          const {
            error,
          } =
            await admin
              .from(
                'automations',
              )
              .update({
                enabled:
                  body?.enabled ===
                  true,
              })
              .eq(
                'id',
                id,
              );

          if (error) {
            throw error;
          }

          return json({
            success: true,
          });
        }

        if (
          action ===
          'automation_delete'
        ) {
          const id =
            clean(
              body?.id,
              100,
            );

          const {
            error,
          } =
            await admin
              .from(
                'automations',
              )
              .delete()
              .eq(
                'id',
                id,
              );

          if (error) {
            throw error;
          }

          return json({
            success: true,
          });
        }

        if (
          action ===
          'automation_dry_run'
        ) {
          const id =
            clean(
              body?.id,
              100,
            );

          const {
            data: automation,
          } =
            await admin
              .from(
                'automations',
              )
              .select('*')
              .eq(
                'id',
                id,
              )
              .maybeSingle();

          if (!automation) {
            return json(
              {
                success: false,
                message:
                  'The automation could not be found.',
              },
              404,
            );
          }

          if (
            body?.execute ===
              true &&
            body?.order_id
          ) {
            await runAutomations(
              admin,
              automation.trigger_event,
              {
                orderId:
                  clean(
                    body.order_id,
                    100,
                  ),
                origin:
                  'manual-run',
              },
              adminUserId,
            );

            return json({
              success: true,
              executed: true,
            });
          }

          return json({
            success: true,
            executed: false,
            wouldRun:
              automation.enabled,
            trigger:
              automation.trigger_event,
            conditionCount: (
              automation.conditions ||
              []
            ).length,
            actionCount: (
              automation.actions ||
              []
            ).length,
          });
        }

        /* ====================================================
           KNOWLEDGE, SETTINGS, INBOX, POSTMORTEM
           ==================================================== */

        if (
          action ===
          'sop_save'
        ) {
          const id =
            clean(
              body?.id,
              100,
            ) ||
            null;

          const title =
            clean(
              body?.title,
              200,
            );

          const sopBody =
            clean(
              body?.body,
              20000,
            );

          if (
            !title ||
            !sopBody
          ) {
            return json(
              {
                success: false,
                message:
                  'Title and procedure steps are required.',
              },
              400,
            );
          }

          const row: Record<
            string,
            unknown
          > = {
            title,
            body: sopBody,
            service_slug:
              clean(
                body?.service_slug,
                80,
              ) ||
              null,
            role:
              clean(
                body?.role,
                40,
              ) ||
              null,
            created_by:
              adminUserId,
          };

          if (id) {
            const {
              error,
            } =
              await admin
                .from(
                  'sop_articles',
                )
                .update(
                  row,
                )
                .eq(
                  'id',
                  id,
                );

            if (error) {
              throw error;
            }
          } else {
            const {
              error,
            } =
              await admin
                .from(
                  'sop_articles',
                )
                .insert(
                  row,
                );

            if (error) {
              throw error;
            }
          }

          return json({
            success: true,
          });
        }

        if (
          action ===
          'sop_delete'
        ) {
          const {
            error,
          } =
            await admin
              .from(
                'sop_articles',
              )
              .delete()
              .eq(
                'id',
                clean(
                  body?.id,
                  100,
                ),
              );

          if (error) {
            throw error;
          }

          return json({
            success: true,
          });
        }

        if (
          action ===
          'setting_save'
        ) {
          const key =
            clean(
              body?.key,
              80,
            );

          if (
            !KNOWN_SETTINGS.includes(
              key,
            )
          ) {
            return json(
              {
                success: false,
                message:
                  'This setting cannot be changed here.',
              },
              400,
            );
          }

          let value: unknown =
            body?.value;

          if (
            value ===
              undefined ||
            value ===
              null
          ) {
            return json(
              {
                success: false,
                message:
                  'A value is required.',
              },
              400,
            );
          }

          if (
            [
              'quote_validity_days',
              'payment_deadline_days',
              'default_revision_allowance',
            ].includes(
              key,
            )
          ) {
            const days =
              Math.round(
                Number(
                  value,
                ),
              );

            if (
              !Number.isFinite(
                days,
              ) ||
              days < 0 ||
              days > 365
            ) {
              return json(
                {
                  success: false,
                  message:
                    'Enter a value between 0 and 365.',
                },
                400,
              );
            }

            value =
              days;
          }

          const {
            error,
          } =
            await admin
              .from(
                'business_settings',
              )
              .upsert(
                {
                  key,
                  value,
                  updated_by:
                    adminUserId,
                },
                {
                  onConflict:
                    'key',
                },
              );

          if (error) {
            throw error;
          }

          await logAdminAction(
            admin,
            {
              adminUserId,
              orderId: null,
              action:
                'setting_saved',
              description:
                `Business setting "${key}" updated.`,
              metadata: {
                key,
              },
            },
          );

          return json({
            success: true,
          });
        }

        if (
          action ===
          'flag_toggle'
        ) {
          const key =
            clean(
              body?.key,
              80,
            );

          const {
            error,
          } =
            await admin
              .from(
                'feature_flags',
              )
              .update({
                enabled:
                  body?.enabled ===
                  true,
                updated_by:
                  adminUserId,
              })
              .eq(
                'key',
                key,
              );

          if (error) {
            throw error;
          }

          await logAdminAction(
            admin,
            {
              adminUserId,
              orderId: null,
              action:
                'feature_flag_changed',
              description:
                `Feature "${key}" ${body?.enabled === true ? 'enabled' : 'disabled'}.`,
              metadata: {
                key,
              },
            },
          );

          return json({
            success: true,
          });
        }

        if (
          action ===
          'inbox_set'
        ) {
          const itemKey =
            clean(
              body?.item_key,
              200,
            );

          const state =
            clean(
              body?.state,
              20,
            );

          if (
            !itemKey ||
            ![
              'open',
              'snoozed',
              'resolved',
            ].includes(
              state,
            )
          ) {
            return json(
              {
                success: false,
                message:
                  'Choose a valid inbox state.',
              },
              400,
            );
          }

          const {
            error,
          } =
            await admin
              .from(
                'ops_inbox_state',
              )
              .upsert(
                {
                  item_key:
                    itemKey,
                  state,
                  snoozed_until:
                    state ===
                    'snoozed'
                      ? body?.snoozed_until ||
                        null
                      : null,
                  assignee_id:
                    clean(
                      body?.assignee_id,
                      100,
                    ) ||
                    null,
                  updated_by:
                    adminUserId,
                },
                {
                  onConflict:
                    'item_key',
                },
              );

          if (error) {
            throw error;
          }

          return json({
            success: true,
          });
        }

        if (
          action ===
          'postmortem_save'
        ) {
          const orderId =
            clean(
              body?.order_id,
              100,
            );

          const order =
            await getOrder(
              admin,
              orderId,
            );

          if (!order) {
            return json(
              {
                success: false,
                message:
                  'The project could not be found.',
              },
              404,
            );
          }

          const {
            error,
          } =
            await admin
              .from(
                'project_postmortems',
              )
              .upsert(
                {
                  order_id:
                    orderId,
                  went_well:
                    clean(
                      body?.went_well,
                      5000,
                    ) ||
                    null,
                  delays:
                    clean(
                      body?.delays,
                      5000,
                    ) ||
                    null,
                  scope_accuracy:
                    clean(
                      body?.scope_accuracy,
                      5000,
                    ) ||
                    null,
                  pricing_accuracy:
                    clean(
                      body?.pricing_accuracy,
                      5000,
                    ) ||
                    null,
                  revision_issues:
                    clean(
                      body?.revision_issues,
                      5000,
                    ) ||
                    null,
                  learnings:
                    clean(
                      body?.learnings,
                      5000,
                    ) ||
                    null,
                  created_by:
                    adminUserId,
                },
                {
                  onConflict:
                    'order_id',
                },
              );

          if (error) {
            throw error;
          }

          await logAdminAction(
            admin,
            {
              adminUserId,
              orderId,
              action:
                'postmortem_saved',
              description:
                `Private postmortem recorded for ${order.reference}.`,
              metadata: {},
            },
          );

          return json({
            success: true,
          });
        }

        if (
          action ===
          'project_budget_save'
        ) {
          const orderId =
            clean(
              body?.order_id,
              100,
            );

          const order =
            await getOrder(
              admin,
              orderId,
            );

          if (!order) {
            return json(
              {
                success: false,
                message:
                  'The project could not be found.',
              },
              404,
            );
          }

          const internalBudgetKobo =
            Math.max(
              0,
              Math.round(
                Number(
                  body?.internal_budget_kobo ||
                    0,
                ),
              ),
            );

          const {
            data: current,
          } =
            await admin
              .from(
                'orders',
              )
              .select(
                'internal_metadata',
              )
              .eq(
                'id',
                orderId,
              )
              .maybeSingle();

          const merged = {
            ...(
              current?.internal_metadata ||
              {}
            ),
            internal_budget_kobo:
              internalBudgetKobo,
          };

          const {
            error,
          } =
            await admin
              .from(
                'orders',
              )
              .update({
                internal_metadata:
                  merged,
              })
              .eq(
                'id',
                orderId,
              );

          if (error) {
            throw error;
          }

          await logAdminAction(
            admin,
            {
              adminUserId,
              orderId,
              action:
                'project_budget_saved',
              description:
                `Internal budget set for ${order.reference}.`,
              metadata: {
                internal_budget_kobo:
                  internalBudgetKobo,
              },
            },
          );

          return json({
            success: true,
          });
        }

        if (
          action ===
          'notify_customer_message'
        ) {
          const orderId =
            clean(
              body?.order_id,
              100,
            );

          const message =
            clean(
              body?.message,
              2000,
            );

          if (
            !orderId ||
            !message
          ) {
            return json(
              {
                success: false,
                message:
                  'Project and message are required.',
              },
              400,
            );
          }

          const order =
            await getOrder(
              admin,
              orderId,
            );

          if (!order) {
            return json(
              {
                success: false,
                message:
                  'The project could not be found.',
              },
              404,
            );
          }

          await notifyCustomer(
            admin,
            {
              order,
              type: 'project_update',
              payload: {
                message,
              },
            },
          );

          return json({
            success: true,
          });
        }

        return json(
          {
            success: false,
            message:
              'Unsupported operations action.',
          },
          400,
        );
      } catch (error) {
        console.error(
          'operations-action:',
          error,
        );

        return json(
          {
            success: false,
            message:
              publicMessage(
                error,
                'The operation could not be completed.',
              ),
          },
          500,
        );
      }
    },
  ),
};
