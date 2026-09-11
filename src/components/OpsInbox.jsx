import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';


import Icon from './ui/Icon';
import Link from './PortalLink';

import {
  useAuth,
} from '../context/AuthContext';

import {
  getAdminOrders,
} from '../lib/admin';

import {
  getOpsSnapshot,
  getInboxStates,
  getTeamMembers,
  runOperationsAction,
} from '../lib/operations';

import {
  getAdminPartPaymentInbox,
} from '../lib/projectFinance';

import {
  formatNaira,
} from '../lib/reports';

import {
  useToast,
} from './ui/Toast';

const SNOOZE_OPTIONS = [
  {
    label: 'Later today',
    hours: 6,
  },
  {
    label: 'Tomorrow',
    hours: 24,
  },
  {
    label: 'Next week',
    hours: 24 * 7,
  },
];

function isLive(
  state,
) {
  if (!state) {
    return true;
  }

  if (
    state.state ===
    'resolved'
  ) {
    return false;
  }

  if (
    state.state ===
    'snoozed' &&
    state.snoozed_until &&
    new Date(
      state.snoozed_until,
    ).getTime() >
      Date.now()
  ) {
    return false;
  }

  return true;
}

export function buildInboxItems(
  {
    orders = [],
    partPayments = [],
    snapshot = null,
  } = {},
) {
  const items = [];
  const today =
    new Date()
      .toISOString()
      .slice(
        0,
        10,
      );

  for (const order of orders) {
    if (
      order.archived_at
    ) {
      continue;
    }

    const title =
      order.project_title ||
      order.reference;

    if (
      order.review_decision ===
      'pending'
    ) {
      items.push({
        key: `order-review:${order.id}`,
        kind: 'Review project',
        title: `Review project: ${title}`,
        detail:
          order.customers
            ?.full_name ||
          order.customers
            ?.email ||
          'New project request',
        to: `orders/${order.reference}`,
        priority: 'high',
        at: order.created_at,
      });
    }

    if (
      order.deadline &&
      order.deadline <
        today &&
      ![
        'completed',
        'cancelled',
      ].includes(
        order.status,
      )
    ) {
      items.push({
        key: `deadline-risk:${order.id}`,
        kind: 'Deadline risk',
        title: `Deadline passed: ${title}`,
        detail: `Was due ${order.deadline}`,
        to: `orders/${order.reference}`,
        priority: 'high',
        at: order.deadline,
      });
    } else if (
      order.deadline &&
      order.deadline <=
        new Date(
          Date.now() +
            3 *
              86400000,
        )
          .toISOString()
          .slice(
            0,
            10,
          ) &&
      ![
        'completed',
        'cancelled',
      ].includes(
        order.status,
      )
    ) {
      items.push({
        key: `deadline-soon:${order.id}`,
        kind: 'Deadline approaching',
        title: `Due soon: ${title}`,
        detail: `Due ${order.deadline}`,
        to: `orders/${order.reference}`,
        priority: 'normal',
        at: order.deadline,
      });
    }

    if (
      order.customer_action_required &&
      order.status ===
        'awaiting_client'
    ) {
      items.push({
        key: `client-wait:${order.id}`,
        kind: 'Client awaiting response',
        title: `Client waiting: ${title}`,
        detail:
          order.customer_action_label ||
          'Client action outstanding',
        to: `orders/${order.reference}`,
        priority: 'normal',
        at: order.created_at,
      });
    }

    const outstanding =
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
      );

    if (
      outstanding > 0 &&
      order.review_decision ===
        'approved' &&
      order.deadline &&
      order.deadline <
        today
    ) {
      items.push({
        key: `overdue-payment:${order.id}`,
        kind: 'Payment overdue',
        title: `Overdue balance: ${title}`,
        detail: 'Final balance outstanding past deadline',
        to: `orders/${order.reference}`,
        priority: 'high',
        at: order.deadline,
      });
    }
  }

  for (const request of partPayments ||
    []) {
    items.push({
      key: `part-payment:${request.id}`,
      kind: 'Approve part payment',
      title: `Part-payment: ${request.orders?.project_title || request.orders?.reference || 'project'}`,
      detail: `Requested ${formatNaira(request.requested_amount_kobo)}`,
      to: 'payments',
      priority: 'high',
      at: request.created_at,
    });
  }

  if (snapshot) {
    for (const revision of snapshot.revisions ||
      []) {
      if (
        [
          'open',
          'acknowledged',
          'in_progress',
        ].includes(
          revision.status,
        )
      ) {
        items.push({
          key: `revision:${revision.id}`,
          kind: 'Client requested revision',
          title: `Revision: ${revision.order?.project_title || revision.order?.reference || 'project'}`,
          detail:
            String(
              revision.description ||
                '',
            ).slice(
              0,
              120,
            ),
          to: revision.order?.reference
            ? `orders/${revision.order.reference}`
            : 'orders',
          priority: 'high',
          at: revision.created_at,
        });
      }
    }

    for (const change of snapshot.changes ||
      []) {
      if (
        [
          'questioned',
        ].includes(
          change.status,
        )
      ) {
        items.push({
          key: `change-response:${change.id}`,
          kind: 'Review change request response',
          title: `Change response: ${change.title}`,
          detail:
            change.order?.reference ||
            'Scope change',
          to: change.order?.reference
            ? `orders/${change.order.reference}`
            : 'orders',
          priority: 'normal',
          at: change.created_at,
        });
      }
    }

    for (const payment of snapshot.payments ||
      []) {
      if (
        [
          'failed',
        ].includes(
          payment.status,
        ) ||
        payment.attempt_stage ===
          'requires_attention'
      ) {
        items.push({
          key: `payment-attention:${payment.id}`,
          kind: 'Payment needs attention',
          title: `Payment ${payment.provider_reference || 'attempt'} needs review`,
          detail:
            payment.status ||
            'Verification issue',
          to: 'payments',
          priority: 'high',
          at: payment.created_at,
        });
      }
    }

    for (const file of snapshot.files ||
      []) {
      const ageHours =
        (
          Date.now() -
          new Date(
            file.created_at,
          ).getTime()
        ) /
        3600000;

      if (
        ageHours <
        72
      ) {
        items.push({
          key: `upload:${file.id}`,
          kind: 'Client uploaded files',
          title: `New upload: ${file.original_name || 'file'}`,
          detail:
            'Uploaded in the last 3 days',
          to: 'orders',
          priority: 'low',
          at: file.created_at,
        });
      }
    }

    for (const request of snapshot.requests ||
      []) {
      if (
        request.status ===
        'new'
      ) {
        items.push({
          key: `request:${request.id}`,
          kind: 'New service request',
          title: `Request: ${request.title}`,
          detail:
            request.customer
              ?.full_name ||
            request.customer
              ?.email ||
            request.reference,
          to: 'requests',
          priority:
            request.priority ===
            'urgent'
              ? 'high'
              : 'normal',
          at: request.created_at,
        });
      }

      if (
        request.due_date &&
        request.due_date <
          today &&
        ![
          'completed',
          'cancelled',
        ].includes(
          request.status,
        )
      ) {
        items.push({
          key: `request-overdue:${request.id}`,
          kind: 'Request overdue',
          title: `Overdue request: ${request.title}`,
          detail: `Was due ${request.due_date}`,
          to: 'requests',
          priority: 'high',
          at: request.due_date,
        });
      }
    }

    for (const lead of snapshot.leads ||
      []) {
      if (
        lead.archived_at
      ) {
        continue;
      }

      const activeStages = [
        'new',
        'contacted',
        'qualified',
        'discovery',
        'proposal_prepared',
        'proposal_sent',
        'negotiation',
      ];

      if (
        !activeStages.includes(
          lead.stage,
        )
      ) {
        continue;
      }

      if (!lead.next_action) {
        items.push({
          key: `lead-no-action:${lead.id}`,
          kind: 'Lead without next action',
          title: `No next action: ${lead.company || lead.name}`,
          detail: `Stage: ${lead.stage.replaceAll('_', ' ')}`,
          to: 'sales',
          priority: 'normal',
          at: lead.created_at,
        });
      } else if (
        lead.next_action_due &&
        lead.next_action_due <
          today
      ) {
        items.push({
          key: `lead-overdue:${lead.id}`,
          kind: 'Overdue lead follow-up',
          title: `Follow up: ${lead.company || lead.name}`,
          detail: lead.next_action,
          to: 'sales',
          priority: 'high',
          at: lead.next_action_due,
        });
      }
    }
  }

  const rank = {
    high: 0,
    normal: 1,
    low: 2,
  };

  return items.sort(
    (
      a,
      b,
    ) =>
      rank[
        a.priority
      ] -
        rank[
          b.priority
        ] ||
      new Date(
        b.at || 0,
      ).getTime() -
        new Date(
          a.at || 0,
        ).getTime(),
  );
}

export default function OpsInbox({
  compact = false,
  limit = 0,
}) {
  const toast =
    useToast();

  const {
    adminPath,
  } =
    useAuth();

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    error,
    setError,
  ] =
    useState('');

  const [
    items,
    setItems,
  ] =
    useState([]);

  const [
    states,
    setStates,
  ] =
    useState(
      new Map(),
    );

  const [
    filter,
    setFilter,
  ] =
    useState('all');

  const [
    snoozing,
    setSnoozing,
  ] =
    useState(null);

  const [
    members,
    setMembers,
  ] =
    useState([]);

  const load =
    useCallback(
      async () => {
        try {
          setError('');
          setLoading(
            true,
          );

          const [
            orders,
            partPayments,
            snapshot,
            inboxStates,
          ] =
            await Promise.all([
              getAdminOrders().catch(
                () => [],
              ),
              getAdminPartPaymentInbox().catch(
                () => [],
              ),
              getOpsSnapshot().catch(
                () => null,
              ),
              getInboxStates().catch(
                () => new Map(),
              ),
            ]);

          setItems(
            buildInboxItems({
              orders,
              partPayments,
              snapshot,
            }),
          );
          setStates(
            inboxStates,
          );
        } catch (loadError) {
          setError(
            loadError.message ||
              'The operations inbox could not be loaded.',
          );
        } finally {
          setLoading(
            false,
          );
        }
      },
      [],
    );

  useEffect(() => {
    load();

    getTeamMembers()
      .then(
        setMembers,
      )
      .catch(
        () => {},
      );
  }, [
    load,
  ]);

  const currentAssignee = (itemKey) =>
    states.get(itemKey)?.assignee_id || null;

  const setState = async (
    itemKey,
    state,
    snoozedUntil = null,
    assigneeId = undefined,
  ) => {
    try {
      await runOperationsAction({
        action:
          'inbox_set',
        item_key:
          itemKey,
        state,
        snoozed_until:
          snoozedUntil,
        assignee_id:
          assigneeId === undefined
            ? currentAssignee(itemKey)
            : assigneeId,
      });

      setStates(
        (
          current,
        ) => {
          const next =
            new Map(
              current,
            );

          next.set(
            itemKey,
            {
              item_key:
                itemKey,
              state,
              snoozed_until:
                snoozedUntil,
            },
          );

          return next;
        },
      );

      setSnoozing(
        null,
      );
    } catch (stateError) {
      toast.error(
        stateError.message,
      );
    }
  };

  const visible = useMemo(() => {
    let rows = items.filter(
      (
        item,
      ) =>
        isLive(
          states.get(
            item.key,
          ),
        ),
    );

    if (
      filter !==
      'all'
    ) {
      rows = rows.filter(
        (
          item,
        ) =>
          item.priority ===
          filter,
      );
    }

    if (
      limit >
      0
    ) {
      rows = rows.slice(
        0,
        limit,
      );
    }

    return rows;
  }, [
    items,
    states,
    filter,
    limit,
  ]);

  const openCount =
    items.filter(
      (
        item,
      ) =>
        isLive(
          states.get(
            item.key,
          ),
        ),
    ).length;

  if (loading) {
    return (
      <section className="admin-control-card">
        <span className="posho-section-label">
          Operations inbox
        </span>

        <p className="admin-card-description">
          Gathering everything that needs attention…
        </p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="admin-control-card">
        <span className="posho-section-label">
          Operations inbox
        </span>

        <div
          className="admin-error"
          role="alert"
        >
          {error}
        </div>

        <button
          type="button"
          className="button button-secondary"
          onClick={
            load
          }
        >
          Try again
        </button>
      </section>
    );
  }

  return (
    <section className="admin-control-card">
      <div className="finance-request-heading">
        <div>
          <span>
            OPERATIONS INBOX
          </span>

          <h3>
            {openCount === 0
              ? 'All clear'
              : `${openCount} item${openCount === 1 ? '' : 's'} need attention`}
          </h3>

          {!compact && (
            <p className="admin-card-description">
              Every item links directly to its action.
              Snoozed items reappear after their time
              passes.
            </p>
          )}
        </div>

        {!compact && (
          <select
            value={
              filter
            }
            onChange={(
              event,
            ) =>
              setFilter(
                event.target
                  .value,
              )
            }
            aria-label="Filter inbox by priority"
          >
            <option value="all">
              All priorities
            </option>

            <option value="high">
              High
            </option>

            <option value="normal">
              Normal
            </option>

            <option value="low">
              Low
            </option>
          </select>
        )}
      </div>

      {visible.length ===
      0 ? (
        <div className="admin-project-empty-state admin-project-empty-state-small">
          <Icon name="notifications_active"             size={22}
          />

          <span>
            Nothing needs attention right now.
          </span>
        </div>
      ) : (
        <div className="posho-ledger">
          {visible.map(
            (
              item,
            ) => (
              <article
                key={
                  item.key
                }
                className="posho-ledger-item"
              >
                <header>
                  <span
                    className={`posho-source-tag posho-source-${
                      item.priority ===
                      'high'
                        ? 'reversal'
                        : item.priority ===
                            'normal'
                          ? 'adjustment'
                          : 'manual'
                    }`}
                  >
                    {
                      item.kind
                    }
                  </span>

                  <small>
                    {
                      item.priority
                    }
                  </small>
                </header>

                <strong className="posho-long-value">
                  {
                    item.title
                  }
                </strong>

                {item.detail && (
                  <p className="posho-long-value">
                    {
                      item.detail
                    }
                  </p>
                )}

                {states.get(item.key)?.assignee_id && (
                  <p>
                    <small>
                      Assigned to{' '}
                      {members.find(
                        (member) =>
                          member.id ===
                          states.get(item.key)
                            ?.assignee_id,
                      )?.display_name ||
                        'a team member'}
                    </small>
                  </p>
                )}

                <div className="finance-review-actions">
                  <Link
                    to={adminPath(
                      item.to,
                    )}
                    className="button button-primary"
                  >
                    Open
                    <Icon name="arrow_forward"                       size={15}
                    />
                  </Link>

                  {!compact && (
                    <>
                      <button
                        type="button"
                        className="button button-secondary"
                        onClick={() =>
                          setSnoozing(
                            snoozing ===
                            item.key
                              ? null
                              : item.key,
                          )
                        }
                      >
                        <Icon name="schedule"                           size={15}
                        />
                        Snooze
                      </button>

                      <button
                        type="button"
                        className="button button-secondary"
                        onClick={() =>
                          setState(
                            item.key,
                            'resolved',
                          )
                        }
                        aria-label={`Resolve ${item.title}`}
                      >
                        <Icon name="done_all"                           size={15}
                        />
                        Resolve
                      </button>
                    </>
                  )}
                </div>

                {!compact && members.length > 0 && (
                  <div
                    className="finance-review-actions"
                    style={{ marginTop: 8 }}
                  >
                    <select
                      value={
                        states.get(item.key)?.assignee_id ||
                        ''
                      }
                      onChange={(event) =>
                        setState(
                          item.key,
                          states.get(item.key)?.state ===
                            'snoozed'
                            ? 'snoozed'
                            : 'open',
                          states.get(item.key)
                            ?.snoozed_until ||
                            null,
                          event.target.value ||
                            null,
                        )
                      }
                      aria-label={`Assign ${item.title}`}
                    >
                      <option value="">
                        Unassigned
                      </option>

                      {members.map((member) => (
                        <option
                          key={member.id}
                          value={member.id}
                        >
                          {member.display_name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {snoozing ===
                  item.key && (
                  <div
                    className="finance-review-actions"
                    style={{
                      marginTop: 8,
                    }}
                  >
                    {SNOOZE_OPTIONS.map(
                      (
                        option,
                      ) => (
                        <button
                          key={
                            option.label
                          }
                          type="button"
                          className="button button-secondary"
                          onClick={() =>
                            setState(
                              item.key,
                              'snoozed',
                              new Date(
                                Date.now() +
                                  option.hours *
                                    3600000,
                              ).toISOString(),
                            )
                          }
                        >
                          {
                            option.label
                          }
                        </button>
                      ),
                    )}
                  </div>
                )}
              </article>
            ),
          )}
        </div>
      )}
    </section>
  );
}
