import {
  withSupabase,
} from 'npm:@supabase/server@^1';

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

        if (
          accessError ||
          hasAdminAccess !==
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
            'successful'
          ) {
            return json(
              {
                success: false,

                message:
                  'This project has already been paid.',
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