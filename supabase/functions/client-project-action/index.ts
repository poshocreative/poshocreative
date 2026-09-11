import {
  withSupabase,
} from 'npm:@supabase/server@^1';

import {
  makeReference,
  runAutomations,
} from '../_shared/ops.ts';

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

async function ownCustomerId(
  ctx: any,
  userId: string,
): Promise<string | null> {
  const {
    data,
  } =
    await ctx
      .supabase
      .from(
        'customers',
      )
      .select(
        'id',
      )
      .eq(
        'user_id',
        userId,
      )
      .maybeSingle();

  return (
    data?.id ||
    null
  );
}

async function handleWorkspaceAction(
  ctx: any,
  {
    action,
    body,
    userId,
  }: {
    action: string;
    body: any;
    userId: string;
  },
) {
  const admin =
    ctx.supabaseAdmin;

  /* ====================================================
     PROPOSAL DECISION (accept / decline / clarify)
     Accepted proposals are historical records afterwards.
     ==================================================== */

  if (
    action ===
    'proposal_decide'
  ) {
    const proposalId =
      clean(
        body?.proposal_id,
        100,
      );

    const decision =
      clean(
        body?.decision,
        20,
      );

    if (
      ![
        'accept',
        'decline',
        'clarify',
      ].includes(
        decision,
      )
    ) {
      return json(
        {
          success: false,
          message:
            'Choose to accept, decline, or request clarification.',
        },
        400,
      );
    }

    const {
      data: proposal,
    } =
      await ctx
        .supabase
        .from(
          'proposals',
        )
        .select('*')
        .eq(
          'id',
          proposalId,
        )
        .maybeSingle();

    if (!proposal) {
      return json(
        {
          success: false,
          message:
            'This proposal is no longer available.',
        },
        404,
      );
    }

    if (
      ![
        'sent',
        'viewed',
      ].includes(
        proposal.status,
      )
    ) {
      return json(
        {
          success: false,
          message:
            'This proposal has already been decided.',
        },
        409,
      );
    }

    if (
      proposal.valid_until &&
      new Date(
        proposal.valid_until,
      ).getTime() <
        Date.now()
    ) {
      await admin
        .from(
          'proposals',
        )
        .update({
          status:
            'expired',
        })
        .eq(
          'id',
          proposal.id,
        );

      return json(
        {
          success: false,
          message:
            'This proposal has expired. Management can issue a new version.',
        },
        409,
      );
    }

    const note =
      clean(
        body?.note,
        2000,
      );

    if (
      decision !==
        'accept' &&
      !note
    ) {
      return json(
        {
          success: false,
          message:
            'Add a note so Management understands your response.',
        },
        400,
      );
    }

    const nextStatus =
      decision ===
      'accept'
        ? 'accepted'
        : decision ===
            'decline'
          ? 'declined'
          : 'sent';

    const {
      error,
    } =
      await admin
        .from(
          'proposals',
        )
        .update({
          status:
            nextStatus,
          decided_by:
            userId,
          decided_at:
            new Date()
              .toISOString(),
          decision_note:
            note ||
            null,
        })
        .eq(
          'id',
          proposal.id,
        );

    if (error) {
      throw error;
    }

    await admin
      .from(
        'admin_activity_log',
      )
      .insert({
        admin_user_id:
          null,
        order_id:
          proposal.order_id,
        action:
          `proposal_${decision === 'clarify' ? 'questioned' : decision}ed`,
        description:
          `Proposal "${proposal.title}" ${decision === 'accept' ? 'accepted' : decision === 'decline' ? 'declined' : 'questioned'} by the client.`,
        metadata: {
          proposal_id:
            proposal.id,
          actor: 'client',
        },
      });

    if (
      decision ===
      'accept'
    ) {
      await runAutomations(
        admin,
        'proposal_accepted',
        {
          orderId:
            proposal.order_id,
          origin:
            'client-project-action',
        },
        userId,
      );
    }

    return json({
      success: true,
      status:
        nextStatus,
    });
  }

  /* ====================================================
     AGREEMENT DECISION
     ==================================================== */

  if (
    action ===
    'agreement_decide'
  ) {
    const agreementId =
      clean(
        body?.agreement_id,
        100,
      );

    const decision =
      clean(
        body?.decision,
        20,
      );

    if (
      ![
        'accept',
        'decline',
      ].includes(
        decision,
      )
    ) {
      return json(
        {
          success: false,
          message:
            'Choose to accept or decline.',
        },
        400,
      );
    }

    const {
      data: agreement,
    } =
      await ctx
        .supabase
        .from(
          'agreements',
        )
        .select(
          'id,order_id,title,status',
        )
        .eq(
          'id',
          agreementId,
        )
        .maybeSingle();

    if (!agreement) {
      return json(
        {
          success: false,
          message:
            'This agreement is no longer available.',
        },
        404,
      );
    }

    if (
      agreement.status !==
      'sent'
    ) {
      return json(
        {
          success: false,
          message:
            'This agreement has already been decided.',
        },
        409,
      );
    }

    const {
      error,
    } =
      await admin
        .from(
          'agreements',
        )
        .update({
          status:
            decision ===
            'accept'
              ? 'accepted'
              : 'declined',
          accepted_by:
            decision ===
            'accept'
              ? userId
              : null,
          accepted_at:
            decision ===
            'accept'
              ? new Date()
                  .toISOString()
              : null,
          consent_note:
            clean(
              body?.consent_note,
              2000,
            ) ||
            null,
        })
        .eq(
          'id',
          agreement.id,
        );

    if (error) {
      throw error;
    }

    await admin
      .from(
        'admin_activity_log',
      )
      .insert({
        admin_user_id:
          null,
        order_id:
          agreement.order_id,
        action:
          decision ===
          'accept'
            ? 'agreement_accepted'
            : 'agreement_declined',
        description:
          `Agreement "${agreement.title}" ${decision}ed by the client.`,
        metadata: {
          agreement_id:
            agreement.id,
          actor: 'client',
        },
      });

    return json({
      success: true,
    });
  }

  /* ====================================================
     SERVICE REQUEST CREATION (client)
     ==================================================== */

  if (
    action ===
    'request_create'
  ) {
    const customerId =
      await ownCustomerId(
        ctx,
        userId,
      );

    if (!customerId) {
      return json(
        {
          success: false,
          message:
            'Your client profile could not be found.',
        },
        404,
      );
    }

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
            'Choose a valid priority.',
        },
        400,
      );
    }

    const orderId =
      clean(
        body?.order_id,
        100,
      ) ||
      null;

    if (orderId) {
      const {
        data: order,
      } =
        await ctx
          .supabase
          .from(
            'orders',
          )
          .select(
            'id',
          )
          .eq(
            'id',
            orderId,
          )
          .maybeSingle();

      if (!order) {
        return json(
          {
            success: false,
            message:
              'The linked project could not be found.',
          },
          404,
        );
      }
    }

    const {
      data: created,
      error,
    } =
      await admin
        .from(
          'service_requests',
        )
        .insert({
          reference:
            makeReference(
              'REQ',
            ),
          customer_id:
            customerId,
          organization_id: null,
          order_id:
            orderId,
          retainer_id: null,
          service_slug:
            clean(
              body?.service_slug,
              80,
            ) ||
            'creative-solutions',
          title,
          description,
          priority,
          status:
            'new',
          creator_user_id:
            userId,
          creator_kind:
            'client',
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
          'Your request could not be submitted.',
        )
      );
    }

    await runAutomations(
      admin,
      'request_created',
      {
        requestId:
          created.id,
        orderId,
        origin:
          'client-project-action',
      },
      userId,
    );

    return json({
      success: true,
      requestId:
        created.id,
      reference:
        created.reference,
    });
  }

  /* ====================================================
     PROOF ANNOTATIONS (metadata only)
     ==================================================== */

  if (
    action ===
      'annotation_save' ||
    action ===
      'annotation_reopen'
  ) {
    if (
      action ===
      'annotation_reopen'
    ) {
      const id =
        clean(
          body?.id,
          100,
        );

      const {
        data: existing,
      } =
        await ctx
          .supabase
          .from(
            'proof_annotations',
          )
          .select(
            'id,version_id',
          )
          .eq(
            'id',
            id,
          )
          .maybeSingle();

      if (!existing) {
        return json(
          {
            success: false,
            message:
              'This comment could not be found.',
          },
          404,
        );
      }

      const {
        error,
      } =
        await admin
          .from(
            'proof_annotations',
          )
          .update({
            status:
              'reopened',
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

    const versionId =
      clean(
        body?.version_id,
        100,
      );

    const commentBody =
      clean(
        body?.body,
        2000,
      );

    if (
      !versionId ||
      !commentBody
    ) {
      return json(
        {
          success: false,
          message:
            'Select a position and write your comment.',
        },
        400,
      );
    }

    const {
      data: version,
    } =
      await ctx
        .supabase
        .from(
          'deliverable_versions',
        )
        .select(
          'id,order_id,approval_state',
        )
        .eq(
          'id',
          versionId,
        )
        .maybeSingle();

    if (!version) {
      return json(
        {
          success: false,
          message:
            'This deliverable version is no longer available.',
        },
        404,
      );
    }

    // Approved work is read-only: new feedback needs a
    // revision, change request, or new request instead.
    if (
      version.approval_state ===
      'approved'
    ) {
      return json(
        {
          success: false,
          message:
            'This version is approved and read-only. Request a new revision for further changes.',
        },
        409,
      );
    }

    const x =
      body?.x ===
        null ||
      body?.x ===
        undefined ||
      body?.x === ''
        ? null
        : Number(
            body.x,
          );

    const y =
      body?.y ===
        null ||
      body?.y ===
        undefined ||
      body?.y === ''
        ? null
        : Number(
            body.y,
          );

    if (
      (x !== null &&
        (
          !Number.isFinite(
            x,
          ) ||
          x < 0 ||
          x > 100
        )) ||
      (y !== null &&
        (
          !Number.isFinite(
            y,
          ) ||
          y < 0 ||
          y > 100
        ))
    ) {
      return json(
        {
          success: false,
          message:
            'The annotation position is invalid.',
        },
        400,
      );
    }

    const page =
      body?.page ===
        null ||
      body?.page ===
        undefined ||
      body?.page === ''
        ? null
        : Math.round(
            Number(
              body.page,
            ),
          );

    const videoTimestamp =
      body?.video_timestamp_seconds ===
        null ||
      body?.video_timestamp_seconds ===
        undefined ||
      body?.video_timestamp_seconds ===
        ''
        ? null
        : Math.round(
            Number(
              body.video_timestamp_seconds,
            ),
          );

    const {
      error,
    } =
      await admin
        .from(
          'proof_annotations',
        )
        .insert({
          version_id:
            versionId,
          file_id:
            clean(
              body?.file_id,
              100,
            ) ||
            null,
          page:
            page &&
            page > 0
              ? page
              : null,
          x,
          y,
          video_timestamp_seconds:
            videoTimestamp &&
            videoTimestamp >=
              0
              ? videoTimestamp
              : null,
          body: commentBody,
          author_user_id:
            userId,
          author_kind:
            'client',
          status:
            'open',
          parent_id:
            clean(
              body?.parent_id,
              100,
            ) ||
            null,
        });

    if (error) {
      throw error;
    }

    return json({
      success: true,
    });
  }

  /* ====================================================
     MEETING REQUEST (in-app only; no emails sent)
     ==================================================== */

  if (
    action ===
    'meeting_request'
  ) {
    const scheduledAt =
      clean(
        body?.scheduled_at,
        40,
      );

    if (
      !scheduledAt ||
      Number.isNaN(
        Date.parse(
          scheduledAt,
        ),
      ) ||
      new Date(
        scheduledAt,
      ).getTime() <
        Date.now()
    ) {
      return json(
        {
          success: false,
          message:
            'Choose a future meeting time.',
        },
        400,
      );
    }

    const kind =
      clean(
        body?.kind,
        30,
      ) ||
      'discovery';

    if (
      ![
        'discovery',
        'kickoff',
        'review',
        'support',
      ].includes(
        kind,
      )
    ) {
      return json(
        {
          success: false,
          message:
            'Choose a valid meeting type.',
        },
        400,
      );
    }

    const customerId =
      await ownCustomerId(
        ctx,
        userId,
      );

    const orderId =
      clean(
        body?.order_id,
        100,
      ) ||
      null;

    if (orderId) {
      const {
        data: order,
      } =
        await ctx
          .supabase
          .from(
            'orders',
          )
          .select(
            'id',
          )
          .eq(
            'id',
            orderId,
          )
          .maybeSingle();

      if (!order) {
        return json(
          {
            success: false,
            message:
              'The linked project could not be found.',
          },
          404,
        );
      }
    }

    const {
      error,
    } =
      await admin
        .from(
          'meetings',
        )
        .insert({
          lead_id: null,
          customer_id:
            customerId,
          order_id:
            orderId,
          kind,
          scheduled_at:
            new Date(
              scheduledAt,
            ).toISOString(),
          duration_minutes:
            Math.max(
              5,
              Math.round(
                Number(
                  body?.duration_minutes ||
                    30,
                ),
              ),
            ),
          status:
            'scheduled',
          participants: null,
          notes:
            clean(
              body?.notes,
              2000,
            ) ||
            null,
          created_by:
            userId,
        });

    if (error) {
      throw error;
    }

    return json({
      success: true,
    });
  }

  /* ====================================================
     REQUEST COMMENT (client, never internal)
     ==================================================== */

  if (
    action ===
    'request_comment'
  ) {
    const requestId =
      clean(
        body?.request_id,
        100,
      );

    const commentBody =
      clean(
        body?.body,
        5000,
      );

    if (
      !requestId ||
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
      data: request,
    } =
      await ctx
        .supabase
        .from(
          'service_requests',
        )
        .select(
          'id,status',
        )
        .eq(
          'id',
          requestId,
        )
        .maybeSingle();

    if (!request) {
      return json(
        {
          success: false,
          message:
            'This request could not be found.',
        },
        404,
      );
    }

    if (
      [
        'completed',
        'cancelled',
      ].includes(
        request.status,
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
            requestId,
          author_user_id:
            userId,
          author_kind:
            'client',
          body: commentBody,
          internal:
            false,
        });

    if (error) {
      throw error;
    }

    return json({
      success: true,
    });
  }

  return json(
    {
      success: false,
      message:
        'This action is not supported.',
    },
    400,
  );
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
        const userId =
          ctx.userClaims?.id;

        if (!userId) {
          return json(
            {
              success: false,

              message:
                'Sign in to continue.',
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

        // Actions that are not scoped to a single project.
        if (
          [
            'proposal_decide',
            'agreement_decide',
            'request_create',
            'annotation_save',
            'annotation_reopen',
            'meeting_request',
          ].includes(
            action,
          )
        ) {
          return await handleWorkspaceAction(
            ctx,
            {
              action,
              body,
              userId,
            },
          );
        }

        if (!orderId) {
          return json(
            {
              success: false,

              message:
                'The project could not be identified.',
            },
            400,
          );
        }

        // Ownership is enforced through RLS on the caller's own
        // session: only projects belonging to this customer resolve.
        const {
          data: order,
          error:
            orderError,
        } =
          await ctx
            .supabase
            .from(
              'orders',
            )
            .select(`
              id,
              reference,
              customer_id,
              project_title,
              status,
              review_decision,
              quoted_amount_kobo,
              paid_amount_kobo,
              current_quote_id,
              delivered_at,
              completed_at,
              archived_at
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
                'This project was not found in your workspace.',
            },
            404,
          );
        }

        if (
          order.archived_at
        ) {
          return json(
            {
              success: false,

              message:
                'This project is archived and read-only.',
            },
            409,
          );
        }

        /* ====================================================
           QUOTE ACCEPT / DECLINE
           ==================================================== */

        if (
          action ===
            'accept_quote' ||
          action ===
            'decline_quote'
        ) {
          const quoteId =
            clean(
              body?.quoteId,
              100,
            );

          if (!quoteId) {
            return json(
              {
                success: false,

                message:
                  'The quote could not be identified.',
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
              .supabase
              .from(
                'order_quotes',
              )
              .select(
                'id,order_id,amount_kobo,status,valid_until',
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
                  'This quote is no longer available.',
              },
              404,
            );
          }

          if (
            quote.status !==
            'sent'
          ) {
            return json(
              {
                success: false,

                message:
                  'This quote has already been decided.',
              },
              409,
            );
          }

          if (
            quote.valid_until &&
            new Date(
              quote.valid_until,
            ) <
              new Date()
          ) {
            await ctx.supabaseAdmin
              .from(
                'order_quotes',
              )
              .update({
                status:
                  'expired',
              })
              .eq(
                'id',
                quote.id,
              );

            return json(
              {
                success: false,

                message:
                  'This quote has expired. Management has been notified.',
              },
              409,
            );
          }

          const now =
            new Date()
              .toISOString();

          const nextStatus =
            action ===
            'accept_quote'
              ? 'accepted'
              : 'declined';

          const {
            error:
              updateError,
          } =
            await ctx.supabaseAdmin
              .from(
                'order_quotes',
              )
              .update({
                status:
                  nextStatus,

                accepted_at:
                  action ===
                  'accept_quote'
                    ? now
                    : null,
              })
              .eq(
                'id',
                quote.id,
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
                action ===
                'accept_quote'
                  ? 'quote_accepted'
                  : 'quote_declined',

              payload: {
                quote_id:
                  quote.id,

                amount_kobo:
                  quote.amount_kobo,

                actor: 'client',
              },
            },
          );

          return json({
            success: true,

            status:
              nextStatus,
          });
        }

        /* ====================================================
           DELIVERABLE APPROVAL
           ==================================================== */

        if (
          action ===
          'approve_deliverable'
        ) {
          const versionId =
            clean(
              body?.versionId,
              100,
            );

          if (
            !versionId
          ) {
            return json(
              {
                success: false,

                message:
                  'The deliverable version could not be identified.',
              },
              400,
            );
          }

          const {
            data: version,
            error:
              versionError,
          } =
            await ctx
              .supabase
              .from(
                'deliverable_versions',
              )
              .select(`
                id,
                deliverable_id,
                order_id,
                version_number,
                approval_state,
                project_deliverables (
                  id,
                  title,
                  visible_to_client
                )
              `)
              .eq(
                'id',
                versionId,
              )
              .eq(
                'order_id',
                order.id,
              )
              .maybeSingle();

          if (
            versionError ||
            !version
          ) {
            return json(
              {
                success: false,

                message:
                  'This deliverable is no longer available for review.',
              },
              404,
            );
          }

          const deliverable =
            Array.isArray(
              version.project_deliverables,
            )
              ? version
                  .project_deliverables[0]
              : version.project_deliverables;

          if (
            !deliverable?.visible_to_client
          ) {
            return json(
              {
                success: false,

                message:
                  'This deliverable is not shared with you yet.',
              },
              403,
            );
          }

          if (
            version.approval_state !==
            'pending'
          ) {
            return json(
              {
                success: false,

                message:
                  'This version has already been decided.',
              },
              409,
            );
          }

          const now =
            new Date()
              .toISOString();

          const {
            error:
              approveError,
          } =
            await ctx.supabaseAdmin
              .from(
                'deliverable_versions',
              )
              .update({
                approval_state:
                  'approved',

                decided_at:
                  now,
              })
              .eq(
                'id',
                version.id,
              );

          if (
            approveError
          ) {
            throw approveError;
          }

          await ctx.supabaseAdmin
            .from(
              'project_deliverables',
            )
            .update({
              status:
                'approved',

              client_approval_state:
                'approved',
            })
            .eq(
              'id',
              version.deliverable_id,
            );

          await createNotification(
            ctx.supabaseAdmin,
            {
              order,

              type:
                'deliverable_approved',

              payload: {
                deliverable_id:
                  version.deliverable_id,

                version_id:
                  version.id,

                version_number:
                  version.version_number,

                title:
                  deliverable.title,

                actor: 'client',
              },
            },
          );

          await runAutomations(
            ctx.supabaseAdmin,
            'deliverable_approved',
            {
              orderId:
                order.id,
              origin:
                'client-project-action',
            },
            userId,
          );

          return json({
            success: true,
          });
        }

        /* ====================================================
           REVISION REQUEST
           ==================================================== */

        if (
          action ===
          'request_revision'
        ) {
          const description =
            clean(
              body?.description,
              5000,
            );

          if (
            description.length <
            10
          ) {
            return json(
              {
                success: false,

                message:
                  'Describe the change you need in at least a sentence so Management can act on it.',
              },
              400,
            );
          }

          const deliverableId =
            clean(
              body?.deliverableId,
              100,
            ) ||
            null;

          const versionId =
            clean(
              body?.versionId,
              100,
            ) ||
            null;

          if (
            versionId
          ) {
            const {
              data: version,
            } =
              await ctx
                .supabase
                .from(
                  'deliverable_versions',
                )
                .select(
                  'id,approval_state',
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
                    'The deliverable version could not be found.',
                },
                404,
              );
            }

            await ctx.supabaseAdmin
              .from(
                'deliverable_versions',
              )
              .update({
                approval_state:
                  'revision_requested',

                client_feedback:
                  description,

                decided_at:
                  new Date()
                    .toISOString(),
              })
              .eq(
                'id',
                version.id,
              );

            if (
              deliverableId
            ) {
              await ctx.supabaseAdmin
                .from(
                  'project_deliverables',
                )
                .update({
                  client_approval_state:
                    'revision_requested',
                })
                .eq(
                  'id',
                  deliverableId,
                );
            }
          }

          const {
            data: revision,
            error:
              revisionError,
          } =
            await ctx.supabaseAdmin
              .from(
                'revision_requests',
              )
              .insert({
                order_id:
                  order.id,

                deliverable_id:
                  deliverableId,

                version_id:
                  versionId,

                description,

                status:
                  'open',

                submitted_by:
                  userId,
              })
              .select(
                'id',
              )
              .single();

          if (
            revisionError ||
            !revision
          ) {
            throw (
              revisionError ||
              new Error(
                'Your revision request could not be submitted.',
              )
            );
          }

          await createNotification(
            ctx.supabaseAdmin,
            {
              order,

              type:
                'revision_requested',

              payload: {
                revision_id:
                  revision.id,

                deliverable_id:
                  deliverableId,

                version_id:
                  versionId,

                actor: 'client',
              },
            },
          );

          await runAutomations(
            ctx.supabaseAdmin,
            'revision_requested',
            {
              orderId:
                order.id,
              origin:
                'client-project-action',
            },
            userId,
          );

          return json({
            success: true,

            revisionId:
              revision.id,
          });
        }

        /* ====================================================
           CHANGE REQUEST RESPONSE
           ==================================================== */

        if (
          action ===
          'respond_change_request'
        ) {
          const changeId =
            clean(
              body?.changeId,
              100,
            );

          const decision =
            clean(
              body?.decision,
              20,
            );

          if (
            ![
              'accept',
              'decline',
              'question',
            ].includes(
              decision,
            )
          ) {
            return json(
              {
                success: false,

                message:
                  'Choose whether to accept, decline or ask about this change.',
              },
              400,
            );
          }

          const message =
            clean(
              body?.message,
              3000,
            );

          if (
            decision !==
              'accept' &&
            message.length <
              5
          ) {
            return json(
              {
                success: false,

                message:
                  'Add a short note so Management understands your response.',
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
              .supabase
              .from(
                'change_requests',
              )
              .select(
                'id,title,status,requires_client_approval',
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
                  'This change request is no longer available.',
              },
              404,
            );
          }

          if (
            change.status !==
            'sent'
          ) {
            return json(
              {
                success: false,

                message:
                  'This change request has already been decided.',
              },
              409,
            );
          }

          const nextStatus =
            decision ===
            'accept'
              ? 'accepted'
              : decision ===
                  'decline'
                ? 'declined'
                : 'questioned';

          const {
            error:
              updateError,
          } =
            await ctx.supabaseAdmin
              .from(
                'change_requests',
              )
              .update({
                status:
                  nextStatus,

                client_message:
                  message ||
                  null,

                decided_at:
                  new Date()
                    .toISOString(),
              })
              .eq(
                'id',
                change.id,
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
                `change_request_${nextStatus}` as string,

              payload: {
                change_request_id:
                  change.id,

                title:
                  change.title,

                actor: 'client',
              },
            },
          );

          if (
            nextStatus ===
            'accepted'
          ) {
            await runAutomations(
              ctx.supabaseAdmin,
              'change_request_accepted',
              {
                orderId:
                  order.id,
                origin:
                  'client-project-action',
              },
              userId,
            );
          }

          return json({
            success: true,

            status:
              nextStatus,
          });
        }

        /* ====================================================
           PROJECT FEEDBACK
           ==================================================== */

        if (
          action ===
          'submit_feedback'
        ) {
          const rating =
            Math.round(
              Number(
                body?.rating,
              ),
            );

          if (
            !Number.isFinite(
              rating,
            ) ||
            rating < 1 ||
            rating > 5
          ) {
            return json(
              {
                success: false,

                message:
                  'Choose a rating between 1 and 5.',
              },
              400,
            );
          }

          if (
            !order.completed_at &&
            !order.delivered_at
          ) {
            return json(
              {
                success: false,

                message:
                  'Feedback opens after your project is delivered.',
              },
              409,
            );
          }

          const {
            error:
              feedbackError,
          } =
            await ctx.supabaseAdmin
              .from(
                'project_feedback',
              )
              .upsert(
                {
                  order_id:
                    order.id,

                  rating,

                  feedback:
                    clean(
                      body?.feedback,
                      5000,
                    ) ||
                    null,

                  testimonial_permission:
                    body?.testimonialPermission ===
                    true,

                  submitted_by:
                    userId,
                },
                {
                  onConflict:
                    'order_id',
                },
              );

          if (
            feedbackError
          ) {
            throw feedbackError;
          }

          await createNotification(
            ctx.supabaseAdmin,
            {
              order,

              type:
                'feedback_submitted',

              payload: {
                rating,

                actor: 'client',
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
              'This action is not supported.',
          },
          400,
        );
      } catch (error) {
        console.error(
          'client-project-action:',
          error,
        );

        return json(
          {
            success: false,

            message:
              error instanceof Error
                ? error.message
                : 'This action could not be completed.',
          },
          500,
        );
      }
    },
  ),
};
