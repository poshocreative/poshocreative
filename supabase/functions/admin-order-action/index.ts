import {
  withSupabase,
} from 'npm:@supabase/server@^1';

const allowedStatuses =
  new Set([
    'new',
    'under_review',
    'quote_sent',
    'awaiting_payment',
    'paid',
    'in_progress',
    'awaiting_client',
    'completed',
    'cancelled',
  ]);

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
        return Response.json(
          {
            success: false,
            message:
              'Method not allowed.',
          },
          {
            status: 405,
          },
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
          return Response.json(
            {
              success: false,
              message:
                'Administrative access is required.',
            },
            {
              status: 403,
            },
          );
        }

        const adminUserId =
          ctx.userClaims?.id;

        const body =
          await req.json();

        const action =
          typeof body
            ?.action ===
          'string'
            ? body.action
                .trim()
            : '';

        const orderId =
          typeof body
            ?.orderId ===
          'string'
            ? body.orderId
                .trim()
            : '';

        if (!orderId) {
          return Response.json(
            {
              success: false,
              message:
                'Order ID is required.',
            },
            {
              status: 400,
            },
          );
        }

        const {
          data: order,
          error: orderError,
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
              status,
              payment_status
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
          return Response.json(
            {
              success: false,
              message:
                'Project could not be found.',
            },
            {
              status: 404,
            },
          );
        }

        if (
          action ===
          'send_quote'
        ) {
          const amountKobo =
            Number(
              body
                ?.amountKobo,
            );

          if (
            !Number.isFinite(
              amountKobo,
            ) ||
            amountKobo <= 0
          ) {
            return Response.json(
              {
                success:
                  false,

                message:
                  'Enter a valid quote amount.',
              },
              {
                status: 400,
              },
            );
          }

          const message =
            typeof body
              ?.message ===
            'string'
              ? body.message
                  .trim()
                  .slice(
                    0,
                    5000,
                  )
              : '';

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
                'Quote could not be created.',
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

          await ctx
            .supabaseAdmin
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
                'quote_sent',

              status:
                'pending',

              payload: {
                reference:
                  order.reference,

                project_title:
                  order
                    .project_title,

                amount_kobo:
                  quote
                    .amount_kobo,

                quote_id:
                  quote.id,
              },
            });

          await ctx
            .supabaseAdmin
            .from(
              'admin_activity_log',
            )
            .insert({
              admin_user_id:
                adminUserId,

              order_id:
                order.id,

              action:
                'quote_sent',

              description:
                `Quote sent for ${order.reference}`,

              metadata: {
                quote_id:
                  quote.id,

                amount_kobo:
                  quote
                    .amount_kobo,
              },
            });

          return Response.json({
            success: true,
            quote,
          });
        }

        if (
          action ===
          'update_status'
        ) {
          const status =
            typeof body
              ?.status ===
            'string'
              ? body.status
                  .trim()
              : '';

          if (
            !allowedStatuses.has(
              status,
            )
          ) {
            return Response.json(
              {
                success:
                  false,

                message:
                  'Choose a valid project status.',
              },
              {
                status: 400,
              },
            );
          }

          const note =
            typeof body
              ?.note ===
            'string'
              ? body.note
                  .trim()
                  .slice(
                    0,
                    5000,
                  )
              : '';

          const patch: any = {
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

          await ctx
            .supabaseAdmin
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
                'status_changed',

              status:
                'pending',

              payload: {
                reference:
                  order.reference,

                project_title:
                  order
                    .project_title,

                status,

                message:
                  note ||
                  null,
              },
            });

          await ctx
            .supabaseAdmin
            .from(
              'admin_activity_log',
            )
            .insert({
              admin_user_id:
                adminUserId,

              order_id:
                order.id,

              action:
                'status_changed',

              description:
                `Project status changed to ${status}.`,

              metadata: {
                previous_status:
                  order.status,

                new_status:
                  status,
              },
            });

          return Response.json({
            success: true,
          });
        }

        if (
          action ===
          'add_note'
        ) {
          const note =
            typeof body
              ?.note ===
            'string'
              ? body.note
                  .trim()
                  .slice(
                    0,
                    5000,
                  )
              : '';

          const internal =
            body
              ?.isInternal ===
            true;

          if (!note) {
            return Response.json(
              {
                success:
                  false,

                message:
                  'Enter a note.',
              },
              {
                status: 400,
              },
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
            await ctx
              .supabaseAdmin
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
                  'project_update',

                status:
                  'pending',

                payload: {
                  reference:
                    order.reference,

                  project_title:
                    order
                      .project_title,

                  message:
                    note,
                },
              });
          }

          return Response.json({
            success: true,
            note:
              createdNote,
          });
        }

        return Response.json(
          {
            success: false,
            message:
              'Unsupported administrative action.',
          },
          {
            status: 400,
          },
        );
      } catch (error) {
        console.error(
          'admin-order-action:',
          error,
        );

        return Response.json(
          {
            success: false,

            message:
              error instanceof Error
                ? error.message
                : 'Administrative action failed.',
          },
          {
            status: 500,
          },
        );
      }
    },
  ),
};