import {
  withSupabase,
} from 'npm:@supabase/server@^1';

import {
  runAutomations,
} from '../_shared/ops.ts';

const allowedStatuses =
  new Set([
    'under_review',
    'awaiting_payment',
    'paid',
    'in_progress',
    'awaiting_client',
    'completed',
    'cancelled',
  ]);

function clean(
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

function json(
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

async function createNotification(
  admin: any,
  {
    order,
    type,
    payload,
  }: {
    order: any;
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

async function logAdminAction(
  admin: any,
  {
    adminUserId,
    orderId,
    action,
    description,
    metadata = {},
  }: {
    adminUserId: string;
    orderId: string;
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
        const {
          data:
            hasAdminAccess,
          error:
            accessError,
        } =
          await ctx
            .supabase
            .rpc(
              'has_admin_access',
            );

        const {
          data: teamAccess,
        } =
          await ctx
            .supabase
            .rpc(
              'is_team_member',
            );

        if (
          (
            accessError ||
            hasAdminAccess !==
              true
          ) &&
          teamAccess !==
            true
        ) {
          return json(
            {
              success: false,

              message:
                'Administrative access is required.',
            },
            403,
          );
        }

        const adminUserId =
          ctx.userClaims?.id;

        if (!adminUserId) {
          return json(
            {
              success: false,

              message:
                'Administrative session could not be identified.',
            },
            401,
          );
        }

        const body =
          await req.json();

        const action =
          clean(
            body?.action,
            60,
          );

        // Team members operate through capabilities; the owner
        // bypasses everything. Financial history rewrites,
        // deletions and archives stay owner-only.
        const ownerOnlyActions =
          new Set([
            'reverse_payment',
            'adjust_payment',
            'archive_project',
            'restore_project',
            'permanent_delete_project',
          ]);

        const financeActions =
          new Set([
            'set_project_price',
            'send_quote',
            'save_quote_items',
            'request_remaining_payment',
            'record_manual_payment',
            'review_part_payment',
            'waive_project_cost',
          ]);

        if (
          ownerOnlyActions.has(
            action,
          )
        ) {
          const {
            data: owner,
          } =
            await ctx
              .supabase
              .rpc(
                'has_admin_access',
              );

          if (
            owner !==
            true
          ) {
            return json(
              {
                success: false,

                message:
                  'Only the owner can perform this action.',
              },
              403,
            );
          }
        } else if (
          financeActions.has(
            action,
          )
        ) {
          const {
            data: financeAllowed,
          } =
            await ctx
              .supabase
              .rpc(
                'has_capability',
                {
                  cap: 'finance.manage',
                },
              );

          if (
            financeAllowed !==
            true
          ) {
            return json(
              {
                success: false,

                message:
                  'You do not have permission for this action.',
              },
              403,
            );
          }
        } else {
          const {
            data: opsAllowed,
          } =
            await ctx
              .supabase
              .rpc(
                'has_capability',
                {
                  cap: 'sales.manage',
                },
              );

          const {
            data: reqAllowed,
          } =
            await ctx
              .supabase
              .rpc(
                'has_capability',
                {
                  cap: 'requests.manage',
                },
              );

          if (
            opsAllowed !==
              true &&
            reqAllowed !==
              true
          ) {
            return json(
              {
                success: false,

                message:
                  'You do not have permission for this action.',
              },
              403,
            );
          }
        }

        const orderId =
          clean(
            body?.orderId,
            100,
          );

        if (!orderId) {
          return json(
            {
              success: false,

              message:
                'Project ID is required.',
            },
            400,
          );
        }

        const {
          data: order,
          error:
            orderError,
        } =
          await ctx
            .supabaseAdmin
            .from(
              'orders',
            )
            .select(`
              id,
              reference,
              customer_id,
              project_title,
              service_slug,
              project_type,
              status,
              payment_status,
              review_decision,
              pricing_type,
              service_price_kobo,
              quoted_amount_kobo,
              paid_amount_kobo,
              progress_percent,
              project_phase,
              delivered_at,
              completed_at,
              requires_quote,
              current_quote_id
            `)
            .eq(
              'id',
              orderId,
            )
            .maybeSingle();

        if (
          orderError ||
          !order
        ) {
          return json(
            {
              success: false,

              message:
                'Project could not be found.',
            },
            404,
          );
        }

        /* ====================================================
           APPROVE PROJECT REQUEST
           ==================================================== */

        if (
          action ===
          'approve_order'
        ) {
          if (
            order
              .review_decision ===
            'approved'
          ) {
            return json({
              success: true,
              alreadyApproved:
                true,
            });
          }

          if (
            order
              .review_decision ===
            'declined'
          ) {
            return json(
              {
                success: false,

                message:
                  'A declined request cannot be approved from this workflow.',
              },
              409,
            );
          }

          const priceKobo =
            Number(
              order
                .service_price_kobo ||
                0,
            );

          const fixedPrice =
            [
              'fixed',
              'monthly',
            ].includes(
              order.pricing_type,
            ) &&
            priceKobo > 0;

          const now =
            new Date()
              .toISOString();

          let quoteId =
            null;

          if (fixedPrice) {
            const validUntil =
              new Date(
                Date.now() +
                  7 *
                    24 *
                    60 *
                    60 *
                    1000,
              )
                .toISOString();

            const {
              data: quote,
              error:
                quoteError,
            } =
              await ctx
                .supabaseAdmin
                .from(
                  'order_quotes',
                )
                .insert({
                  order_id:
                    order.id,

                  amount_kobo:
                    priceKobo,

                  currency:
                    'NGN',

                  status:
                    'sent',

                  message:
                    'Your project request has been approved at the listed service price.',

                  valid_until:
                    validUntil,

                  created_by:
                    adminUserId,

                  sent_at:
                    now,
                })
                .select(
                  'id',
                )
                .single();

            if (
              quoteError ||
              !quote
            ) {
              throw (
                quoteError ||
                new Error(
                  'The project could not be approved.',
                )
              );
            }

            quoteId =
              quote.id;
          }

          const patch: Record<
            string,
            unknown
          > = {
            review_decision:
              'approved',

            reviewed_at:
              now,

            reviewed_by:
              adminUserId,

            decline_reason:
              null,

            last_admin_activity_at:
              now,
          };

          if (fixedPrice) {
            patch.current_quote_id =
              quoteId;

            patch.quoted_amount_kobo =
              priceKobo;

            patch.requires_quote =
              false;

            patch.status =
              'awaiting_payment';

            patch.customer_action_required =
              true;

            patch.customer_action_label =
              'Project approved — payment is ready';
          } else {
            patch.status =
              'under_review';

            patch.customer_action_required =
              false;

            patch.customer_action_label =
              null;
          }

          const {
            error:
              approvalError,
          } =
            await ctx
              .supabaseAdmin
              .from(
                'orders',
              )
              .update(
                patch,
              )
              .eq(
                'id',
                order.id,
              );

          if (
            approvalError
          ) {
            throw approvalError;
          }

          await createNotification(
            ctx.supabaseAdmin,
            {
              order,

              type:
                'order_approved',

              payload: {
                review_decision:
                  'approved',

                payment_ready:
                  fixedPrice,

                amount_kobo:
                  fixedPrice
                    ? priceKobo
                    : null,
              },
            },
          );

          await logAdminAction(
            ctx.supabaseAdmin,
            {
              adminUserId,

              orderId:
                order.id,

              action:
                'order_approved',

              description:
                `Project request ${order.reference} approved.`,

              metadata: {
                fixed_price:
                  fixedPrice,

                amount_kobo:
                  fixedPrice
                    ? priceKobo
                    : null,
              },
            },
          );

          await runAutomations(
            ctx.supabaseAdmin,
            'project_approved',
            {
              orderId:
                order.id,
              origin:
                'admin-order-action',
            },
            adminUserId,
          );

          return json({
            success: true,

            decision:
              'approved',

            paymentReady:
              fixedPrice,
          });
        }

        /* ====================================================
           DECLINE PROJECT REQUEST
           ==================================================== */

        if (
          action ===
          'decline_order'
        ) {
          if (
            order
              .review_decision ===
            'declined'
          ) {
            return json({
              success: true,
              alreadyDeclined:
                true,
            });
          }

          if (
            order
              .review_decision ===
            'approved'
          ) {
            return json(
              {
                success: false,

                message:
                  'This project has already been approved. Use the project cancellation workflow if it can no longer proceed.',
              },
              409,
            );
          }

          if (
            order
              .payment_status ===
              'successful' ||
            Number(
              order
                .paid_amount_kobo ||
                0,
            ) > 0
          ) {
            return json(
              {
                success: false,

                message:
                  'A project with confirmed payment cannot be declined.',
              },
              409,
            );
          }

          const reason =
            clean(
              body?.reason,
              2000,
            );

          if (
            reason.length <
            10
          ) {
            return json(
              {
                success: false,

                message:
                  'Provide a clear reason before declining the project.',
              },
              400,
            );
          }

          const now =
            new Date()
              .toISOString();

          const {
            error:
              declineError,
          } =
            await ctx
              .supabaseAdmin
              .from(
                'orders',
              )
              .update({
                review_decision:
                  'declined',

                reviewed_at:
                  now,

                reviewed_by:
                  adminUserId,

                decline_reason:
                  reason,

                status:
                  'cancelled',

                payment_status:
                  'cancelled',

                customer_action_required:
                  false,

                customer_action_label:
                  null,

                last_admin_activity_at:
                  now,
              })
              .eq(
                'id',
                order.id,
              );

          if (
            declineError
          ) {
            throw declineError;
          }

          await ctx
            .supabaseAdmin
            .from(
              'order_quotes',
            )
            .update({
              status:
                'cancelled',
            })
            .eq(
              'order_id',
              order.id,
            )
            .in(
              'status',
              [
                'draft',
                'sent',
              ],
            );

          await ctx
            .supabaseAdmin
            .from(
              'order_notes',
            )
            .insert({
              order_id:
                order.id,

              author_id:
                adminUserId,

              note:
                reason,

              is_internal:
                false,
            });

          await createNotification(
            ctx.supabaseAdmin,
            {
              order,

              type:
                'order_declined',

              payload: {
                review_decision:
                  'declined',

                reason,
              },
            },
          );

          await logAdminAction(
            ctx.supabaseAdmin,
            {
              adminUserId,

              orderId:
                order.id,

              action:
                'order_declined',

              description:
                `Project request ${order.reference} declined.`,

              metadata: {
                reason,
              },
            },
          );

          await runAutomations(
            ctx.supabaseAdmin,
            'project_declined',
            {
              orderId:
                order.id,
              origin:
                'admin-order-action',
            },
            adminUserId,
          );

          return json({
            success: true,

            decision:
              'declined',
          });
        }

        /* ====================================================
           SEND / REVISE QUOTE
           ==================================================== */

        if (
          action ===
          'send_quote'
        ) {
          if (
            order
              .review_decision !==
            'approved'
          ) {
            return json(
              {
                success: false,

                message:
                  'Approve the project request before sending a quote.',
              },
              409,
            );
          }

          if (
            order
              .payment_status ===
              'successful' ||
            Number(
              order
                .paid_amount_kobo ||
                0,
            ) > 0
          ) {
            return json(
              {
                success: false,

                message:
                  'This project has a confirmed payment. Add an additional project cost instead of replacing its original quote.',
              },
              409,
            );
          }

          const amountKobo =
            Number(
              body?.amountKobo,
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
                  'Enter a valid quote amount.',
              },
              400,
            );
          }

          const message =
            clean(
              body?.message,
              5000,
            );

          const validUntil =
            body?.validUntil
              ? new Date(
                  body.validUntil,
                )
                  .toISOString()
              : new Date(
                  Date.now() +
                    7 *
                      24 *
                      60 *
                      60 *
                      1000,
                )
                  .toISOString();

          await ctx
            .supabaseAdmin
            .from(
              'order_quotes',
            )
            .update({
              status:
                'superseded',
            })
            .eq(
              'order_id',
              order.id,
            )
            .eq(
              'status',
              'sent',
            );

          const {
            data: quote,
            error:
              quoteError,
          } =
            await ctx
              .supabaseAdmin
              .from(
                'order_quotes',
              )
              .insert({
                order_id:
                  order.id,

                amount_kobo:
                  Math.round(
                    amountKobo,
                  ),

                currency:
                  'NGN',

                status:
                  'sent',

                message:
                  message ||
                  null,

                valid_until:
                  validUntil,

                created_by:
                  adminUserId,

                sent_at:
                  new Date()
                    .toISOString(),
              })
              .select()
              .single();

          if (
            quoteError ||
            !quote
          ) {
            throw (
              quoteError ||
              new Error(
                'Quote could not be prepared.',
              )
            );
          }

          const {
            error:
              updateError,
          } =
            await ctx
              .supabaseAdmin
              .from(
                'orders',
              )
              .update({
                current_quote_id:
                  quote.id,

                quoted_amount_kobo:
                  quote
                    .amount_kobo,

                requires_quote:
                  false,

                status:
                  'awaiting_payment',

                payment_status:
                  'pending',

                customer_action_required:
                  true,

                customer_action_label:
                  'Quote ready for payment',

                last_admin_activity_at:
                  new Date()
                    .toISOString(),
              })
              .eq(
                'id',
                order.id,
              );

          if (
            updateError
          ) {
            throw updateError;
          }

          if (message) {
            await ctx
              .supabaseAdmin
              .from(
                'order_notes',
              )
              .insert({
                order_id:
                  order.id,

                author_id:
                  adminUserId,

                note:
                  message,

                is_internal:
                  false,
              });
          }

          await createNotification(
            ctx.supabaseAdmin,
            {
              order,

              type:
                'quote_sent',

              payload: {
                amount_kobo:
                  quote
                    .amount_kobo,

                quote_id:
                  quote.id,
              },
            },
          );

          await logAdminAction(
            ctx.supabaseAdmin,
            {
              adminUserId,

              orderId:
                order.id,

              action:
                'quote_sent',

              description:
                `Quote issued for ${order.reference}.`,

              metadata: {
                quote_id:
                  quote.id,

                amount_kobo:
                  quote
                    .amount_kobo,
              },
            },
          );

          return json({
            success: true,
            quote,
          });
        }

        /* ====================================================
           ADD A POST-INSTALLMENT PROJECT COST
           ==================================================== */

        if (
          action ===
          'add_project_cost'
        ) {
          const amountKobo =
            Number(
              body?.amountKobo,
            );

          if (
            Number(
              order
                .paid_amount_kobo ||
                0,
            ) <= 0
          ) {
            return json(
              {
                success: false,

                message:
                  'An additional cost can be added here after the first confirmed payment.',
              },
              409,
            );
          }

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
                  'Enter a valid additional project cost.',
              },
              400,
            );
          }

          const {
            data: result,
            error: costError,
          } =
            await ctx
              .supabase
              .rpc(
                'admin_add_project_cost',
                {
                  p_order_id:
                    order.id,

                  p_title:
                    clean(
                      body?.title,
                      160,
                    ),

                  p_amount_kobo:
                    Math.round(
                      amountKobo,
                    ),

                  p_description:
                    clean(
                      body?.description,
                      3000,
                    ) ||
                    null,

                  p_due_at:
                    body?.dueAt ||
                    null,
                },
              );

          if (costError) {
            throw costError;
          }

          return json({
            success: true,
            finance: result,
          });
        }

        /* ====================================================
           REQUEST THE CURRENT REMAINING BALANCE
           ==================================================== */

        if (
          action ===
          'request_remaining_payment'
        ) {
          const paid =
            Number(
              order
                .paid_amount_kobo ||
                0,
            );

          const projectValue =
            Number(
              order
                .quoted_amount_kobo ||
                0,
            );

          const outstanding =
            Math.max(
              projectValue -
                paid,
              0,
            );

          if (paid <= 0) {
            return json(
              {
                success: false,

                message:
                  'The first payment must be confirmed before requesting the remaining balance.',
              },
              409,
            );
          }

          if (outstanding <= 0) {
            return json(
              {
                success: false,

                message:
                  'There is no remaining project balance to request.',
              },
              409,
            );
          }

          if (
            [
              'completed',
              'cancelled',
            ].includes(
              order.status,
            )
          ) {
            return json(
              {
                success: false,

                message:
                  'This project is not open for another payment.',
              },
              409,
            );
          }

          const note =
            clean(
              body?.note,
              3000,
            );

          const dueAt =
            body?.dueAt
              ? new Date(
                  body.dueAt,
                )
                  .toISOString()
              : null;

          const now =
            new Date()
              .toISOString();

          const {
            error: balanceError,
          } =
            await ctx
              .supabaseAdmin
              .from(
                'orders',
              )
              .update({
                payment_status:
                  'processing',

                customer_action_required:
                  true,

                customer_action_label:
                  'Remaining project balance ready for payment',

                last_admin_activity_at:
                  now,
              })
              .eq(
                'id',
                order.id,
              );

          if (balanceError) {
            throw balanceError;
          }

          if (note) {
            await ctx
              .supabaseAdmin
              .from(
                'order_notes',
              )
              .insert({
                order_id:
                  order.id,

                author_id:
                  adminUserId,

                note,

                is_internal:
                  false,
              });
          }

          await createNotification(
            ctx.supabaseAdmin,
            {
              order,

              type:
                'remaining_payment_requested',

              payload: {
                outstanding_kobo:
                  outstanding,

                due_at:
                  dueAt,

                message:
                  note ||
                  null,
              },
            },
          );

          await logAdminAction(
            ctx.supabaseAdmin,
            {
              adminUserId,

              orderId:
                order.id,

              action:
                'remaining_payment_requested',

              description:
                `Remaining balance requested for ${order.reference}.`,

              metadata: {
                outstanding_kobo:
                  outstanding,

                due_at:
                  dueAt,
              },
            },
          );

          return json({
            success: true,

            outstandingKobo:
              outstanding,

            dueAt,
          });
        }

        /* ====================================================
           PROJECT STATUS
           ==================================================== */

        if (
          action ===
          'update_status'
        ) {
          if (
            order
              .review_decision !==
            'approved'
          ) {
            return json(
              {
                success: false,

                message:
                  'Only approved projects can enter the production workflow.',
              },
              409,
            );
          }

          const status =
            clean(
              body?.status,
              50,
            );

          if (
            !allowedStatuses.has(
              status,
            )
          ) {
            return json(
              {
                success: false,

                message:
                  'Choose a valid project status.',
              },
              400,
            );
          }

          if (
            [
              'completed',
              'cancelled',
            ].includes(
              order.status,
            )
          ) {
            return json(
              {
                success: false,

                message:
                  'Closed projects are terminal. Restore or duplicate the record instead of reopening it.',
              },
              409,
            );
          }

          if (
            status ===
            'completed'
          ) {
            return json(
              {
                success: false,

                message:
                  'Complete projects through the closeout workflow so delivery and finances are verified.',
              },
              409,
            );
          }

          const note =
            clean(
              body?.note,
              5000,
            );

          const patch: Record<
            string,
            unknown
          > = {
            status,

            last_admin_activity_at:
              new Date()
                .toISOString(),
          };

          if (
            status ===
            'awaiting_client'
          ) {
            patch.customer_action_required =
              true;

            patch.customer_action_label =
              'Your response is required';
          } else if (
            [
              'completed',
              'cancelled',
              'in_progress',
              'paid',
            ].includes(
              status,
            )
          ) {
            patch.customer_action_required =
              false;

            patch.customer_action_label =
              null;
          }

          const {
            error:
              statusError,
          } =
            await ctx
              .supabaseAdmin
              .from(
                'orders',
              )
              .update(
                patch,
              )
              .eq(
                'id',
                order.id,
              );

          if (
            statusError
          ) {
            throw statusError;
          }

          if (note) {
            await ctx
              .supabaseAdmin
              .from(
                'order_notes',
              )
              .insert({
                order_id:
                  order.id,

                author_id:
                  adminUserId,

                note,

                is_internal:
                  false,
              });
          }

          await createNotification(
            ctx.supabaseAdmin,
            {
              order,

              type:
                'status_changed',

              payload: {
                status,

                message:
                  note ||
                  null,
              },
            },
          );

          await logAdminAction(
            ctx.supabaseAdmin,
            {
              adminUserId,

              orderId:
                order.id,

              action:
                'status_changed',

              description:
                `Project status updated to ${status}.`,

              metadata: {
                previous_status:
                  order.status,

                new_status:
                  status,
              },
            },
          );

          return json({
            success: true,
          });
        }

        /* ====================================================
           PROJECT UPDATE / NOTE
           ==================================================== */

        if (
          action ===
          'add_note'
        ) {
          const note =
            clean(
              body?.note,
              5000,
            );

          const internal =
            body?.isInternal ===
            true;

          if (!note) {
            return json(
              {
                success: false,

                message:
                  'Enter an update before publishing.',
              },
              400,
            );
          }

          const {
            data:
              createdNote,
            error:
              noteError,
          } =
            await ctx
              .supabaseAdmin
              .from(
                'order_notes',
              )
              .insert({
                order_id:
                  order.id,

                author_id:
                  adminUserId,

                note,

                is_internal:
                  internal,
              })
              .select()
              .single();

          if (
            noteError
          ) {
            throw noteError;
          }

          if (!internal) {
            await createNotification(
              ctx.supabaseAdmin,
              {
                order,

                type:
                  'project_update',

                payload: {
                  message:
                    note,
                },
              },
            );
          }

          return json({
            success: true,

            note:
              createdNote,
          });
        }

        /* ====================================================
           SET PROJECT PRICE (delegates to audited RPC)
           ==================================================== */

        if (
          action ===
          'set_project_price'
        ) {
          const amountKobo =
            Number(
              body?.amountKobo,
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
                  'Enter a valid project price greater than zero.',
              },
              400,
            );
          }

          const {
            data: finance,
            error:
              priceError,
          } =
            await ctx
              .supabase
              .rpc(
                'admin_set_project_price',
                {
                  p_order_id:
                    order.id,

                  p_amount_kobo:
                    Math.round(
                      amountKobo,
                    ),
                },
              );

          if (
            priceError
          ) {
            throw priceError;
          }

          await logAdminAction(
            ctx.supabaseAdmin,
            {
              adminUserId,

              orderId:
                order.id,

              action:
                'price_set',

              description:
                `Project price set for ${order.reference}.`,

              metadata: {
                amount_kobo:
                  Math.round(
                    amountKobo,
                  ),

                finance:
                  finance ??
                  null,
              },
            },
          );

          return json({
            success: true,
            finance,
          });
        }

        /* ====================================================
           MANUAL PAYMENT / ADJUSTMENT / REVERSAL
           Provider transactions are never mutated here.
           ==================================================== */

        if (
          action ===
          'record_manual_payment'
        ) {
          const {
            data: result,
            error:
              manualError,
          } =
            await ctx
              .supabase
              .rpc(
                'admin_record_manual_payment',
                {
                  p_order_id:
                    order.id,

                  p_amount_kobo:
                    Math.round(
                      Number(
                        body?.amountKobo,
                      ),
                    ),

                  p_method:
                    clean(
                      body?.method,
                      40,
                    ) ||
                    'bank_transfer',

                  p_reference:
                    clean(
                      body?.reference,
                      160,
                    ) ||
                    null,

                  p_note:
                    clean(
                      body?.note,
                      3000,
                    ) ||
                    null,

                  p_received_at:
                    body?.receivedAt
                      ? new Date(
                          body.receivedAt,
                        )
                          .toISOString()
                      : null,

                  p_notify_customer:
                    body?.notifyCustomer !==
                    false,
                },
              );

          if (
            manualError
          ) {
            return json(
              {
                success: false,

                message:
                  manualError.message ||
                  'The manual payment could not be recorded.',
              },
              400,
            );
          }

          return json({
            success: true,
            payment: result,
          });
        }

        if (
          action ===
          'reverse_payment'
        ) {
          const paymentId =
            clean(
              body?.paymentId,
              100,
            );

          if (
            !paymentId
          ) {
            return json(
              {
                success: false,

                message:
                  'A payment reference is required.',
              },
              400,
            );
          }

          const {
            data: result,
            error:
              reverseError,
          } =
            await ctx
              .supabase
              .rpc(
                'admin_reverse_payment',
                {
                  p_payment_id:
                    paymentId,

                  p_reason:
                    clean(
                      body?.reason,
                      2000,
                    ),
                },
              );

          if (
            reverseError
          ) {
            return json(
              {
                success: false,

                message:
                  reverseError.message ||
                  'The payment could not be reversed.',
              },
              400,
            );
          }

          return json({
            success: true,
            reversal: result,
          });
        }

        if (
          action ===
          'adjust_payment'
        ) {
          const {
            data: result,
            error:
              adjustError,
          } =
            await ctx
              .supabase
              .rpc(
                'admin_adjust_payment',
                {
                  p_order_id:
                    order.id,

                  p_amount_kobo:
                    Math.round(
                      Number(
                        body?.amountKobo,
                      ),
                    ),

                  p_reason:
                    clean(
                      body?.reason,
                      2000,
                    ),

                  p_notify_customer:
                    body?.notifyCustomer !==
                    false,
                },
              );

          if (
            adjustError
          ) {
            return json(
              {
                success: false,

                message:
                  adjustError.message ||
                  'The adjustment could not be recorded.',
              },
              400,
            );
          }

          return json({
            success: true,
            adjustment: result,
          });
        }

        /* ====================================================
           WAIVE ADDITIONAL COST (delegates to audited RPC)
           ==================================================== */

        if (
          action ===
          'waive_project_cost'
        ) {
          const costId =
            clean(
              body?.costId,
              100,
            );

          const reason =
            clean(
              body?.reason,
              2000,
            );

          if (
            !costId
          ) {
            return json(
              {
                success: false,

                message:
                  'A cost reference is required.',
              },
              400,
            );
          }

          if (
            reason.length <
            5
          ) {
            return json(
              {
                success: false,

                message:
                  'Provide a clear reason before waiving this cost.',
              },
              400,
            );
          }

          const {
            data: finance,
            error:
              waiveError,
          } =
            await ctx
              .supabase
              .rpc(
                'admin_waive_project_cost',
                {
                  p_cost_id:
                    costId,

                  p_reason:
                    reason,
                },
              );

          if (
            waiveError
          ) {
            return json(
              {
                success: false,

                message:
                  waiveError.message ||
                  'The cost could not be waived.',
              },
              400,
            );
          }

          return json({
            success: true,
            finance,
          });
        }

        /* ====================================================
           ARCHIVE / RESTORE
           ==================================================== */

        if (
          action ===
          'archive_project'
        ) {
          const reason =
            clean(
              body?.reason,
              2000,
            );

          if (
            reason.length <
            5
          ) {
            return json(
              {
                success: false,

                message:
                  'Provide a reason before archiving this project.',
              },
              400,
            );
          }

          const {
            data: result,
            error:
              archiveError,
          } =
            await ctx
              .supabase
              .rpc(
                'admin_archive_project',
                {
                  p_order_id:
                    order.id,

                  p_reason:
                    reason,
                },
              );

          if (
            archiveError
          ) {
            return json(
              {
                success: false,

                message:
                  archiveError.message ||
                  'The project could not be archived.',
              },
              400,
            );
          }

          return json({
            success: true,
            archive: result,
          });
        }

        if (
          action ===
          'restore_project'
        ) {
          const {
            data: result,
            error:
              restoreError,
          } =
            await ctx
              .supabase
              .rpc(
                'admin_restore_project',
                {
                  p_order_id:
                    order.id,
                },
              );

          if (
            restoreError
          ) {
            return json(
              {
                success: false,

                message:
                  restoreError.message ||
                  'The project could not be restored.',
              },
              400,
            );
          }

          return json({
            success: true,
            restore: result,
          });
        }

        /* ====================================================
           PERMANENT DELETE (tombstoned, double-confirmed)
           The client must send the typed project reference and
           an explicit reason. Financial history warnings are
           enforced here as well as in the UI.
           ==================================================== */

        if (
          action ===
          'permanent_delete_project'
        ) {
          const typedReference =
            clean(
              body?.typedReference,
              60,
            );

          const reason =
            clean(
              body?.reason,
              2000,
            );

          if (
            !typedReference ||
            typedReference !==
              order.reference
          ) {
            return json(
              {
                success: false,

                message:
                  'Type the exact project reference to confirm permanent deletion.',
              },
              400,
            );
          }

          if (
            reason.length <
            10
          ) {
            return json(
              {
                success: false,

                message:
                  'Provide a detailed reason (at least 10 characters) before permanent deletion.',
              },
              400,
            );
          }

          const {
            count: paymentCount,
          } =
            await ctx
              .supabaseAdmin
              .from(
                'payment_transactions',
              )
              .select(
                'id',
                {
                  count:
                    'exact',

                  head: true,
                },
              )
              .eq(
                'order_id',
                order.id,
              )
              .eq(
                'status',
                'successful',
              );

          const {
            count: fileCount,
          } =
            await ctx
              .supabaseAdmin
              .from(
                'order_files',
              )
              .select(
                'id',
                {
                  count:
                    'exact',

                  head: true,
                },
              )
              .eq(
                'order_id',
                order.id,
              );

          const {
            data: fullOrder,
          } =
            await ctx
              .supabaseAdmin
              .from(
                'orders',
              )
              .select(
                'reference,project_title,customer_id,quoted_amount_kobo,paid_amount_kobo',
              )
              .eq(
                'id',
                order.id,
              )
              .maybeSingle();

          const {
            data: customer,
          } =
            await ctx
              .supabaseAdmin
              .from(
                'customers',
              )
              .select(
                'email',
              )
              .eq(
                'id',
                fullOrder?.customer_id,
              )
              .maybeSingle();

          // Tombstone first — financial history is never silently destroyed.
          await ctx
            .supabaseAdmin
            .from(
              'project_deletion_log',
            )
            .insert({
              order_id:
                order.id,

              reference:
                fullOrder?.reference ||
                order.reference,

              project_title:
                fullOrder?.project_title ||
                null,

              customer_id:
                fullOrder?.customer_id ||
                null,

              customer_email:
                customer?.email ||
                null,

              total_value_kobo:
                Number(
                  fullOrder?.quoted_amount_kobo ||
                    0,
                ),

              confirmed_paid_kobo:
                Number(
                  fullOrder?.paid_amount_kobo ||
                    0,
                ),

              payments_count:
                paymentCount ||
                0,

              files_count:
                fileCount ||
                0,

              deletion_kind:
                'permanent_delete',

              reason,

              deleted_by:
                adminUserId,
            });

          await logAdminAction(
            ctx.supabaseAdmin,
            {
              adminUserId,

              orderId:
                order.id,

              action:
                'project_permanent_delete',

              description:
                `Project ${order.reference} permanently deleted. Reason: ${reason}`,

              metadata: {
                reference:
                  order.reference,

                reason,

                had_payments:
                  (paymentCount ||
                    0) > 0,

                had_files:
                  (fileCount ||
                    0) > 0,
              },
            },
          );

          // Remove storage objects best-effort, then cascade-delete rows.
          try {
            const {
              data: orderFiles,
            } =
              await ctx
                .supabaseAdmin
                .from(
                  'order_files',
                )
                .select(
                  'bucket_name,storage_path',
                )
                .eq(
                  'order_id',
                  order.id,
                );

            const byBucket =
              new Map();

            for (const file of orderFiles ||
              []) {
              const bucket =
                file.bucket_name ||
                'project-references';

              if (
                !byBucket.has(
                  bucket,
                )
              ) {
                byBucket.set(
                  bucket,
                  [],
                );
              }

              byBucket
                .get(
                  bucket,
                )
                .push(
                  file.storage_path,
                );
            }

            for (const [
              bucket,
              paths,
            ] of byBucket) {
              if (
                paths.length
              ) {
                await ctx.supabaseAdmin.storage
                  .from(
                    bucket,
                  )
                  .remove(
                    paths,
                  );
              }
            }
          } catch (storageError) {
            console.error(
              'permanent-delete storage cleanup:',
              storageError,
            );
          }

          // payment_transactions.order_id uses ON DELETE RESTRICT, so the
          // ledger rows must be removed before the order itself can be
          // cascaded. The tombstone above already preserved the financial
          // summary for audit.
          const {
            error:
              paymentsDeleteError,
          } =
            await ctx
              .supabaseAdmin
              .from(
                'payment_transactions',
              )
              .delete()
              .eq(
                'order_id',
                order.id,
              );

          if (
            paymentsDeleteError
          ) {
            throw paymentsDeleteError;
          }

          const {
            error:
              deleteError,
          } =
            await ctx
              .supabaseAdmin
              .from(
                'orders',
              )
              .delete()
              .eq(
                'id',
                order.id,
              );

          if (
            deleteError
          ) {
            throw deleteError;
          }

          return json({
            success: true,
            deleted: true,
          });
        }

        /* ====================================================
           PHASE 2 — SCOPE
           ==================================================== */

        if (
          action ===
          'save_project_scope'
        ) {
          const {
            error: scopeError,
          } =
            await ctx
              .supabaseAdmin
              .from(
                'project_scope',
              )
              .upsert(
                {
                  order_id:
                    order.id,

                  summary:
                    clean(
                      body?.summary,
                      5000,
                    ) ||
                    null,

                  deliverables_summary:
                    clean(
                      body?.deliverablesSummary,
                      5000,
                    ) ||
                    null,

                  included_revisions:
                    clean(
                      body?.includedRevisions,
                      2000,
                    ) ||
                    null,

                  features:
                    clean(
                      body?.features,
                      5000,
                    ) ||
                    null,

                  pages:
                    clean(
                      body?.pages,
                      2000,
                    ) ||
                    null,

                  platforms:
                    clean(
                      body?.platforms,
                      2000,
                    ) ||
                    null,

                  dependencies:
                    clean(
                      body?.dependencies,
                      3000,
                    ) ||
                    null,

                  exclusions:
                    clean(
                      body?.exclusions,
                      3000,
                    ) ||
                    null,

                  client_responsibilities:
                    clean(
                      body?.clientResponsibilities,
                      3000,
                    ) ||
                    null,

                  visible_to_client:
                    body?.visibleToClient !==
                    false,

                  created_by:
                    adminUserId,

                  updated_by:
                    adminUserId,
                },
                {
                  onConflict:
                    'order_id',
                },
              );

          if (
            scopeError
          ) {
            throw scopeError;
          }

          await logAdminAction(
            ctx.supabaseAdmin,
            {
              adminUserId,

              orderId:
                order.id,

              action:
                'scope_saved',

              description:
                `Project scope documented for ${order.reference}.`,

              metadata: {},
            },
          );

          return json({
            success: true,
          });
        }

        /* ====================================================
           PHASE 2 — MILESTONES + TASKS
           ==================================================== */

        if (
          action ===
          'save_milestone'
        ) {
          const milestoneId =
            clean(
              body?.milestoneId,
              100,
            );

          const title =
            clean(
              body?.title,
              160,
            );

          if (!title) {
            return json(
              {
                success: false,

                message:
                  'Give the milestone a clear title.',
              },
              400,
            );
          }

          const status =
            clean(
              body?.status,
              30,
            ) ||
            'pending';

          if (
            ![
              'pending',
              'active',
              'blocked',
              'done',
              'cancelled',
            ].includes(
              status,
            )
          ) {
            return json(
              {
                success: false,

                message:
                  'Choose a valid milestone status.',
              },
              400,
            );
          }

          const row: Record<
            string,
            unknown
          > = {
            order_id:
              order.id,

            title,

            description:
              clean(
                body?.description,
                3000,
              ) ||
              null,

            sequence:
              Number.isFinite(
                Number(
                  body?.sequence,
                ),
              )
                ? Math.round(
                    Number(
                      body?.sequence,
                    ),
                  )
                : 0,

            status,

            expected_date:
              body?.expectedDate ||
              null,

            client_visible:
              body?.clientVisible !==
              false,

            created_by:
              adminUserId,
          };

          if (
            status ===
            'done'
          ) {
            row.completed_date =
              new Date()
                .toISOString()
                .slice(
                  0,
                  10,
                );

            row.completed_by =
              adminUserId;
          } else {
            row.completed_date =
              null;

            row.completed_by =
              null;
          }

          let savedId =
            milestoneId ||
            null;

          if (
            milestoneId
          ) {
            const {
              error:
                milestoneError,
            } =
              await ctx
                .supabaseAdmin
                .from(
                  'project_milestones',
                )
                .update(
                  row,
                )
                .eq(
                  'id',
                  milestoneId,
                )
                .eq(
                  'order_id',
                  order.id,
                );

            if (
              milestoneError
            ) {
              throw milestoneError;
            }
          } else {
            const {
              data: created,
              error:
                milestoneError,
            } =
              await ctx
                .supabaseAdmin
                .from(
                  'project_milestones',
                )
                .insert(
                  row,
                )
                .select(
                  'id',
                )
                .single();

            if (
              milestoneError ||
              !created
            ) {
              throw (
                milestoneError ||
                new Error(
                  'The milestone could not be saved.',
                )
              );
            }

            savedId =
              created.id;
          }

          await logAdminAction(
            ctx.supabaseAdmin,
            {
              adminUserId,

              orderId:
                order.id,

              action:
                status ===
                'done'
                  ? 'milestone_completed'
                  : 'milestone_saved',

              description:
                `Milestone "${title}" ${milestoneId ? 'updated' : 'added'} for ${order.reference}.`,

              metadata: {
                milestone_id:
                  savedId,

                status,
              },
            },
          );

          if (
            status ===
            'done'
          ) {
            await createNotification(
              ctx.supabaseAdmin,
              {
                order,

                type:
                  'milestone_completed',

                payload: {
                  milestone_id:
                    savedId,

                  title,
                },
              },
            );

            await runAutomations(
              ctx.supabaseAdmin,
              'milestone_completed',
              {
                orderId:
                  order.id,
                origin:
                  'admin-order-action',
              },
              adminUserId,
            );
          }

          return json({
            success: true,

            milestoneId:
              savedId,
          });
        }

        if (
          action ===
          'delete_milestone'
        ) {
          const milestoneId =
            clean(
              body?.milestoneId,
              100,
            );

          if (
            !milestoneId
          ) {
            return json(
              {
                success: false,

                message:
                  'A milestone reference is required.',
              },
              400,
            );
          }

          const {
            error:
              milestoneError,
          } =
            await ctx
              .supabaseAdmin
              .from(
                'project_milestones',
              )
              .delete()
              .eq(
                'id',
                milestoneId,
              )
              .eq(
                'order_id',
                order.id,
              );

          if (
            milestoneError
          ) {
            throw milestoneError;
          }

          await logAdminAction(
            ctx.supabaseAdmin,
            {
              adminUserId,

              orderId:
                order.id,

              action:
                'milestone_deleted',

              description:
                `A milestone was removed from ${order.reference}.`,

              metadata: {
                milestone_id:
                  milestoneId,
              },
            },
          );

          return json({
            success: true,
          });
        }

        if (
          action ===
          'save_task'
        ) {
          const taskId =
            clean(
              body?.taskId,
              100,
            );

          const title =
            clean(
              body?.title,
              200,
            );

          if (!title) {
            return json(
              {
                success: false,

                message:
                  'Describe the task before saving.',
              },
              400,
            );
          }

          const status =
            clean(
              body?.status,
              30,
            ) ||
            'open';

          if (
            ![
              'backlog',
              'ready',
              'open',
              'in_progress',
              'in_review',
              'blocked',
              'waiting_on_client',
              'done',
              'cancelled',
            ].includes(
              status,
            )
          ) {
            return json(
              {
                success: false,

                message:
                  'Choose a valid task status.',
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
            ![
              'low',
              'normal',
              'high',
              'urgent',
            ].includes(
              priority,
            )
          ) {
            return json(
              {
                success: false,
                message:
                  'Choose a valid task priority.',
              },
              400,
            );
          }

          const estimateMinutes =
            body?.estimate_minutes ===
              null ||
            body?.estimate_minutes ===
              undefined ||
            body?.estimate_minutes ===
              ''
              ? null
              : Math.round(
                  Number(
                    body.estimate_minutes,
                  ),
                );

          if (
            estimateMinutes !==
              null &&
            (
              !Number.isFinite(
                estimateMinutes,
              ) ||
              estimateMinutes <
                0
            )
          ) {
            return json(
              {
                success: false,
                message:
                  'Enter a valid time estimate in minutes.',
              },
              400,
            );
          }

          const assigneeId =
            clean(
              body?.assignee_id,
              100,
            ) ||
            null;

          if (
            assigneeId
          ) {
            const {
              data: member,
            } =
              await ctx
                .supabaseAdmin
                .from(
                  'team_members',
                )
                .select(
                  'id,status',
                )
                .eq(
                  'id',
                  assigneeId,
                )
                .maybeSingle();

            if (
              !member ||
              member.status !==
                'active'
            ) {
              return json(
                {
                  success: false,
                  message:
                    'Choose an active team member.',
                },
                400,
              );
            }
          }

          const row: Record<
            string,
            unknown
          > = {
            order_id:
              order.id,

            milestone_id:
              clean(
                body?.milestoneId,
                100,
              ) ||
              null,

            title,

            description:
              clean(
                body?.description,
                5000,
              ) ||
              null,

            status,

            priority,

            estimate_minutes:
              estimateMinutes,

            assignee_id:
              assigneeId,

            client_visible:
              body?.clientVisible ===
              true,

            due_at:
              body?.dueAt ||
              null,

            started_at:
              status ===
              'in_progress'
                ? new Date()
                    .toISOString()
                : undefined,

            created_by:
              adminUserId,
          };

          if (
            row.started_at ===
            undefined
          ) {
            delete row.started_at;
          }

          if (taskId) {
            const {
              error:
                taskError,
            } =
              await ctx
                .supabaseAdmin
                .from(
                  'project_tasks',
                )
                .update(
                  row,
                )
                .eq(
                  'id',
                  taskId,
                )
                .eq(
                  'order_id',
                  order.id,
                );

            if (
              taskError
            ) {
              throw taskError;
            }
          } else {
            const {
              error:
                taskError,
            } =
              await ctx
                .supabaseAdmin
                .from(
                  'project_tasks',
                )
                .insert(
                  row,
                );

            if (
              taskError
            ) {
              throw taskError;
            }
          }

          await logAdminAction(
            ctx.supabaseAdmin,
            {
              adminUserId,

              orderId:
                order.id,

              action:
                'task_saved',

              description:
                `Task "${title}" saved for ${order.reference}.`,

              metadata: {
                client_visible:
                  row.client_visible,
              },
            },
          );

          return json({
            success: true,
          });
        }

        if (
          action ===
          'delete_task'
        ) {
          const taskId =
            clean(
              body?.taskId,
              100,
            );

          if (!taskId) {
            return json(
              {
                success: false,

                message:
                  'A task reference is required.',
              },
              400,
            );
          }

          const {
            error:
              taskError,
          } =
            await ctx
              .supabaseAdmin
              .from(
                'project_tasks',
              )
              .delete()
              .eq(
                'id',
                taskId,
              )
              .eq(
                'order_id',
                order.id,
              );

          if (
            taskError
          ) {
            throw taskError;
          }

          return json({
            success: true,
          });
        }

        if (
          action ===
          'task_depends_add'
        ) {
          const taskId =
            clean(
              body?.taskId,
              100,
            );

          const dependsOn =
            clean(
              body?.dependsOnTaskId,
              100,
            );

          if (
            !taskId ||
            !dependsOn
          ) {
            return json(
              {
                success: false,
                message:
                  'Both tasks are required.',
              },
              400,
            );
          }

          if (
            taskId ===
            dependsOn
          ) {
            return json(
              {
                success: false,
                message:
                  'A task cannot depend on itself.',
              },
              400,
            );
          }

          const {
            data: tasks,
          } =
            await ctx
              .supabaseAdmin
              .from(
                'project_tasks',
              )
              .select(
                'id',
              )
              .eq(
                'order_id',
                order.id,
              )
              .in(
                'id',
                [
                  taskId,
                  dependsOn,
                ],
              );

          if (
            !tasks ||
            tasks.length !==
              2
          ) {
            return json(
              {
                success: false,
                message:
                  'Both tasks must belong to this project.',
              },
              400,
            );
          }

          // Cycle guard: reject if dependsOn already transitively
          // depends on taskId.
          const seen =
            new Set<string>();

          const queue: string[] =
            [
              dependsOn,
            ];

          let cyclic =
            false;

          while (
            queue.length >
              0 &&
            !cyclic
          ) {
            const current =
              queue.shift()!;

            if (
              current ===
              taskId
            ) {
              cyclic =
                true;

              break;
            }

            if (
              seen.has(
                current,
              )
            ) {
              continue;
            }

            seen.add(
              current,
            );

            const {
              data: edges,
            } =
              await ctx
                .supabaseAdmin
                .from(
                  'task_dependencies',
                )
                .select(
                  'depends_on_task_id',
                )
                .eq(
                  'task_id',
                  current,
                );

            for (const edge of edges ||
              []) {
              queue.push(
                edge.depends_on_task_id,
              );
            }
          }

          if (cyclic) {
            return json(
              {
                success: false,
                message:
                  'This would create a dependency loop.',
              },
              400,
            );
          }

          const {
            error,
          } =
            await ctx
              .supabaseAdmin
              .from(
                'task_dependencies',
              )
              .upsert(
                {
                  task_id:
                    taskId,
                  depends_on_task_id:
                    dependsOn,
                },
                {
                  onConflict:
                    'task_id,depends_on_task_id',
                },
              );

          if (error) {
            throw error;
          }

          await logAdminAction(
            ctx.supabaseAdmin,
            {
              adminUserId,

              orderId:
                order.id,

              action:
                'task_dependency_added',

              description:
                `Task dependency recorded for ${order.reference}.`,

              metadata: {
                task_id:
                  taskId,
                depends_on:
                  dependsOn,
              },
            },
          );

          return json({
            success: true,
          });
        }

        if (
          action ===
          'task_depends_remove'
        ) {
          const taskId =
            clean(
              body?.taskId,
              100,
            );

          const dependsOn =
            clean(
              body?.dependsOnTaskId,
              100,
            );

          if (
            !taskId ||
            !dependsOn
          ) {
            return json(
              {
                success: false,
                message:
                  'Both tasks are required.',
              },
              400,
            );
          }

          const {
            error,
          } =
            await ctx
              .supabaseAdmin
              .from(
                'task_dependencies',
              )
              .delete()
              .eq(
                'task_id',
                taskId,
              )
              .eq(
                'depends_on_task_id',
                dependsOn,
              );

          if (error) {
            throw error;
          }

          return json({
            success: true,
          });
        }

        /* ====================================================
           PHASE 2 — DELIVERABLE UPLOAD PREPARATION
           Creates pending file rows (role deliverable) plus
           signed upload URLs, mirroring confirm-order-files.
           ==================================================== */

        if (
          action ===
          'prepare_deliverable_files'
        ) {
          const submittedFiles =
            Array.isArray(
              body?.files,
            )
              ? body.files
              : [];

          if (
            submittedFiles.length ===
              0 ||
            submittedFiles.length >
              6
          ) {
            return json(
              {
                success: false,

                message:
                  'Select between 1 and 6 files.',
              },
              400,
            );
          }

          const allowedMimeTypes =
            new Set([
              'image/png',
              'image/jpeg',
              'image/webp',
              'application/pdf',
              'application/msword',
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            ]);

          for (const file of submittedFiles) {
            if (
              !file ||
              typeof file.name !==
                'string' ||
              typeof file.size !==
                'number' ||
              file.size <= 0 ||
              file.size >
                10 *
                  1024 *
                  1024
            ) {
              return json(
                {
                  success: false,

                  message:
                    'Each selected file must be valid and no larger than 10 MB.',
                },
                400,
              );
            }

            if (
              file.type &&
              !allowedMimeTypes.has(
                file.type,
              )
            ) {
              return json(
                {
                  success: false,

                  message:
                    `Unsupported file type: ${clean(file.name, 255)}`,
                },
                400,
              );
            }
          }

          const uploads: Array<{
            fileId: string;
            clientIndex: number;
            path: string;
            token: string;
          }> = [];

          const preparedIds: string[] =
            [];

          try {
            for (
              let index = 0;
              index <
              submittedFiles.length;
              index += 1
            ) {
              const file =
                submittedFiles[
                  index
                ];

              const safeName =
                String(
                  file.name,
                )
                  .trim()
                  .replace(
                    /[^a-zA-Z0-9._-]/g,
                    '-',
                  )
                  .replace(
                    /-+/g,
                    '-',
                  )
                  .replace(
                    /^\.+/,
                    '',
                  ) ||
                'deliverable';

              const storagePath =
                `${order.customer_id}/${order.id}/deliverable-${crypto.randomUUID()}-${safeName}`;

              const {
                data: fileRecord,
                error: fileError,
              } =
                await ctx
                  .supabaseAdmin
                  .from(
                    'order_files',
                  )
                  .insert({
                    order_id:
                      order.id,

                    bucket_name:
                      'project-references',

                    storage_path:
                      storagePath,

                    original_name:
                      clean(
                        file.name,
                        255,
                      ),

                    mime_type:
                      file.type ||
                      null,

                    size_bytes:
                      Math.round(
                        file.size,
                      ),

                    upload_status:
                      'pending',

                    file_role:
                      'deliverable',
                  })
                  .select(
                    'id',
                  )
                  .single();

              if (
                fileError ||
                !fileRecord
              ) {
                throw (
                  fileError ||
                  new Error(
                    'Unable to prepare the deliverable file.',
                  )
                );
              }

              preparedIds.push(
                fileRecord.id,
              );

              const {
                data: signedUpload,
                error: uploadError,
              } =
                await ctx.supabaseAdmin.storage
                  .from(
                    'project-references',
                  )
                  .createSignedUploadUrl(
                    storagePath,
                  );

              if (
                uploadError ||
                !signedUpload
              ) {
                throw (
                  uploadError ||
                  new Error(
                    'Unable to prepare secure file upload.',
                  )
                );
              }

              uploads.push({
                fileId:
                  fileRecord.id,

                clientIndex:
                  index,

                path: signedUpload.path,

                token:
                  signedUpload.token,
              });
            }
          } catch (prepareError) {
            if (
              preparedIds.length >
              0
            ) {
              await ctx
                .supabaseAdmin
                .from(
                  'order_files',
                )
                .delete()
                .in(
                  'id',
                  preparedIds,
                );
            }

            throw prepareError;
          }

          return json({
            success: true,

            uploads,
          });
        }

        /* ====================================================
           PHASE 2 — PUBLISH DELIVERABLE VERSION
           Confirms storage objects, then creates a new version.
           History is never replaced.
           ==================================================== */

        if (
          action ===
          'publish_deliverable'
        ) {
          const deliverableId =
            clean(
              body?.deliverableId,
              100,
            );

          const title =
            clean(
              body?.title,
              160,
            );

          const fileIds =
            Array.isArray(
              body?.fileIds,
            )
              ? body.fileIds.filter(
                  (
                    value,
                  ) =>
                    typeof value ===
                      'string' &&
                    value.trim(),
                )
              : [];

          if (
            !deliverableId &&
            !title
          ) {
            return json(
              {
                success: false,

                message:
                  'Give the deliverable a clear title.',
              },
              400,
            );
          }

          if (
            fileIds.length ===
            0
          ) {
            return json(
              {
                success: false,

                message:
                  'Upload at least one file before publishing.',
              },
              400,
            );
          }

          const {
            data: fileRecords,
            error: filesError,
          } =
            await ctx
              .supabaseAdmin
              .from(
                'order_files',
              )
              .select(
                'id,storage_path,original_name,upload_status',
              )
              .eq(
                'order_id',
                order.id,
              )
              .in(
                'id',
                fileIds,
              );

          if (
            filesError
          ) {
            throw filesError;
          }

          if (
            !fileRecords ||
            fileRecords.length !==
              fileIds.length
          ) {
            return json(
              {
                success: false,

                message:
                  'One or more files could not be verified for this project.',
              },
              400,
            );
          }

          for (const file of fileRecords) {
            const {
              data: exists,
              error: existsError,
            } =
              await ctx.supabaseAdmin.storage
                .from(
                  'project-references',
                )
                .exists(
                  file.storage_path,
                );

            if (
              existsError ||
              exists !==
                true
            ) {
              return json(
                {
                  success: false,

                  message:
                    `The upload for ${file.original_name} has not finished yet.`,
                },
                400,
              );
            }
          }

          await ctx
            .supabaseAdmin
            .from(
              'order_files',
            )
            .update({
              upload_status:
                'uploaded',

              uploaded_at:
                new Date()
                  .toISOString(),

              file_role:
                body?.final === true
                  ? 'final_deliverable'
                  : 'deliverable',
            })
            .eq(
              'order_id',
              order.id,
            )
            .in(
              'id',
              fileIds,
            );

          let deliverable:
            any = null;

          if (
            deliverableId
          ) {
            const {
              data: existing,
              error:
                deliverableError,
            } =
              await ctx
                .supabaseAdmin
                .from(
                  'project_deliverables',
                )
                .select(
                  'id,title',
                )
                .eq(
                  'id',
                  deliverableId,
                )
                .eq(
                  'order_id',
                  order.id,
                )
                .maybeSingle();

            if (
              deliverableError ||
              !existing
            ) {
              return json(
                {
                  success: false,

                  message:
                    'The deliverable could not be found for this project.',
                },
                404,
              );
            }

            deliverable =
              existing;
          } else {
            const {
              data: created,
              error:
                deliverableError,
            } =
              await ctx
                .supabaseAdmin
                .from(
                  'project_deliverables',
                )
                .insert({
                  order_id:
                    order.id,

                  title,

                  description:
                    clean(
                      body?.description,
                      3000,
                    ) ||
                    null,

                  status:
                    'in_review',

                  client_approval_state:
                    'pending',

                  visible_to_client:
                    body?.visibleToClient !==
                    false,

                  created_by:
                    adminUserId,
                })
                .select(
                  'id,title',
                )
                .single();

            if (
              deliverableError ||
              !created
            ) {
              throw (
                deliverableError ||
                new Error(
                  'The deliverable could not be created.',
                )
              );
            }

            deliverable =
              created;
          }

          const {
            data: latestVersion,
          } =
            await ctx
              .supabaseAdmin
              .from(
                'deliverable_versions',
              )
              .select(
                'version_number',
              )
              .eq(
                'deliverable_id',
                deliverable.id,
              )
              .order(
                'version_number',
                {
                  ascending:
                    false,
                },
              )
              .limit(1)
              .maybeSingle();

          const nextVersion =
            Number(
              latestVersion?.version_number ||
                0,
            ) +
            1;

          const primaryFile =
            fileRecords[0];

          const {
            data: version,
            error:
              versionError,
          } =
            await ctx
              .supabaseAdmin
              .from(
                'deliverable_versions',
              )
              .insert({
                deliverable_id:
                  deliverable.id,

                order_id:
                  order.id,

                version_number:
                  nextVersion,

                file_id:
                  primaryFile.id,

                original_name:
                  primaryFile.original_name,

                notes:
                  clean(
                    body?.notes,
                    3000,
                  ) ||
                  null,

                uploaded_by:
                  adminUserId,

                approval_state:
                  'pending',
              })
              .select(
                'id',
              )
              .single();

          if (
            versionError ||
            !version
          ) {
            throw (
              versionError ||
              new Error(
                'The deliverable version could not be published.',
              )
            );
          }

          await ctx
            .supabaseAdmin
            .from(
              'project_deliverables',
            )
            .update({
              status:
                'in_review',

              client_approval_state:
                'pending',

              current_version_id:
                version.id,
            })
            .eq(
              'id',
              deliverable.id,
            );

          await createNotification(
            ctx.supabaseAdmin,
            {
              order,

              type:
                'deliverable_ready',

              payload: {
                deliverable_id:
                  deliverable.id,

                version_id:
                  version.id,

                version_number:
                  nextVersion,

                title:
                  deliverable.title,
              },
            },
          );

          await logAdminAction(
            ctx.supabaseAdmin,
            {
              adminUserId,

              orderId:
                order.id,

              action:
                'deliverable_published',

              description:
                `Deliverable "${deliverable.title}" V${nextVersion} published for ${order.reference}.`,

              metadata: {
                deliverable_id:
                  deliverable.id,

                version_id:
                  version.id,

                version_number:
                  nextVersion,

                file_count:
                  fileRecords.length,
              },
            },
          );

          await runAutomations(
            ctx.supabaseAdmin,
            'deliverable_published',
            {
              orderId:
                order.id,
              origin:
                'admin-order-action',
            },
            adminUserId,
          );

          return json({
            success: true,

            deliverableId:
              deliverable.id,

            versionNumber:
              nextVersion,
          });
        }

        /* ====================================================
           PHASE 2 — RESPOND TO REVISION
           ==================================================== */

        if (
          action ===
          'annotation_status'
        ) {
          const annotationId =
            clean(
              body?.annotationId,
              100,
            );

          const status =
            clean(
              body?.status,
              30,
            );

          if (
            ![
              'acknowledged',
              'resolved',
              'reopened',
            ].includes(
              status,
            )
          ) {
            return json(
              {
                success: false,
                message:
                  'Choose a valid annotation status.',
              },
              400,
            );
          }

          const {
            data: annotation,
          } =
            await ctx
              .supabaseAdmin
              .from(
                'proof_annotations',
              )
              .select(
                'id,version_id',
              )
              .eq(
                'id',
                annotationId,
              )
              .maybeSingle();

          if (!annotation) {
            return json(
              {
                success: false,
                message:
                  'The comment could not be found.',
              },
              404,
            );
          }

          const {
            data: version,
          } =
            await ctx
              .supabaseAdmin
              .from(
                'deliverable_versions',
              )
              .select(
                'order_id',
              )
              .eq(
                'id',
                annotation.version_id,
              )
              .maybeSingle();

          if (
            !version ||
            version.order_id !==
              order.id
          ) {
            return json(
              {
                success: false,
                message:
                  'This comment does not belong to this project.',
              },
              403,
            );
          }

          const {
            error,
          } =
            await ctx
              .supabaseAdmin
              .from(
                'proof_annotations',
              )
              .update({
                status,
              })
              .eq(
                'id',
                annotationId,
              );

          if (error) {
            throw error;
          }

          await logAdminAction(
            ctx.supabaseAdmin,
            {
              adminUserId,

              orderId:
                order.id,

              action:
                'annotation_updated',

              description:
                `Proofing comment marked as ${status}.`,

              metadata: {
                annotation_id:
                  annotationId,
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
          'annotation_reply'
        ) {
          const versionId =
            clean(
              body?.versionId,
              100,
            );

          const replyBody =
            clean(
              body?.body,
              2000,
            );

          if (
            !versionId ||
            !replyBody
          ) {
            return json(
              {
                success: false,
                message:
                  'Select a thread and write a reply.',
              },
              400,
            );
          }

          const {
            data: version,
          } =
            await ctx
              .supabaseAdmin
              .from(
                'deliverable_versions',
              )
              .select(
                'id,order_id',
              )
              .eq(
                'id',
                versionId,
              )
              .eq(
                'order_id',
                order.id,
              )
              .maybeSingle();

          if (!version) {
            return json(
              {
                success: false,
                message:
                  'This version does not belong to this project.',
              },
              403,
            );
          }

          const parentId =
            clean(
              body?.parentId,
              100,
            ) ||
            null;

          if (parentId) {
            const {
              data: parent,
            } =
              await ctx
                .supabaseAdmin
                .from(
                  'proof_annotations',
                )
                .select(
                  'id,version_id',
                )
                .eq(
                  'id',
                  parentId,
                )
                .maybeSingle();

            if (
              !parent ||
              parent.version_id !==
                versionId
            ) {
              return json(
                {
                  success: false,
                  message:
                    'The thread could not be found.',
                },
                404,
              );
            }
          }

          const {
            error,
          } =
            await ctx
              .supabaseAdmin
              .from(
                'proof_annotations',
              )
              .insert({
                version_id:
                  versionId,
                body: replyBody,
                author_user_id:
                  adminUserId,
                author_kind:
                  'team',
                status:
                  'acknowledged',
                parent_id:
                  parentId,
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
          'respond_revision'
        ) {
          const revisionId =
            clean(
              body?.revisionId,
              100,
            );

          const status =
            clean(
              body?.status,
              40,
            );

          if (
            !revisionId
          ) {
            return json(
              {
                success: false,

                message:
                  'A revision reference is required.',
              },
              400,
            );
          }

          if (
            ![
              'acknowledged',
              'in_progress',
              'resolved',
              'rejected_out_of_scope',
            ].includes(
              status,
            )
          ) {
            return json(
              {
                success: false,

                message:
                  'Choose a valid revision status.',
              },
              400,
            );
          }

          const managementResponse =
            clean(
              body?.managementResponse,
              3000,
            );

          if (
            (
              status ===
                'resolved' ||
              status ===
                'rejected_out_of_scope'
            ) &&
            !managementResponse
          ) {
            return json(
              {
                success: false,

                message:
                  'Explain the resolution before closing this revision.',
              },
              400,
            );
          }

          const patch: Record<
            string,
            unknown
          > = {
            status,

            management_response:
              managementResponse ||
              null,
          };

          if (
            status ===
            'resolved'
          ) {
            patch.resolved_by =
              adminUserId;

            patch.resolved_at =
              new Date()
                .toISOString();
          }

          const {
            error:
              revisionError,
          } =
            await ctx
              .supabaseAdmin
              .from(
                'revision_requests',
              )
              .update(
                patch,
              )
              .eq(
                'id',
                revisionId,
              )
              .eq(
                'order_id',
                order.id,
              );

          if (
            revisionError
          ) {
            throw revisionError;
          }

          await createNotification(
            ctx.supabaseAdmin,
            {
              order,

              type:
                'revision_updated',

              payload: {
                revision_id:
                  revisionId,

                status,

                message:
                  managementResponse ||
                  null,
              },
            },
          );

          await logAdminAction(
            ctx.supabaseAdmin,
            {
              adminUserId,

              orderId:
                order.id,

              action:
                'revision_updated',

              description:
                `Revision request ${status.replaceAll('_', ' ')} for ${order.reference}.`,

              metadata: {
                revision_id:
                  revisionId,

                status,
              },
            },
          );

          return json({
            success: true,
          });
        }

        /* ====================================================
           PHASE 2 — CHANGE REQUESTS
           ==================================================== */

        if (
          action ===
          'create_change_request'
        ) {
          const title =
            clean(
              body?.title,
              160,
            );

          if (!title) {
            return json(
              {
                success: false,

                message:
                  'Give the change request a clear title.',
              },
              400,
            );
          }

          const additionalCostKobo =
            Math.round(
              Number(
                body?.additionalCostKobo ||
                  0,
              ),
            );

          if (
            !Number.isFinite(
              additionalCostKobo,
            ) ||
            additionalCostKobo <
              0
          ) {
            return json(
              {
                success: false,

                message:
                  'Enter a valid additional cost.',
              },
              400,
            );
          }

          const {
            data: created,
            error:
              changeError,
          } =
            await ctx
              .supabaseAdmin
              .from(
                'change_requests',
              )
              .insert({
                order_id:
                  order.id,

                title,

                description:
                  clean(
                    body?.description,
                    5000,
                  ) ||
                  null,

                additional_cost_kobo:
                  additionalCostKobo,

                timeline_impact_days:
                  Math.round(
                    Number(
                      body?.timelineImpactDays ||
                        0,
                    ),
                  ) ||
                  0,

                payment_requirement_note:
                  clean(
                    body?.paymentRequirementNote,
                    2000,
                  ) ||
                  null,

                requires_client_approval:
                  body?.requiresClientApproval !==
                  false,

                status:
                  'draft',

                created_by:
                  adminUserId,
              })
              .select(
                'id',
              )
              .single();

          if (
            changeError ||
            !created
          ) {
            throw (
              changeError ||
              new Error(
                'The change request could not be created.',
              )
            );
          }

          await logAdminAction(
            ctx.supabaseAdmin,
            {
              adminUserId,

              orderId:
                order.id,

              action:
                'change_request_created',

              description:
                `Change request "${title}" prepared for ${order.reference}.`,

              metadata: {
                change_request_id:
                  created.id,

                additional_cost_kobo:
                  additionalCostKobo,
              },
            },
          );

          return json({
            success: true,

            changeRequestId:
              created.id,
          });
        }

        if (
          action ===
          'send_change_request'
        ) {
          const changeId =
            clean(
              body?.changeId,
              100,
            );

          if (!changeId) {
            return json(
              {
                success: false,

                message:
                  'A change-request reference is required.',
              },
              400,
            );
          }

          const {
            data: change,
            error:
              changeError,
          } =
            await ctx
              .supabaseAdmin
              .from(
                'change_requests',
              )
              .select(
                'id,title,status',
              )
              .eq(
                'id',
                changeId,
              )
              .eq(
                'order_id',
                order.id,
              )
              .maybeSingle();

          if (
            changeError ||
            !change
          ) {
            return json(
              {
                success: false,

                message:
                  'The change request could not be found.',
              },
              404,
            );
          }

          if (
            change.status !==
            'draft'
          ) {
            return json(
              {
                success: false,

                message:
                  'Only draft change requests can be sent.',
              },
              409,
            );
          }

          const {
            error:
              updateError,
          } =
            await ctx
              .supabaseAdmin
              .from(
                'change_requests',
              )
              .update({
                status:
                  'sent',
              })
              .eq(
                'id',
                changeId,
              );

          if (
            updateError
          ) {
            throw updateError;
          }

          await createNotification(
            ctx.supabaseAdmin,
            {
              order,

              type:
                'change_request_sent',

              payload: {
                change_request_id:
                  changeId,

                title:
                  change.title,
              },
            },
          );

          await logAdminAction(
            ctx.supabaseAdmin,
            {
              adminUserId,

              orderId:
                order.id,

              action:
                'change_request_sent',

              description:
                `Change request "${change.title}" sent to the client.`,

              metadata: {
                change_request_id:
                  changeId,
              },
            },
          );

          return json({
            success: true,
          });
        }

        if (
          action ===
          'cancel_change_request'
        ) {
          const changeId =
            clean(
              body?.changeId,
              100,
            );

          if (!changeId) {
            return json(
              {
                success: false,

                message:
                  'A change-request reference is required.',
              },
              400,
            );
          }

          const {
            error:
              updateError,
          } =
            await ctx
              .supabaseAdmin
              .from(
                'change_requests',
              )
              .update({
                status:
                  'cancelled',
              })
              .eq(
                'id',
                changeId,
              )
              .eq(
                'order_id',
                order.id,
              )
              .in(
                'status',
                [
                  'draft',
                  'sent',
                  'questioned',
                ],
              );

          if (
            updateError
          ) {
            throw updateError;
          }

          await logAdminAction(
            ctx.supabaseAdmin,
            {
              adminUserId,

              orderId:
                order.id,

              action:
                'change_request_cancelled',

              description:
                `A change request was cancelled for ${order.reference}.`,

              metadata: {
                change_request_id:
                  changeId,
              },
            },
          );

          return json({
            success: true,
          });
        }

        if (
          action ===
          'implement_change_request'
        ) {
          const changeId =
            clean(
              body?.changeId,
              100,
            );

          if (!changeId) {
            return json(
              {
                success: false,

                message:
                  'A change-request reference is required.',
              },
              400,
            );
          }

          const {
            data: change,
            error:
              changeError,
          } =
            await ctx
              .supabaseAdmin
              .from(
                'change_requests',
              )
              .select(
                '*',
              )
              .eq(
                'id',
                changeId,
              )
              .eq(
                'order_id',
                order.id,
              )
              .maybeSingle();

          if (
            changeError ||
            !change
          ) {
            return json(
              {
                success: false,

                message:
                  'The change request could not be found.',
              },
              404,
            );
          }

          if (
            change.status !==
            'accepted'
          ) {
            return json(
              {
                success: false,

                message:
                  'Only accepted change requests can be implemented.',
              },
              409,
            );
          }

          let costId =
            change.implemented_cost_id ||
            null;

          if (
            Number(
              change.additional_cost_kobo ||
                0,
            ) > 0 &&
            !costId
          ) {
            const {
              data: finance,
              error:
                costError,
            } =
              await ctx
                .supabase
                .rpc(
                  'admin_add_project_cost',
                  {
                    p_order_id:
                      order.id,

                    p_title:
                      `Change: ${String(change.title).slice(0, 120)}`,

                    p_amount_kobo:
                      Number(
                        change.additional_cost_kobo,
                      ),

                    p_description:
                      change.description ||
                      null,

                    p_due_at:
                      null,
                  },
                );

            if (
              costError
            ) {
              throw costError;
            }

            costId =
              (
                finance as any
              )?.cost_id ||
              (
                finance as any
              )?.cost?.id ||
              null;
          }

          const {
            error:
              updateError,
          } =
            await ctx
              .supabaseAdmin
              .from(
                'change_requests',
              )
              .update({
                status:
                  'implemented',

                implemented_cost_id:
                  costId,
              })
              .eq(
                'id',
                changeId,
              );

          if (
            updateError
          ) {
            throw updateError;
          }

          await createNotification(
            ctx.supabaseAdmin,
            {
              order,

              type:
                'change_request_implemented',

              payload: {
                change_request_id:
                  changeId,

                title:
                  change.title,
              },
            },
          );

          await logAdminAction(
            ctx.supabaseAdmin,
            {
              adminUserId,

              orderId:
                order.id,

              action:
                'change_request_implemented',

              description:
                `Change request "${change.title}" implemented for ${order.reference}.`,

              metadata: {
                change_request_id:
                  changeId,

                implemented_cost_id:
                  costId,
              },
            },
          );

          return json({
            success: true,

            costId,
          });
        }

        /* ====================================================
           PHASE 2 — INTERNAL COSTS (management-only)
           ==================================================== */

        if (
          action ===
          'record_internal_cost'
        ) {
          const title =
            clean(
              body?.title,
              160,
            );

          const amountKobo =
            Math.round(
              Number(
                body?.amountKobo,
              ),
            );

          const category =
            clean(
              body?.category,
              40,
            ) ||
            'miscellaneous';

          if (!title) {
            return json(
              {
                success: false,

                message:
                  'Describe the internal cost.',
              },
              400,
            );
          }

          if (
            !Number.isFinite(
              amountKobo,
            ) ||
            amountKobo <=
              0
          ) {
            return json(
              {
                success: false,

                message:
                  'Enter a valid cost amount greater than zero.',
              },
              400,
            );
          }

          if (
            ![
              'software',
              'freelancer',
              'hosting',
              'domain',
              'stock_asset',
              'advertising',
              'contractor',
              'miscellaneous',
            ].includes(
              category,
            )
          ) {
            return json(
              {
                success: false,

                message:
                  'Choose a valid cost category.',
              },
              400,
            );
          }

          const {
            error:
              costError,
          } =
            await ctx
              .supabaseAdmin
              .from(
                'internal_costs',
              )
              .insert({
                order_id:
                  order.id,

                title,

                category,

                amount_kobo:
                  amountKobo,

                incurred_at:
                  body?.incurredAt ||
                  null,

                note:
                  clean(
                    body?.note,
                    2000,
                  ) ||
                  null,

                created_by:
                  adminUserId,
              });

          if (
            costError
          ) {
            throw costError;
          }

          await logAdminAction(
            ctx.supabaseAdmin,
            {
              adminUserId,

              orderId:
                order.id,

              action:
                'internal_cost_recorded',

              description:
                `Internal cost "${title}" recorded for ${order.reference}.`,

              metadata: {
                amount_kobo:
                  amountKobo,

                category,
              },
            },
          );

          return json({
            success: true,
          });
        }

        if (
          action ===
          'delete_internal_cost'
        ) {
          const costId =
            clean(
              body?.costId,
              100,
            );

          if (!costId) {
            return json(
              {
                success: false,

                message:
                  'A cost reference is required.',
              },
              400,
            );
          }

          const {
            error:
              costError,
          } =
            await ctx
              .supabaseAdmin
              .from(
                'internal_costs',
              )
              .delete()
              .eq(
                'id',
                costId,
              )
              .eq(
                'order_id',
                order.id,
              );

          if (
            costError
          ) {
            throw costError;
          }

          await logAdminAction(
            ctx.supabaseAdmin,
            {
              adminUserId,

              orderId:
                order.id,

              action:
                'internal_cost_removed',

              description:
                `An internal cost was removed from ${order.reference}.`,

              metadata: {
                cost_id:
                  costId,
              },
            },
          );

          return json({
            success: true,
          });
        }

        /* ====================================================
           PHASE 2 — CRM NOTE (management-only)
           ==================================================== */

        if (
          action ===
          'save_client_note'
        ) {
          const note =
            clean(
              body?.note,
              5000,
            );

          if (!note) {
            return json(
              {
                success: false,

                message:
                  'Write the note before saving.',
              },
              400,
            );
          }

          const {
            error:
              noteError,
          } =
            await ctx
              .supabaseAdmin
              .from(
                'client_notes',
              )
              .insert({
                customer_id:
                  order.customer_id,

                order_id:
                  order.id,

                note,

                created_by:
                  adminUserId,
              });

          if (
            noteError
          ) {
            throw noteError;
          }

          await logAdminAction(
            ctx.supabaseAdmin,
            {
              adminUserId,

              orderId:
                order.id,

              action:
                'client_note_saved',

              description:
                `An internal note was saved for ${order.reference}.`,

              metadata: {},
            },
          );

          return json({
            success: true,
          });
        }

        /* ====================================================
           PHASE 2 — QUOTE ITEMS
           ==================================================== */

        if (
          action ===
          'save_quote_items'
        ) {
          const quoteId =
            clean(
              body?.quoteId,
              100,
            );

          const items =
            Array.isArray(
              body?.items,
            )
              ? body.items
              : [];

          if (!quoteId) {
            return json(
              {
                success: false,

                message:
                  'A quote reference is required.',
              },
              400,
            );
          }

          const {
            data: quote,
            error:
              quoteError,
          } =
            await ctx
              .supabaseAdmin
              .from(
                'order_quotes',
              )
              .select(
                'id,order_id,amount_kobo',
              )
              .eq(
                'id',
                quoteId,
              )
              .eq(
                'order_id',
                order.id,
              )
              .maybeSingle();

          if (
            quoteError ||
            !quote
          ) {
            return json(
              {
                success: false,

                message:
                  'The quote could not be found for this project.',
              },
              404,
            );
          }

          const rows: Array<
            Record<
              string,
              unknown
            >
          > = [];

          let lineTotal = 0;

          for (
            let index = 0;
            index <
            items.length;
            index += 1
          ) {
            const item =
              items[
                index
              ] || {};

            const title =
              clean(
                item.title,
                160,
              );

            if (!title) {
              continue;
            }

            const quantity =
              Number(
                item.quantity ||
                  1,
              ) > 0
                ? Number(
                    item.quantity ||
                      1,
                  )
                : 1;

            const unitPrice =
              Math.round(
                Number(
                  item.unitPriceKobo ||
                    0,
                ),
              );

            if (
              !Number.isFinite(
                unitPrice,
              ) ||
              unitPrice < 0
            ) {
              return json(
                {
                  success: false,

                  message:
                    `Enter a valid price for "${title}".`,
                },
                400,
              );
            }

            const amount =
              Math.round(
                quantity *
                  unitPrice,
              );

            lineTotal +=
              amount;

            rows.push({
              quote_id:
                quoteId,

              title,

              description:
                clean(
                  item.description,
                  2000,
                ) ||
                null,

              quantity,

              unit_price_kobo:
                unitPrice,

              amount_kobo:
                amount,

              sort_order:
                index,
            });
          }

          if (
            rows.length ===
            0
          ) {
            return json(
              {
                success: false,

                message:
                  'Add at least one quote item with a title.',
              },
              400,
            );
          }

          await ctx
            .supabaseAdmin
            .from(
              'order_quote_items',
            )
            .delete()
            .eq(
              'quote_id',
              quoteId,
            );

          const {
            error:
              itemsError,
          } =
            await ctx
              .supabaseAdmin
              .from(
                'order_quote_items',
              )
              .insert(
                rows,
              );

          if (
            itemsError
          ) {
            throw itemsError;
          }

          await logAdminAction(
            ctx.supabaseAdmin,
            {
              adminUserId,

              orderId:
                order.id,

              action:
                'quote_items_saved',

              description:
                `Quote breakdown saved for ${order.reference} (${rows.length} items, ${lineTotal} kobo).`,

              metadata: {
                quote_id:
                  quoteId,

                line_total_kobo:
                  lineTotal,

                quote_total_kobo:
                  quote.amount_kobo,
              },
            },
          );

          return json({
            success: true,

            lineTotalKobo:
              lineTotal,
          });
        }

        /* ====================================================
           PHASE 2 — CLOSEOUT (deliver then complete)
           ==================================================== */

        if (
          action ===
          'mark_delivered'
        ) {
          if (
            [
              'completed',
              'cancelled',
            ].includes(
              order.status,
            )
          ) {
            return json(
              {
                success: false,

                message:
                  'This project is already closed.',
              },
              409,
            );
          }

          const {
            data: pendingApprovals,
          } =
            await ctx
              .supabaseAdmin
              .from(
                'project_deliverables',
              )
              .select(
                'id',
              )
              .eq(
                'order_id',
                order.id,
              )
              .eq(
                'client_approval_state',
                'pending',
              )
              .limit(1);

          if (
            pendingApprovals &&
            pendingApprovals.length >
              0
          ) {
            return json(
              {
                success: false,

                message:
                  'Deliverables are still waiting for client review. Resolve approvals before delivery.',
              },
              409,
            );
          }

          const now =
            new Date()
              .toISOString();

          const {
            error:
              deliverError,
          } =
            await ctx
              .supabaseAdmin
              .from(
                'orders',
              )
              .update({
                project_phase:
                  'delivered',

                delivered_at:
                  now,

                last_admin_activity_at:
                  now,
              })
              .eq(
                'id',
                order.id,
              );

          if (
            deliverError
          ) {
            throw deliverError;
          }

          await createNotification(
            ctx.supabaseAdmin,
            {
              order,

              type:
                'project_delivered',

              payload: {
                delivery_note:
                  clean(
                    body?.deliveryNote,
                    3000,
                  ) ||
                  null,
              },
            },
          );

          await logAdminAction(
            ctx.supabaseAdmin,
            {
              adminUserId,

              orderId:
                order.id,

              action:
                'project_delivered',

              description:
                `Project ${order.reference} marked as delivered.`,

              metadata: {},
            },
          );

          return json({
            success: true,
          });
        }

        if (
          action ===
          'complete_project'
        ) {
          if (
            order.status ===
            'cancelled'
          ) {
            return json(
              {
                success: false,

                message:
                  'A cancelled project cannot be completed.',
              },
              409,
            );
          }

          if (
            !order.delivered_at &&
            body?.confirmUndelivered !==
              true
          ) {
            return json(
              {
                success: false,

                message:
                  'Mark the project as delivered before completing it.',
              },
              409,
            );
          }

          const total =
            Number(
              order.quoted_amount_kobo ||
                0,
            );

          const paid =
            Number(
              order.paid_amount_kobo ||
                0,
            );

          const outstanding =
            Math.max(
              total -
                paid,
              0,
            );

          if (
            outstanding > 0 &&
            body?.overrideFinancial !==
              true
          ) {
            return json(
              {
                success: false,

                outstandingKobo:
                  outstanding,

                message:
                  `An outstanding balance of ${outstanding} kobo remains. Collect it or confirm a management override.`,
              },
              409,
            );
          }

          const now =
            new Date()
              .toISOString();

          const {
            error:
              completeError,
          } =
            await ctx
              .supabaseAdmin
              .from(
                'orders',
              )
              .update({
                status:
                  'completed',

                project_phase:
                  'completed',

                completed_at:
                  now,

                customer_action_required:
                  false,

                customer_action_label:
                  null,

                last_admin_activity_at:
                  now,
              })
              .eq(
                'id',
                order.id,
              );

          if (
            completeError
          ) {
            throw completeError;
          }

          await createNotification(
            ctx.supabaseAdmin,
            {
              order,

              type:
                'project_completed',

              payload: {
                financial_override:
                  outstanding > 0,
              },
            },
          );

          await logAdminAction(
            ctx.supabaseAdmin,
            {
              adminUserId,

              orderId:
                order.id,

              action:
                'project_completed',

              description:
                `Project ${order.reference} completed${outstanding > 0 ? ' with a management financial override' : ''}.`,

              metadata: {
                outstanding_kobo:
                  outstanding,

                financial_override:
                  outstanding >
                  0,
              },
            },
          );

          await runAutomations(
            ctx.supabaseAdmin,
            'project_completed',
            {
              orderId:
                order.id,
              origin:
                'admin-order-action',
            },
            adminUserId,
          );

          return json({
            success: true,
          });
        }

        return json(
          {
            success: false,

            message:
              'Unsupported administrative action.',
          },
          400,
        );
      } catch (error) {
        console.error(
          'admin-order-action:',
          error,
        );

        return json(
          {
            success: false,

            message:
              error instanceof Error
                ? error.message
                : 'Administrative action could not be completed.',
          },
          500,
        );
      }
    },
  ),
};
