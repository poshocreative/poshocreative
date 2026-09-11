import {
  withSupabase,
} from 'npm:@supabase/server@^1';

import {
  clean,
  json,
  logAdminAction,
  makeReference,
  requireCapability,
  runAutomations,
} from '../_shared/ops.ts';

const LEAD_STAGES = [
  'new',
  'contacted',
  'qualified',
  'discovery',
  'proposal_prepared',
  'proposal_sent',
  'negotiation',
  'won',
  'lost',
  'archived',
];

const LEAD_SOURCES = [
  'google',
  'instagram',
  'whatsapp',
  'referral',
  'existing_client',
  'website',
  'linkedin',
  'facebook',
  'offline',
  'other',
];

const PROPOSAL_STATUSES = [
  'draft',
  'ready',
  'sent',
  'viewed',
  'accepted',
  'declined',
  'expired',
  'superseded',
];

const MEETING_KINDS = [
  'discovery',
  'kickoff',
  'review',
  'support',
];

const MEETING_STATUSES = [
  'scheduled',
  'completed',
  'cancelled',
  'no_show',
  'rescheduled',
];

async function leadDuplicates(
  admin: any,
  {
    email,
    phone,
    excludeId = null,
  }: {
    email: string;
    phone: string;
    excludeId?: string | null;
  },
) {
  const matches: Array<{
    type: string;
    id: string;
    label: string;
  }> = [];

  if (email) {
    const {
      data,
    } =
      await admin
        .from(
          'leads',
        )
        .select(
          'id,name,company',
        )
        .ilike(
          'email',
          email,
        )
        .limit(5);

    for (const row of data || []) {
      if (
        row.id !==
        excludeId
      ) {
        matches.push({
          type: 'lead-email',
          id: row.id,
          label:
            row.company ||
            row.name,
        });
      }
    }

    const {
      data: customers,
    } =
      await admin
        .from(
          'customers',
        )
        .select(
          'id,full_name,business_name',
        )
        .ilike(
          'email',
          email,
        )
        .limit(5);

    for (const row of customers || []) {
      matches.push({
        type: 'customer-email',
        id: row.id,
        label:
          row.business_name ||
          row.full_name,
      });
    }
  }

  if (phone) {
    const digits =
      phone.replace(
        /\D/g,
        '',
      );

    if (
      digits.length >=
      7
    ) {
      const {
        data,
      } =
        await admin
          .from(
            'leads',
          )
          .select(
            'id,name,company,phone',
          )
          .ilike(
            'phone',
            `%${digits.slice(-7)}%`,
          )
          .limit(5);

      for (const row of data || []) {
        if (
          row.id !==
          excludeId
        ) {
          matches.push({
            type: 'lead-phone',
            id: row.id,
            label:
              row.company ||
              row.name,
          });
        }
      }
    }
  }

  return matches;
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

        const needsServices =
          action.startsWith(
            'service_',
          ) ||
          action.startsWith(
            'package_',
          ) ||
          action.startsWith(
            'intake_',
          ) ||
          action.startsWith(
            'template_',
          ) ||
          action.startsWith(
            'milestone_template_',
          );

        const capability =
          needsServices
            ? 'services.manage'
            : 'sales.manage';

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
           LEADS
           ==================================================== */

        if (
          action ===
          'lead_save'
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
                  'Give the lead a name.',
              },
              400,
            );
          }

          const email =
            clean(
              body?.email,
              160,
            ) ||
            null;

          const phone =
            clean(
              body?.phone,
              40,
            ) ||
            null;

          const source =
            clean(
              body?.source,
              30,
            ) ||
            'other';

          if (
            !LEAD_SOURCES.includes(
              source,
            )
          ) {
            return json(
              {
                success: false,
                message:
                  'Choose a valid lead source.',
              },
              400,
            );
          }

          const row: Record<
            string,
            unknown
          > = {
            name,
            company:
              clean(
                body?.company,
                160,
              ) ||
              null,
            email,
            phone,
            source,
            service_slug:
              clean(
                body?.service_slug,
                80,
              ) ||
              null,
            expected_value_kobo:
              Math.max(
                0,
                Math.round(
                  Number(
                    body?.expected_value_kobo ||
                      0,
                  ),
                ),
              ),
            notes:
              clean(
                body?.notes,
                5000,
              ) ||
              null,
            owner_id:
              clean(
                body?.owner_id,
                100,
              ) ||
              null,
            next_action:
              clean(
                body?.next_action,
                200,
              ) ||
              null,
            next_action_due:
              body?.next_action_due ||
              null,
          };

          let leadId = id;

          if (id) {
            const {
              error,
            } =
              await admin
                .from(
                  'leads',
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
                  'leads',
                )
                .insert({
                  ...row,
                  reference:
                    makeReference(
                      'LD',
                    ),
                  stage:
                    'new',
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
                  'The lead could not be saved.',
                )
              );
            }

            leadId =
              created.id;

            await admin
              .from(
                'lead_activity',
              )
              .insert({
                lead_id:
                  leadId,
                actor_id:
                  adminUserId,
                action:
                  'created',
                note: null,
              });

            await runAutomations(
              admin,
              'lead_created',
              {
                leadId,
                origin:
                  'sales-action',
              },
              adminUserId,
            );
          }

          const duplicates =
            await leadDuplicates(
              admin,
              {
                email:
                  email || '',
                phone:
                  phone || '',
                excludeId:
                  leadId,
              },
            );

          await logAdminAction(
            admin,
            {
              adminUserId,
              orderId: null,
              action:
                id
                  ? 'lead_updated'
                  : 'lead_created',
              description:
                `Lead "${name}" ${id ? 'updated' : 'created'}.`,
              metadata: {
                lead_id:
                  leadId,
              },
            },
          );

          return json({
            success: true,
            leadId,
            duplicates,
          });
        }

        if (
          action ===
          'lead_stage'
        ) {
          const id =
            clean(
              body?.id,
              100,
            );

          const stage =
            clean(
              body?.stage,
              30,
            );

          if (
            !id ||
            !LEAD_STAGES.includes(
              stage,
            )
          ) {
            return json(
              {
                success: false,
                message:
                  'Choose a valid pipeline stage.',
              },
              400,
            );
          }

          const {
            data: lead,
          } =
            await admin
              .from(
                'leads',
              )
              .select(
                'id,stage,name',
              )
              .eq(
                'id',
                id,
              )
              .maybeSingle();

          if (!lead) {
            return json(
              {
                success: false,
                message:
                  'The lead could not be found.',
              },
              404,
            );
          }

          if (
            stage ===
              'lost' &&
            !clean(
              body?.lost_reason,
              500,
            )
          ) {
            return json(
              {
                success: false,
                message:
                  'Record why this lead was lost.',
              },
              400,
            );
          }

          const patch: Record<
            string,
            unknown
          > = {
            stage,
            lost_reason:
              stage ===
              'lost'
                ? clean(
                    body?.lost_reason,
                    500,
                  )
                : null,
          };

          if (
            [
              'won',
              'lost',
              'archived',
            ].includes(
              stage,
            )
          ) {
            patch.next_action =
              null;
            patch.next_action_due =
              null;
          }

          const {
            error,
          } =
            await admin
              .from(
                'leads',
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

          await admin
            .from(
              'lead_activity',
            )
            .insert({
              lead_id:
                id,
              actor_id:
                adminUserId,
              action:
                `stage:${lead.stage}->${stage}`,
              note:
                clean(
                  body?.lost_reason,
                  500,
                ) ||
                null,
            });

          await logAdminAction(
            admin,
            {
              adminUserId,
              orderId: null,
              action:
                'lead_stage_changed',
              description:
                `Lead "${lead.name}" moved to ${stage.replaceAll('_', ' ')}.`,
              metadata: {
                lead_id: id,
                from: lead.stage,
                to: stage,
              },
            },
          );

          await runAutomations(
            admin,
            'lead_stage_changed',
            {
              leadId: id,
              origin:
                'sales-action',
            },
            adminUserId,
          );

          return json({
            success: true,
          });
        }

        if (
          action ===
          'lead_convert'
        ) {
          const id =
            clean(
              body?.id,
              100,
            );

          const createProject =
            body?.createProject ===
            true;

          const {
            data: lead,
          } =
            await admin
              .from(
                'leads',
              )
              .select('*')
              .eq(
                'id',
                id,
              )
              .maybeSingle();

          if (!lead) {
            return json(
              {
                success: false,
                message:
                  'The lead could not be found.',
              },
              404,
            );
          }

          if (
            lead.converted_customer_id
          ) {
            return json({
              success: true,
              customerId:
                lead.converted_customer_id,
              orderId:
                lead.converted_order_id,
              alreadyConverted: true,
            });
          }

          if (!lead.email) {
            return json(
              {
                success: false,
                message:
                  'Add an email address before converting this lead.',
              },
              400,
            );
          }

          // Reuse an existing customer with the same email.
          let customerId: string | null =
            null;

          let customerUserId:
            | string
            | null =
            null;

          const {
            data: existing,
          } =
            await admin
              .from(
                'customers',
              )
              .select(
                'id,user_id',
              )
              .ilike(
                'email',
                lead.email,
              )
              .limit(1)
              .maybeSingle();

          if (existing) {
            customerId =
              existing.id;

            customerUserId =
              existing.user_id ||
              null;
          } else {
            const {
              data: created,
              error:
                customerError,
            } =
              await admin
                .from(
                  'customers',
                )
                .insert({
                  full_name:
                    lead.name,
                  email:
                    lead.email,
                  phone:
                    lead.phone ||
                    'Not provided',
                  business_name:
                    lead.company,
                  preferred_contact_method:
                    'whatsapp',
                })
                .select(
                  'id',
                )
                .single();

            if (
              customerError ||
              !created
            ) {
              throw (
                customerError ||
                new Error(
                  'The client record could not be created.',
                )
              );
            }

            customerId =
              created.id;
          }

          let orderId: string | null =
            null;

          if (
            createProject
          ) {
            if (!customerUserId) {
              const {
                data: refreshed,
              } =
                await admin
                  .from(
                    'customers',
                  )
                  .select(
                    'user_id',
                  )
                  .eq(
                    'id',
                    customerId,
                  )
                  .maybeSingle();

              customerUserId =
                refreshed?.user_id ||
                null;
            }

            const serviceSlug =
              [
                'website-development',
                'graphic-design',
                'social-media-management',
                'advertising',
                'business-services',
                'creative-solutions',
              ].includes(
                lead.service_slug,
              )
              ? lead.service_slug
              : 'creative-solutions';

            const {
              data: createdOrder,
              error:
                orderError,
            } =
              await admin
                .from(
                  'orders',
                )
                .insert({
                  reference:
                    makeReference(
                      'POS',
                    ),
                  customer_id:
                    customerId,
                  user_id:
                    customerUserId,
                  service_slug:
                    serviceSlug,
                  project_type:
                    'custom',
                  project_title:
                    `${lead.company || lead.name} project`,
                  project_description:
                    lead.notes ||
                    `Converted from lead ${lead.reference}.`,
                  project_goal:
                    'To be confirmed with the client.',
                  budget:
                    'not-sure',
                  timeline:
                    'flexible',
                  source:
                    `lead:${lead.source}`,
                  status:
                    'new',
                })
                .select(
                  'id',
                )
                .single();

            if (
              orderError ||
              !createdOrder
            ) {
              throw (
                orderError ||
                new Error(
                  'The project could not be created.',
                )
              );
            }

            orderId =
              createdOrder.id;
          }

          await admin
            .from(
              'leads',
            )
            .update({
              stage: 'won',
              converted_customer_id:
                customerId,
              converted_order_id:
                orderId,
              next_action: null,
              next_action_due:
                null,
            })
            .eq(
              'id',
              id,
            );

          await admin
            .from(
              'lead_activity',
            )
            .insert({
              lead_id: id,
              actor_id:
                adminUserId,
              action:
                'converted',
              note:
                orderId
                  ? 'Converted to client with a new project.'
                  : 'Converted to client.',
            });

          await logAdminAction(
            admin,
            {
              adminUserId,
              orderId,
              action:
                'lead_converted',
              description:
                `Lead "${lead.name}" converted to client.`,
              metadata: {
                lead_id: id,
                customer_id:
                  customerId,
                order_id:
                  orderId,
              },
            },
          );

          return json({
            success: true,
            customerId,
            orderId,
          });
        }

        if (
          action ===
          'lead_contact'
        ) {
          const id =
            clean(
              body?.id,
              100,
            );

          const note =
            clean(
              body?.note,
              2000,
            );

          if (
            !id ||
            !note
          ) {
            return json(
              {
                success: false,
                message:
                  'Record what was discussed.',
              },
              400,
            );
          }

          const {
            error,
          } =
            await admin
              .from(
                'leads',
              )
              .update({
                last_contact_at:
                  new Date()
                    .toISOString(),
                next_action:
                  clean(
                    body?.next_action,
                    200,
                  ) ||
                  null,
                next_action_due:
                  body?.next_action_due ||
                  null,
              })
              .eq(
                'id',
                id,
              );

          if (error) {
            throw error;
          }

          await admin
            .from(
              'lead_activity',
            )
            .insert({
              lead_id: id,
              actor_id:
                adminUserId,
              action:
                'contact',
              note,
            });

          return json({
            success: true,
          });
        }

        /* ====================================================
           PROPOSALS
           ==================================================== */

        if (
          action ===
          'proposal_save'
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

          if (!title) {
            return json(
              {
                success: false,
                message:
                  'Give the proposal a title.',
              },
              400,
            );
          }

          const items = Array.isArray(
            body?.items,
          )
            ? body.items
            : [];

          if (
            items.length ===
            0
          ) {
            return json(
              {
                success: false,
                message:
                  'Add at least one commercial item.',
              },
              400,
            );
          }

          let subtotal = 0;
          const rows: Array<
            Record<
              string,
              unknown
            >
          > = [];

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

            const itemTitle =
              clean(
                item.title,
                200,
              );

            if (!itemTitle) {
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

            const unit =
              Math.round(
                Number(
                  item.unit_price_kobo ||
                    0,
                ),
              );

            if (
              !Number.isFinite(
                unit,
              ) ||
              unit < 0
            ) {
              return json(
                {
                  success: false,
                  message:
                    `Enter a valid price for "${itemTitle}".`,
                },
                400,
              );
            }

            const amount =
              Math.round(
                quantity *
                  unit,
              );

            subtotal +=
              amount;

            rows.push({
              title:
                itemTitle,
              description:
                clean(
                  item.description,
                  2000,
                ) ||
                null,
              quantity,
              unit_price_kobo:
                unit,
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
                  'Add at least one commercial item.',
              },
              400,
            );
          }

          const discount =
            Math.max(
              0,
              Math.round(
                Number(
                  body?.discount_kobo ||
                    0,
                ),
              ),
            );

          const total =
            Math.max(
              0,
              subtotal -
                discount,
            );

          const proposalRow: Record<
            string,
            unknown
          > = {
            lead_id:
              clean(
                body?.lead_id,
                100,
              ) ||
              null,
            order_id:
              clean(
                body?.order_id,
                100,
              ) ||
              null,
            customer_id:
              clean(
                body?.customer_id,
                100,
              ) ||
              null,
            title,
            overview:
              clean(
                body?.overview,
                5000,
              ) ||
              null,
            goals:
              clean(
                body?.goals,
                5000,
              ) ||
              null,
            scope:
              clean(
                body?.scope,
                5000,
              ) ||
              null,
            deliverables:
              clean(
                body?.deliverables,
                5000,
              ) ||
              null,
            timeline:
              clean(
                body?.timeline,
                3000,
              ) ||
              null,
            terms:
              clean(
                body?.terms,
                5000,
              ) ||
              null,
            valid_until:
              body?.valid_until ||
              null,
            subtotal_kobo:
              subtotal,
            discount_kobo:
              discount,
            total_kobo:
              total,
          };

          let proposalId =
            id;

          if (id) {
            const {
              data: existing,
            } =
              await admin
                .from(
                  'proposals',
                )
                .select(
                  'id,status',
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
                    'The proposal could not be found.',
                },
                404,
              );
            }

            if (
              [
                'accepted',
                'superseded',
              ].includes(
                existing.status,
              )
            ) {
              return json(
                {
                  success: false,
                  message:
                    'Accepted proposals are historical records. Create a new version instead.',
                },
                409,
              );
            }

            const {
              error,
            } =
              await admin
                .from(
                  'proposals',
                )
                .update(
                  proposalRow,
                )
                .eq(
                  'id',
                  id,
                );

            if (error) {
              throw error;
            }

            await admin
              .from(
                'proposal_items',
              )
              .delete()
              .eq(
                'proposal_id',
                id,
              );
          } else {
            const {
              data: created,
              error,
            } =
              await admin
                .from(
                  'proposals',
                )
                .insert({
                  ...proposalRow,
                  number:
                    makeReference(
                      'PROP',
                    ),
                  status:
                    'draft',
                  version: 1,
                  created_by:
                    adminUserId,
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
                  'The proposal could not be saved.',
                )
              );
            }

            proposalId =
              created.id;
          }

          const {
            error:
              itemsError,
          } =
            await admin
              .from(
                'proposal_items',
              )
              .insert(
                rows.map(
                  (
                    row,
                  ) => ({
                    ...row,
                    proposal_id:
                      proposalId,
                  }),
                ),
              );

          if (
            itemsError
          ) {
            throw itemsError;
          }

          await logAdminAction(
            admin,
            {
              adminUserId,
              orderId:
                (proposalRow.order_id as string) ||
                null,
              action:
                'proposal_saved',
              description:
                `Proposal "${title}" saved (${total} kobo).`,
              metadata: {
                proposal_id:
                  proposalId,
                total_kobo:
                  total,
              },
            },
          );

          return json({
            success: true,
            proposalId,
            total_kobo:
              total,
          });
        }

        if (
          action ===
          'proposal_version'
        ) {
          const id =
            clean(
              body?.id,
              100,
            );

          const {
            data: source,
          } =
            await admin
              .from(
                'proposals',
              )
              .select('*')
              .eq(
                'id',
                id,
              )
              .maybeSingle();

          if (!source) {
            return json(
              {
                success: false,
                message:
                  'The proposal could not be found.',
              },
              404,
            );
          }

          const {
            data: sourceItems,
          } =
            await admin
              .from(
                'proposal_items',
              )
              .select('*')
              .eq(
                'proposal_id',
                id,
              );

          const {
            data: clone,
            error:
              cloneError,
          } =
            await admin
              .from(
                'proposals',
              )
              .insert({
                number:
                  makeReference(
                    'PROP',
                  ),
                lead_id:
                  source.lead_id,
                order_id:
                  source.order_id,
                customer_id:
                  source.customer_id,
                title:
                  source.title,
                overview:
                  source.overview,
                goals:
                  source.goals,
                scope:
                  source.scope,
                deliverables:
                  source.deliverables,
                timeline:
                  source.timeline,
                terms:
                  source.terms,
                valid_until:
                  source.valid_until,
                status:
                  'draft',
                version:
                  Number(
                    source.version ||
                      1,
                  ) + 1,
                parent_id:
                  source.id,
                subtotal_kobo:
                  source.subtotal_kobo,
                discount_kobo:
                  source.discount_kobo,
                total_kobo:
                  source.total_kobo,
                created_by:
                  adminUserId,
              })
              .select(
                'id',
              )
              .single();

          if (
            cloneError ||
            !clone
          ) {
            throw (
              cloneError ||
              new Error(
                'The new version could not be created.',
              )
            );
          }

          if (
            sourceItems &&
            sourceItems.length >
              0
          ) {
            await admin
              .from(
                'proposal_items',
              )
              .insert(
                sourceItems.map(
                  (
                    item: any,
                    index: number,
                  ) => ({
                    proposal_id:
                      clone.id,
                    title:
                      item.title,
                    description:
                      item.description,
                    quantity:
                      item.quantity,
                    unit_price_kobo:
                      item.unit_price_kobo,
                    amount_kobo:
                      item.amount_kobo,
                    sort_order:
                      index,
                  }),
                ),
              );
          }

          await admin
            .from(
              'proposals',
            )
            .update({
              status:
                'superseded',
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
                source.order_id,
              action:
                'proposal_versioned',
              description:
                `Proposal "${source.title}" revised to version ${Number(source.version || 1) + 1}.`,
              metadata: {
                proposal_id:
                  clone.id,
                parent_id: id,
              },
            },
          );

          return json({
            success: true,
            proposalId:
              clone.id,
          });
        }

        if (
          action ===
          'proposal_status'
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
            ![
              'ready',
              'sent',
              'expired',
              'declined',
            ].includes(
              status,
            )
          ) {
            return json(
              {
                success: false,
                message:
                  'Choose a valid proposal status.',
              },
              400,
            );
          }

          const {
            data: proposal,
          } =
            await admin
              .from(
                'proposals',
              )
              .select(
                'id,status,title,order_id,customer_id,total_kobo',
              )
              .eq(
                'id',
                id,
              )
              .maybeSingle();

          if (!proposal) {
            return json(
              {
                success: false,
                message:
                  'The proposal could not be found.',
              },
              404,
            );
          }

          if (
            [
              'accepted',
              'superseded',
            ].includes(
              proposal.status,
            )
          ) {
            return json(
              {
                success: false,
                message:
                  'This proposal is a historical record and cannot change status.',
              },
              409,
            );
          }

          const {
            error,
          } =
            await admin
              .from(
                'proposals',
              )
              .update({
                status,
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
              orderId:
                proposal.order_id,
              action:
                `proposal_${status}`,
              description:
                `Proposal "${proposal.title}" marked as ${status}.`,
              metadata: {
                proposal_id: id,
              },
            },
          );

          return json({
            success: true,
          });
        }

        if (
          action ===
          'proposal_delete'
        ) {
          const id =
            clean(
              body?.id,
              100,
            );

          const {
            data: proposal,
          } =
            await admin
              .from(
                'proposals',
              )
              .select(
                'id,status',
              )
              .eq(
                'id',
                id,
              )
              .maybeSingle();

          if (!proposal) {
            return json(
              {
                success: false,
                message:
                  'The proposal could not be found.',
              },
              404,
            );
          }

          if (
            proposal.status !==
            'draft'
          ) {
            return json(
              {
                success: false,
                message:
                  'Only draft proposals can be deleted.',
              },
              409,
            );
          }

          const {
            error,
          } =
            await admin
              .from(
                'proposals',
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
           SERVICES HUB
           ==================================================== */

        if (
          action ===
          'service_save'
        ) {
          const serviceSlug =
            clean(
              body?.service_slug,
              80,
            );

          const projectType =
            clean(
              body?.project_type,
              80,
            );

          const title =
            clean(
              body?.title,
              160,
            );

          if (
            !serviceSlug ||
            !projectType ||
            !title
          ) {
            return json(
              {
                success: false,
                message:
                  'Service, type and title are required.',
              },
              400,
            );
          }

          const pricingType =
            clean(
              body?.pricing_type,
              30,
            ) ||
            'custom';

          if (
            ![
              'fixed',
              'starting_at',
              'monthly',
              'custom',
            ].includes(
              pricingType,
            )
          ) {
            return json(
              {
                success: false,
                message:
                  'Choose a valid pricing model.',
              },
              400,
            );
          }

          const {
            error,
          } =
            await admin
              .from(
                'service_catalog',
              )
              .upsert(
                {
                  service_slug:
                    serviceSlug,
                  project_type:
                    projectType,
                  title,
                  description:
                    clean(
                      body?.description,
                      2000,
                    ) ||
                    null,
                  pricing_type:
                    pricingType,
                  price_kobo:
                    pricingType ===
                    'custom'
                      ? null
                      : Math.max(
                          0,
                          Math.round(
                            Number(
                              body?.price_kobo ||
                                0,
                            ),
                          ),
                        ),
                  active:
                    body?.active !==
                    false,
                  sort_order:
                    Math.round(
                      Number(
                        body?.sort_order ||
                          0,
                      ),
                    ),
                },
                {
                  onConflict:
                    'service_slug,project_type',
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
                'service_saved',
              description:
                `Service "${title}" saved.`,
              metadata: {
                service_slug:
                  serviceSlug,
              },
            },
          );

          return json({
            success: true,
          });
        }

        if (
          action ===
          'package_save'
        ) {
          const id =
            clean(
              body?.id,
              100,
            ) ||
            null;

          const serviceSlug =
            clean(
              body?.service_slug,
              80,
            );

          const name =
            clean(
              body?.name,
              160,
            );

          if (
            !serviceSlug ||
            !name
          ) {
            return json(
              {
                success: false,
                message:
                  'Service and package name are required.',
              },
              400,
            );
          }

          let features: unknown[] =
            [];

          try {
            const parsed =
              typeof body?.features ===
              'string'
                ? JSON.parse(
                    body.features,
                  )
                : body?.features;

            if (
              Array.isArray(
                parsed,
              )
            ) {
              features =
                parsed
                  .map(
                    (
                      feature: unknown,
                    ) =>
                      String(
                        feature || '',
                      ).slice(
                        0,
                        200,
                      ),
                  )
                  .filter(
                    Boolean,
                  );
            }
          } catch {
            features = [];
          }

          const row: Record<
            string,
            unknown
          > = {
            service_slug:
              serviceSlug,
            name,
            tagline:
              clean(
                body?.tagline,
                300,
              ) ||
              null,
            features,
            price_kobo:
              body?.price_kobo ===
                null ||
              body?.price_kobo ===
                undefined ||
              body?.price_kobo ===
                ''
                ? null
                : Math.max(
                    0,
                    Math.round(
                      Number(
                        body.price_kobo,
                      ),
                    ),
                  ),
            pricing_model:
              clean(
                body?.pricing_model,
                30,
              ) ||
              'package',
            active:
              body?.active !==
              false,
            sort_order:
              Math.round(
                Number(
                  body?.sort_order ||
                    0,
                ),
              ),
          };

          if (id) {
            const {
              error,
            } =
              await admin
                .from(
                  'service_packages',
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
                  'service_packages',
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
          'package_delete'
        ) {
          const id =
            clean(
              body?.id,
              100,
            );

          if (!id) {
            return json(
              {
                success: false,
                message:
                  'A package reference is required.',
              },
              400,
            );
          }

          const {
            error,
          } =
            await admin
              .from(
                'service_packages',
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
          'intake_save'
        ) {
          const fields = Array.isArray(
            body?.fields,
          )
            ? body.fields
            : [];

          const serviceSlug =
            clean(
              body?.service_slug,
              80,
            );

          if (
            !serviceSlug
          ) {
            return json(
              {
                success: false,
                message:
                  'Choose a service first.',
              },
              400,
            );
          }

          const validTypes =
            [
              'text',
              'textarea',
              'number',
              'date',
              'select',
              'multi_select',
              'radio',
              'checkbox',
              'url',
              'email',
              'file',
            ];

          const rows: Array<
            Record<
              string,
              unknown
            >
          > = [];

          const seen =
            new Set<string>();

          for (
            let index = 0;
            index <
            fields.length;
            index += 1
          ) {
            const field =
              fields[
                index
              ] || {};

            const key =
              clean(
                field.field_key,
                60,
              )
                .toLowerCase()
                .replace(
                  /[^a-z0-9_]/g,
                  '_',
                );

            const label =
              clean(
                field.label,
                120,
              );

            if (
              !key ||
              !label ||
              seen.has(
                key,
              )
            ) {
              continue;
            }

            seen.add(
              key,
            );

            rows.push({
              service_slug:
                serviceSlug,
              field_key:
                key,
              label,
              field_type:
                validTypes.includes(
                  field.field_type,
                )
                  ? field.field_type
                  : 'text',
              required:
                field.required ===
                true,
              options:
                Array.isArray(
                  field.options,
                )
                  ? field.options
                      .map(
                        (
                          option: unknown,
                        ) =>
                          String(
                            option ||
                              '',
                          ).slice(
                            0,
                            120,
                          ),
                      )
                      .filter(
                        Boolean,
                      )
                  : [],
              sort_order:
                index,
            });
          }

          // Replace the service form atomically.
          const {
            error:
              deleteError,
          } =
            await admin
              .from(
                'service_intake_fields',
              )
              .delete()
              .eq(
                'service_slug',
                serviceSlug,
              );

          if (
            deleteError
          ) {
            throw deleteError;
          }

          if (
            rows.length >
            0
          ) {
            const {
              error:
                insertError,
            } =
              await admin
                .from(
                  'service_intake_fields',
                )
                .insert(
                  rows,
                );

            if (
              insertError
            ) {
              throw insertError;
            }
          }

          await logAdminAction(
            admin,
            {
              adminUserId,
              orderId: null,
              action:
                'intake_saved',
              description:
                `Intake form saved for ${serviceSlug} (${rows.length} fields).`,
              metadata: {
                service_slug:
                  serviceSlug,
              },
            },
          );

          return json({
            success: true,
          });
        }

        if (
          action ===
          'milestone_template_save'
        ) {
          const templates =
            Array.isArray(
              body?.templates,
            )
              ? body.templates
              : [];

          const serviceSlug =
            clean(
              body?.service_slug,
              80,
            );

          if (
            !serviceSlug
          ) {
            return json(
              {
                success: false,
                message:
                  'Choose a service first.',
              },
              400,
            );
          }

          const {
            error:
              deleteError,
          } =
            await admin
              .from(
                'service_milestone_templates',
              )
              .delete()
              .eq(
                'service_slug',
                serviceSlug,
              );

          if (
            deleteError
          ) {
            throw deleteError;
          }

          const rows =
            templates
              .map(
                (
                  template: any,
                  index: number,
                ) => ({
                  service_slug:
                    serviceSlug,
                  title:
                    clean(
                      template.title,
                      160,
                    ),
                  description:
                    clean(
                      template.description,
                      2000,
                    ) ||
                    null,
                  sequence:
                    index,
                  default_duration_days:
                    Math.max(
                      0,
                      Math.round(
                        Number(
                          template.default_duration_days ||
                            7,
                        ),
                      ),
                    ),
                }),
              )
              .filter(
                (
                  row: any,
                ) =>
                  Boolean(
                    row.title,
                  ),
              );

          if (
            rows.length >
            0
          ) {
            const {
              error:
                insertError,
            } =
              await admin
                .from(
                  'service_milestone_templates',
                )
                .insert(
                  rows,
                );

            if (
              insertError
            ) {
              throw insertError;
            }
          }

          return json({
            success: true,
          });
        }

        /* ====================================================
           AGREEMENTS
           ==================================================== */

        if (
          action ===
          'agreement_template_save'
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

          const templateBody =
            clean(
              body?.body,
              20000,
            );

          if (
            !name ||
            !templateBody
          ) {
            return json(
              {
                success: false,
                message:
                  'Name and agreement wording are required.',
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
                  'agreement_templates',
                )
                .update({
                  name,
                  body: templateBody,
                  active:
                    body?.active !==
                    false,
                })
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
                  'agreement_templates',
                )
                .insert({
                  name,
                  body: templateBody,
                  version: 1,
                  active: true,
                  created_by:
                    adminUserId,
                });

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
          'agreement_create'
        ) {
          const orderId =
            clean(
              body?.orderId,
              100,
            );

          const title =
            clean(
              body?.title,
              200,
            ) ||
            'Project agreement';

          let templateBody =
            clean(
              body?.body,
              20000,
            );

          const templateId =
            clean(
              body?.template_id,
              100,
            ) ||
            null;

          if (
            !orderId
          ) {
            return json(
              {
                success: false,
                message:
                  'Choose a project first.',
              },
              400,
            );
          }

          if (
            !templateBody &&
            templateId
          ) {
            const {
              data: template,
            } =
              await admin
                .from(
                  'agreement_templates',
                )
                .select(
                  'body',
                )
                .eq(
                  'id',
                  templateId,
                )
                .maybeSingle();

            templateBody =
              template?.body ||
              '';
          }

          if (!templateBody) {
            return json(
              {
                success: false,
                message:
                  'Agreement wording is required.',
              },
              400,
            );
          }

          const {
            data: latest,
          } =
            await admin
              .from(
                'agreements',
              )
              .select(
                'version',
              )
              .eq(
                'order_id',
                orderId,
              )
              .order(
                'version',
                {
                  ascending:
                    false,
                },
              )
              .limit(1)
              .maybeSingle();

          const version =
            Number(
              latest?.version ||
                0,
            ) + 1;

          const encoder =
            new TextEncoder();

          const digest =
            await crypto.subtle.digest(
              'SHA-256',
              encoder.encode(
                templateBody,
              ),
            );

          const hash =
            Array.from(
              new Uint8Array(
                digest,
              ),
            )
              .map(
                (
                  byte,
                ) =>
                  byte
                    .toString(
                      16,
                    )
                    .padStart(
                      2,
                      '0',
                    ),
              )
              .join(
                '',
              );

          const {
            data: created,
            error,
          } =
            await admin
              .from(
                'agreements',
              )
              .insert({
                order_id:
                  orderId,
                template_id:
                  templateId,
                title,
                body: templateBody,
                body_hash:
                  hash,
                version,
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
            error ||
            !created
          ) {
            throw (
              error ||
              new Error(
                'The agreement could not be created.',
              )
            );
          }

          await logAdminAction(
            admin,
            {
              adminUserId,
              orderId,
              action:
                'agreement_created',
              description:
                `Agreement "${title}" version ${version} prepared.`,
              metadata: {
                agreement_id:
                  created.id,
              },
            },
          );

          return json({
            success: true,
            agreementId:
              created.id,
          });
        }

        if (
          action ===
          'agreement_send'
        ) {
          const id =
            clean(
              body?.id,
              100,
            );

          const {
            data: agreement,
          } =
            await admin
              .from(
                'agreements',
              )
              .select(
                'id,order_id,title,status',
              )
              .eq(
                'id',
                id,
              )
              .maybeSingle();

          if (!agreement) {
            return json(
              {
                success: false,
                message:
                  'The agreement could not be found.',
              },
              404,
            );
          }

          if (
            agreement.status !==
            'draft'
          ) {
            return json(
              {
                success: false,
                message:
                  'Only draft agreements can be sent.',
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
                  'sent',
              })
              .eq(
                'id',
                id,
              );

          if (error) {
            throw error;
          }

          const {
            data: order,
          } =
            await admin
              .from(
                'orders',
              )
              .select(
                'id,customer_id,reference,project_title',
              )
              .eq(
                'id',
                agreement.order_id,
              )
              .maybeSingle();

          if (order) {
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
                  'agreement_sent',
                status:
                  'pending',
                payload: {
                  reference:
                    order.reference,
                  project_title:
                    order.project_title,
                  agreement_id:
                    id,
                  title:
                    agreement.title,
                },
              });
          }

          await logAdminAction(
            admin,
            {
              adminUserId,
              orderId:
                agreement.order_id,
              action:
                'agreement_sent',
              description:
                `Agreement "${agreement.title}" sent to the client.`,
              metadata: {
                agreement_id:
                  id,
              },
            },
          );

          return json({
            success: true,
          });
        }

        /* ====================================================
           MEETINGS
           ==================================================== */

        if (
          action ===
          'meeting_save'
        ) {
          const id =
            clean(
              body?.id,
              100,
            ) ||
            null;

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
            )
          ) {
            return json(
              {
                success: false,
                message:
                  'Choose a valid meeting time.',
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
            !MEETING_KINDS.includes(
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

          const row: Record<
            string,
            unknown
          > = {
            lead_id:
              clean(
                body?.lead_id,
                100,
              ) ||
              null,
            customer_id:
              clean(
                body?.customer_id,
                100,
              ) ||
              null,
            order_id:
              clean(
                body?.order_id,
                100,
              ) ||
              null,
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
            participants:
              clean(
                body?.participants,
                500,
              ) ||
              null,
            notes:
              clean(
                body?.notes,
                5000,
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
                  'meetings',
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
                  'meetings',
                )
                .insert({
                  ...row,
                  status:
                    'scheduled',
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
                  'The meeting could not be scheduled.',
                )
              );
            }

            if (
              row.customer_id
            ) {
              await admin
                .from(
                  'notification_events',
                )
                .insert({
                  order_id:
                    row.order_id,
                  customer_id:
                    row.customer_id,
                  channel:
                    'internal',
                  event_type:
                    'meeting_scheduled',
                  status:
                    'pending',
                  payload: {
                    meeting_id:
                      created.id,
                    kind: row.kind,
                    scheduled_at:
                      row.scheduled_at,
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
          'meeting_status'
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
            !MEETING_STATUSES.includes(
              status,
            )
          ) {
            return json(
              {
                success: false,
                message:
                  'Choose a valid meeting status.',
              },
              400,
            );
          }

          const {
            error,
          } =
            await admin
              .from(
                'meetings',
              )
              .update({
                status,
                outcome:
                  clean(
                    body?.outcome,
                    5000,
                  ) ||
                  null,
                next_action:
                  clean(
                    body?.next_action,
                    500,
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
          });
        }

        if (
          action ===
          'meeting_delete'
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
                'meetings',
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

        return json(
          {
            success: false,
            message:
              'Unsupported sales action.',
          },
          400,
        );
      } catch (error) {
        console.error(
          'sales-action:',
          error,
        );

        return json(
          {
            success: false,
            message:
              error instanceof
              Error
                ? error.message
                : 'The sales action could not be completed.',
          },
          500,
        );
      }
    },
  ),
};
