import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';


import Icon from '../components/ui/Icon';
import BrandLoader from '../components/BrandLoader';
import PageHeader from '../components/ui/PageHeader';
import MetricCard from '../components/ui/MetricCard';
import StatusBadge from '../components/ui/StatusBadge';
import Tabs from '../components/ui/Tabs';
import {
  EmptyState,
  ErrorBlock,
} from '../components/ui/StateBlocks';

import {
  useToast,
} from '../components/ui/Toast';

import {
  useEscapeClose,
} from '../components/ui/useEscapeClose';

import {
  getAdminCustomers,
} from '../lib/admin';

import {
  getRequests,
  getRequestDetail,
  getRetainers,
  getTeam,
  runOperationsAction,
} from '../lib/operations';

const TABS = [
  'all',
  'new',
  'assigned',
  'active',
  'waiting_on_client',
  'awaiting_review',
  'unassigned',
  'overdue',
  'completed',
];

const PRIORITIES = [
  'low',
  'normal',
  'high',
  'urgent',
];

const STATUSES = [
  'new',
  'assigned',
  'active',
  'waiting_on_client',
  'awaiting_review',
  'completed',
  'cancelled',
];

function pretty(
  value,
) {
  return String(
    value ||
      '',
  ).replaceAll(
    '_',
    ' ',
  );
}

export default function AdminRequests() {
  const toast =
    useToast();

  const [
    tab,
    setTab,
  ] =
    useState(
      'all',
    );

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
    requests,
    setRequests,
  ] =
    useState([]);

  const [
    members,
    setMembers,
  ] =
    useState([]);

  const [
    customers,
    setCustomers,
  ] =
    useState([]);

  const [
    retainers,
    setRetainers,
  ] =
    useState([]);

  const [
    query,
    setQuery,
  ] =
    useState('');

  const [
    detail,
    setDetail,
  ] =
    useState(null);

  const [
    comments,
    setComments,
  ] =
    useState([]);

  const [
    detailLoading,
    setDetailLoading,
  ] =
    useState(false);

  const [
    busy,
    setBusy,
  ] =
    useState(false);

  const [
    createOpen,
    setCreateOpen,
  ] =
    useState(false);

  const [
    form,
    setForm,
  ] =
    useState({
      customer_id: '',
      title: '',
      description: '',
      service_slug: 'creative-solutions',
      priority: 'normal',
      assignee_id: '',
      due_date: '',
      order_id: '',
      retainer_id: '',
    });

  const [
    commentBody,
    setCommentBody,
  ] =
    useState('');

  const [
    commentInternal,
    setCommentInternal,
  ] =
    useState(false);

  const [
    checklistEdit,
    setChecklistEdit,
  ] =
    useState('');

  const [
    billing,
    setBilling,
  ] =
    useState(null);

  const [
    billAmount,
    setBillAmount,
  ] =
    useState('');

  const [
    billNote,
    setBillNote,
  ] =
    useState('');

  useEscapeClose(
    Boolean(
      detail,
    ) && !busy,
    () =>
      setDetail(
        null,
      ),
  );

  useEscapeClose(
    createOpen &&
      !busy,
    () =>
      setCreateOpen(
        false,
      ),
  );

  useEscapeClose(
    Boolean(
      billing,
    ) && !busy,
    () =>
      setBilling(
        null,
      ),
  );

  const load =
    useCallback(
      async () => {
        try {
          setError('');
          setLoading(
            true,
          );

          const [
            rows,
            team,
            customerRows,
            retainerRows,
          ] =
            await Promise.all([
              getRequests(),
              getTeam().catch(
                () => ({
                  members: [],
                }),
              ),
              getAdminCustomers().catch(
                () => [],
              ),
              getRetainers().catch(
                () => [],
              ),
            ]);

          setRequests(
            rows,
          );
          setMembers(
            team.members ||
              [],
          );
          setCustomers(
            customerRows,
          );
          setRetainers(
            retainerRows,
          );
        } catch (loadError) {
          setError(
            loadError.message ||
              'Requests could not be loaded.',
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
    document.title =
      'Requests | Posho Creative Management';

    load();
  }, [
    load,
  ]);

  const openDetail = async (
    id,
  ) => {
    try {
      setDetailLoading(
        true,
      );

      const result =
        await getRequestDetail(
          id,
        );

      if (!result) {
        toast.error(
          'The request could not be found.',
        );

        return;
      }

      setDetail(
        result.request,
      );
      setComments(
        result.comments,
      );
      setChecklistEdit(
        (
          result.request
            .checklist ||
          []
        )
          .map(
            (
              item,
            ) =>
              `${item.done ? '[x]' : '[ ]'} ${item.label}`,
          )
          .join(
            '\n',
          ),
      );
    } catch (detailError) {
      toast.error(
        detailError.message,
      );
    } finally {
      setDetailLoading(
        false,
      );
    }
  };

  const filtered =
    useMemo(() => {
      const needle =
        query
          .trim()
          .toLowerCase();

      let rows =
        tab ===
        'all'
          ? requests
          : tab ===
              'unassigned'
            ? requests.filter(
                (
                  request,
                ) =>
                  !request.assignee_id &&
                  ![
                    'completed',
                    'cancelled',
                  ].includes(
                    request.status,
                  ),
              )
            : tab ===
                'overdue'
              ? requests.filter(
                  (
                    request,
                  ) => {
                    const today =
                      new Date()
                        .toISOString()
                        .slice(
                          0,
                          10,
                        );

                    return (
                      request.due_date &&
                      request.due_date <
                        today &&
                      ![
                        'completed',
                        'cancelled',
                      ].includes(
                        request.status,
                      )
                    );
                  },
                )
              : requests.filter(
                  (
                    request,
                  ) =>
                    request.status ===
                    tab,
                );

      if (needle) {
        rows = rows.filter(
          (
            request,
          ) =>
            [
              request.title,
              request.reference,
              request.customer
                ?.full_name,
              request.customer
                ?.email,
            ]
              .filter(
                Boolean,
              )
              .join(
                ' ',
              )
              .toLowerCase()
              .includes(
                needle,
              ),
        );
      }

      return rows;
    }, [
      requests,
      tab,
      query,
    ]);

  const metrics =
    useMemo(() => {
      const open = requests.filter(
        (
          request,
        ) =>
          ![
            'completed',
            'cancelled',
          ].includes(
            request.status,
          ),
      );

      return {
        open: open.length,
        unassigned: requests.filter(
          (
            request,
          ) =>
            !request.assignee_id &&
            ![
              'completed',
              'cancelled',
            ].includes(
              request.status,
            ),
        ).length,
        waiting: requests.filter(
          (
            request,
          ) =>
            request.status ===
            'waiting_on_client',
        ).length,
        urgent: requests.filter(
          (
            request,
          ) =>
            request.priority ===
              'urgent' &&
            ![
              'completed',
              'cancelled',
            ].includes(
              request.status,
            ),
        ).length,
      };
    }, [
      requests,
    ]);

  const setField = (
    field,
    value,
  ) =>
    setForm(
      (
        current,
      ) => ({
        ...current,
        [field]:
          value,
      }),
    );

  const submitCreate = async (
    event,
  ) => {
    event.preventDefault();

    try {
      setBusy(
        true,
      );

      await runOperationsAction({
        action:
          'request_save',
        customer_id:
          form.customer_id,
        title:
          form.title.trim(),
        description:
          form.description.trim(),
        service_slug:
          form.service_slug,
        priority:
          form.priority,
        assignee_id:
          form.assignee_id ||
          null,
        due_date:
          form.due_date ||
          null,
        order_id:
          form.order_id ||
          null,
        retainer_id:
          form.retainer_id ||
          null,
      });

      toast.success(
        'Request created and audited.',
      );
      setCreateOpen(
        false,
      );
      setForm({
        customer_id: '',
        title: '',
        description: '',
        service_slug:
          'creative-solutions',
        priority:
          'normal',
        assignee_id: '',
        due_date: '',
        order_id: '',
        retainer_id: '',
      });
      await load();
    } catch (createError) {
      toast.error(
        createError.message,
      );
    } finally {
      setBusy(
        false,
      );
    }
  };

  const changeStatus = async (
    status,
    extra = {},
  ) => {
    if (!detail) {
      return;
    }

    try {
      setBusy(
        true,
      );

      await runOperationsAction({
        action:
          'request_status',
        id: detail.id,
        status,
        ...extra,
      });

      toast.success(
        `Request moved to ${pretty(status)}.`,
      );
      await load();
      await openDetail(
        detail.id,
      );
    } catch (statusError) {
      toast.error(
        statusError.message,
      );
    } finally {
      setBusy(
        false,
      );
    }
  };

  const saveChecklist = async () => {
    if (!detail) {
      return;
    }

    const checklist =
      checklistEdit
        .split(
          '\n',
        )
        .map(
          (
            line,
          ) =>
            line.trim(),
        )
        .filter(
          Boolean,
        )
        .slice(
          0,
          50,
        )
        .map(
          (
            line,
          ) => {
            const done =
              /^\[x\]/i.test(
                line,
              );

            return {
              label: line
                .replace(
                  /^\[[ x]\]\s*/i,
                  '',
                )
                .slice(
                  0,
                  200,
                ),
              done,
            };
          },
        )
        .filter(
          (
            item,
          ) =>
            Boolean(
              item.label,
            ),
        );

    try {
      setBusy(
        true,
      );

      await runOperationsAction({
        action:
          'request_save',
        id: detail.id,
        title:
          detail.title,
        description:
          detail.description,
        service_slug:
          detail.service_slug,
        priority:
          detail.priority,
        status:
          detail.status,
        assignee_id:
          detail.assignee_id,
        due_date:
          detail.due_date,
        order_id:
          detail.order_id,
        retainer_id:
          detail.retainer_id,
        checklist,
      });

      toast.success(
        'Checklist saved.',
      );
      await load();
      await openDetail(
        detail.id,
      );
    } catch (checklistError) {
      toast.error(
        checklistError.message,
      );
    } finally {
      setBusy(
        false,
      );
    }
  };

  const postComment = async (
    event,
  ) => {
    event.preventDefault();

    if (
      !commentBody.trim()
    ) {
      return;
    }

    try {
      setBusy(
        true,
      );

      await runOperationsAction({
        action:
          'request_comment',
        id: detail.id,
        body:
          commentBody.trim(),
        internal:
          commentInternal,
      });

      setCommentBody(
        '',
      );
      await openDetail(
        detail.id,
      );
    } catch (commentError) {
      toast.error(
        commentError.message,
      );
    } finally {
      setBusy(
        false,
      );
    }
  };

  const submitBill = async (
    event,
  ) => {
    event.preventDefault();

    const amountKobo =
      Math.round(
        Number(
          billAmount,
        ) * 100,
      );

    if (
      !Number.isFinite(
        amountKobo,
      ) ||
      amountKobo <=
        0
    ) {
      toast.error(
        'Enter a charge above zero.',
      );

      return;
    }

    try {
      setBusy(
        true,
      );

      await runOperationsAction({
        action:
          'request_bill',
        id: billing.id,
        amount_kobo:
          amountKobo,
        description:
          billNote.trim(),
      });

      toast.success(
        'One-off charge linked to the project ledger.',
      );
      setBilling(
        null,
      );
      setBillAmount(
        '',
      );
      setBillNote(
        '',
      );
      await load();

      if (detail) {
        await openDetail(
          detail.id,
        );
      }
    } catch (billError) {
      toast.error(
        billError.message,
      );
    } finally {
      setBusy(
        false,
      );
    }
  };

  if (loading) {
    return (
      <BrandLoader label="Loading requests…" />
    );
  }

  return (
    <div className="admin-view page-reveal">
      <PageHeader
        kicker="Client service"
        title="Request queue"
        description="Small work stays out of projects. Nothing becomes a chaotic inbox."
        actions={
          <button
            type="button"
            className="button button-primary"
            onClick={() =>
              setCreateOpen(
                true,
              )
            }
          >
            <Icon name="add"               size={17}
            />
            New request
          </button>
        }
      />

      {error && (
        <ErrorBlock
          message={
            error
          }
          onRetry={
            load
          }
        />
      )}

      <div className="admin-dashboard-stat-grid">
        <MetricCard
          label="Open requests"
          value={
            metrics.open
          }
          detail="Across all statuses"
        />

        <MetricCard
          label="Unassigned"
          value={
            metrics.unassigned
          }
          detail="Needs an owner"
          tone={
            metrics.unassigned >
            0
              ? 'amber'
              : 'neutral'
          }
        />

        <MetricCard
          label="Waiting on client"
          value={
            metrics.waiting
          }
          detail="Client dependencies"
        />

        <MetricCard
          label="Urgent open"
          value={
            metrics.urgent
          }
          detail="Exceptional priority"
          tone={
            metrics.urgent >
            0
              ? 'red'
              : 'neutral'
          }
        />
      </div>

      <div className="posho-search-row">
        <label
          style={{
            display:
              'flex',
            alignItems:
              'center',
            gap: 8,
          }}
        >
          <Icon name="search"             size={17}
            aria-hidden="true"
          />

          <input
            type="search"
            value={
              query
            }
            onChange={(
              event,
            ) =>
              setQuery(
                event.target
                  .value,
              )
            }
            placeholder="Search title, reference, client…"
            aria-label="Search requests"
          />
        </label>
      </div>

      <Tabs
        tabs={TABS.map(
          (
            key,
          ) => ({
            key,
            label:
              key ===
              'all'
                ? 'All'
                : pretty(
                    key,
                  ),
          }),
        )}
        active={
          tab
        }
        onChange={
          setTab
        }
        label="Request filters"
      />

      {filtered.length ===
      0 ? (
        <EmptyState
          title="No requests here"
          body="New client and team requests land in this queue."
        />
      ) : (
        <div className="admin-data-card">
          {filtered.map(
            (
              request,
            ) => (
              <button
                key={
                  request.id
                }
                type="button"
                className="admin-data-row admin-data-row-button"
                onClick={() =>
                  openDetail(
                    request.id,
                  )
                }
              >
                <div>
                  <small className="posho-long-value">
                    {
                      request.reference
                    }
                  </small>

                  <strong className="posho-long-value">
                    {
                      request.title
                    }
                  </strong>

                  <span className="posho-long-value">
                    {request.customer
                      ?.full_name ||
                      request.customer
                        ?.email ||
                      ''}
                    {request.due_date
                      ? ` · Due ${request.due_date}`
                      : ''}
                  </span>
                </div>

                <div>
                  <StatusBadge
                    value={
                      request.priority
                    }
                  />
                </div>

                <div>
                  <StatusBadge
                    value={
                      request.status
                    }
                  />
                </div>

                <div>
                  <span>
                    {
                      request.assignee
                        ?.display_name ||
                        'Unassigned'
                    }
                  </span>
                </div>
              </button>
            ),
          )}
        </div>
      )}

      {createOpen && (
        <div
          className="posho-modal-backdrop"
          onClick={() =>
            !busy &&
            setCreateOpen(
              false,
            )
          }
        >
          <form
            role="dialog"
            aria-modal="true"
            aria-label="New service request"
            className="posho-modal"
            onClick={(
              event,
            ) =>
              event.stopPropagation()
            }
            onSubmit={
              submitCreate
            }
          >
            <div className="posho-modal-heading">
              <h3>
                New request
              </h3>

              <button
                type="button"
                onClick={() =>
                  setCreateOpen(
                    false,
                  )
                }
                aria-label="Close request form"
                disabled={
                  busy
                }
              >
                <Icon name="close"                   size={19}
                />
              </button>
            </div>

            <p className="posho-modal-description">
              Creating on behalf of a
              client is audited with
              your identity.
            </p>

            <div className="posho-form-grid">
              <label>
                <span>
                  Client
                </span>

                <select
                  value={
                    form.customer_id
                  }
                  onChange={(
                    event,
                  ) =>
                    setField(
                      'customer_id',
                      event
                        .target
                        .value,
                    )
                  }
                  required
                >
                  <option value="">
                    Choose client…
                  </option>

                  {customers.map(
                    (
                      customer,
                    ) => (
                      <option
                        key={
                          customer.id
                        }
                        value={
                          customer.id
                        }
                      >
                        {customer.full_name ||
                          customer.email}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label>
                <span>
                  Title
                </span>

                <input
                  value={
                    form.title
                  }
                  onChange={(
                    event,
                  ) =>
                    setField(
                      'title',
                      event
                        .target
                        .value,
                    )
                  }
                  required
                  maxLength={200}
                  placeholder="Update homepage hero"
                />
              </label>

              <label>
                <span>
                  Description
                </span>

                <textarea
                  value={
                    form.description
                  }
                  onChange={(
                    event,
                  ) =>
                    setField(
                      'description',
                      event
                        .target
                        .value,
                    )
                  }
                  required
                  maxLength={5000}
                />
              </label>

              <label>
                <span>
                  Priority
                </span>

                <select
                  value={
                    form.priority
                  }
                  onChange={(
                    event,
                  ) =>
                    setField(
                      'priority',
                      event
                        .target
                        .value,
                    )
                  }
                >
                  {PRIORITIES.map(
                    (
                      priority,
                    ) => (
                      <option
                        key={
                          priority
                        }
                        value={
                          priority
                        }
                      >
                        {pretty(
                          priority,
                        )}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label>
                <span>
                  Assignee
                </span>

                <select
                  value={
                    form.assignee_id
                  }
                  onChange={(
                    event,
                  ) =>
                    setField(
                      'assignee_id',
                      event
                        .target
                        .value,
                    )
                  }
                >
                  <option value="">
                    Unassigned
                  </option>

                  {members.map(
                    (
                      member,
                    ) => (
                      <option
                        key={
                          member.id
                        }
                        value={
                          member.id
                        }
                      >
                        {
                          member.display_name
                        }
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label>
                <span>
                  Due date
                </span>

                <input
                  type="date"
                  value={
                    form.due_date
                  }
                  onChange={(
                    event,
                  ) =>
                    setField(
                      'due_date',
                      event
                        .target
                        .value,
                    )
                  }
                />
              </label>

              <label>
                <span>
                  Linked retainer
                  (optional)
                </span>

                <select
                  value={
                    form.retainer_id
                  }
                  onChange={(
                    event,
                  ) =>
                    setField(
                      'retainer_id',
                      event
                        .target
                        .value,
                    )
                  }
                >
                  <option value="">
                    None
                  </option>

                  {retainers
                    .filter(
                      (
                        retainer,
                      ) =>
                        !form.customer_id ||
                        retainer.customer_id ===
                          form.customer_id,
                    )
                    .map(
                      (
                        retainer,
                      ) => (
                        <option
                          key={
                            retainer.id
                          }
                          value={
                            retainer.id
                          }
                        >
                          {
                            retainer.title
                          }
                        </option>
                      ),
                    )}
                </select>
              </label>
            </div>

            <div className="posho-modal-actions">
              <button
                type="button"
                className="button button-secondary"
                onClick={() =>
                  setCreateOpen(
                    false,
                  )
                }
                disabled={
                  busy
                }
              >
                Cancel
              </button>

              <button
                type="submit"
                className="button button-primary"
                disabled={
                  busy
                }
                aria-busy={
                  busy
                }
              >
                {busy
                  ? 'Creating…'
                  : 'Create request'}
              </button>
            </div>
          </form>
        </div>
      )}

      {detailLoading && (
        <div
          className="posho-modal-backdrop"
          aria-hidden="true"
        >
          <div className="posho-modal">
            <p>
              Opening request…
            </p>
          </div>
        </div>
      )}

      {detail && (
        <div
          className="posho-modal-backdrop"
          onClick={() =>
            !busy &&
            setDetail(
              null,
            )
          }
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Request detail"
            className="posho-modal posho-modal-wide"
            onClick={(
              event,
            ) =>
              event.stopPropagation()
            }
          >
            <div className="posho-modal-heading">
              <div>
                <span>
                  REQUEST ·{' '}
                  {
                    detail.reference
                  }
                </span>

                <h3>
                  {
                    detail.title
                  }
                </h3>
              </div>

              <button
                type="button"
                onClick={() =>
                  setDetail(
                    null,
                  )
                }
                aria-label="Close request detail"
                disabled={
                  busy
                }
              >
                <Icon name="close"                   size={19}
                />
              </button>
            </div>

            <div
              style={{
                display:
                  'flex',
                gap: 8,
                flexWrap:
                  'wrap',
                marginBottom: 12,
              }}
            >
              <StatusBadge
                value={
                  detail.status
                }
              />

              <StatusBadge
                value={
                  detail.priority
                }
              />

              <StatusBadge
                value={
                  detail.billing_status
                }
              />
            </div>

            <p
              style={{
                whiteSpace:
                  'pre-wrap',
              }}
            >
              {
                detail.description
              }
            </p>

            {(() => {
              const retainer = retainers.find(
                (item) => item.id === detail.retainer_id,
              );

              if (!retainer) {
                return null;
              }

              const current = (retainer.periods || []).find(
                (period) => period.status === 'open',
              );

              const used = current
                ? Number(current.used_minutes || 0)
                : 0;

              const included = current
                ? Number(current.included_minutes || 0)
                : Number(retainer.included_minutes || 0);

              const exhausted =
                included > 0 && used >= included;

              return (
                <div
                  className={
                    exhausted
                      ? 'posho-error-block'
                      : 'posho-preview-box'
                  }
                  role="status"
                  style={{ marginBottom: 12 }}
                >
                  <strong>{retainer.title}</strong>

                  <p style={{ margin: '4px 0 0' }}>
                    {Math.floor(used / 60)}h of{' '}
                    {Math.floor(included / 60)}h used
                    {current
                      ? ` · period ${current.period_start} → ${current.period_end}`
                      : ' · no open period'}
                    {exhausted
                      ? ` · allowance exhausted — policy: ${String(retainer.overage_policy || '').replaceAll('_', ' ')}`
                      : ''}
                  </p>
                </div>
              );
            })()}

            <div className="posho-form-grid">
              <label>
                <span>
                  Assignee
                </span>

                <select
                  value={
                    detail.assignee_id ||
                    ''
                  }
                  disabled={
                    busy
                  }
                  onChange={async (
                    event,
                  ) => {
                    try {
                      setBusy(
                        true,
                      );

                      await runOperationsAction(
                        {
                          action:
                            'request_save',
                          id: detail.id,
                          title:
                            detail.title,
                          description:
                            detail.description,
                          service_slug:
                            detail.service_slug,
                          priority:
                            detail.priority,
                          status:
                            detail.status,
                          assignee_id:
                            event
                              .target
                              .value ||
                            null,
                          due_date:
                            detail.due_date,
                          order_id:
                            detail.order_id,
                          retainer_id:
                            detail.retainer_id,
                          checklist:
                            detail.checklist,
                        },
                      );

                      await load();
                      await openDetail(
                        detail.id,
                      );
                    } catch (assignError) {
                      toast.error(
                        assignError.message,
                      );
                    } finally {
                      setBusy(
                        false,
                      );
                    }
                  }}
                  aria-label="Assign request"
                >
                  <option value="">
                    Unassigned
                  </option>

                  {members.map(
                    (
                      member,
                    ) => (
                      <option
                        key={
                          member.id
                        }
                        value={
                          member.id
                        }
                      >
                        {
                          member.display_name
                        }
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label>
                <span>
                  Priority
                </span>

                <select
                  value={
                    detail.priority
                  }
                  disabled={
                    busy
                  }
                  onChange={async (
                    event,
                  ) => {
                    try {
                      setBusy(
                        true,
                      );

                      await runOperationsAction(
                        {
                          action:
                            'request_save',
                          id: detail.id,
                          title:
                            detail.title,
                          description:
                            detail.description,
                          service_slug:
                            detail.service_slug,
                          priority:
                            event
                              .target
                              .value,
                          status:
                            detail.status,
                          assignee_id:
                            detail.assignee_id,
                          due_date:
                            detail.due_date,
                          order_id:
                            detail.order_id,
                          retainer_id:
                            detail.retainer_id,
                          checklist:
                            detail.checklist,
                        },
                      );

                      await load();
                      await openDetail(
                        detail.id,
                      );
                    } catch (priorityError) {
                      toast.error(
                        priorityError.message,
                      );
                    } finally {
                      setBusy(
                        false,
                      );
                    }
                  }}
                  aria-label="Change request priority"
                >
                  {PRIORITIES.map(
                    (
                      priority,
                    ) => (
                      <option
                        key={
                          priority
                        }
                        value={
                          priority
                        }
                      >
                        {pretty(
                          priority,
                        )}
                      </option>
                    ),
                  )}
                </select>
              </label>
            </div>

            <div className="posho-kv">
              <div>
                <span>
                  Client
                </span>

                <strong>
                  {detail.customer
                    ?.full_name ||
                    detail.customer
                      ?.email ||
                    '—'}
                </strong>
              </div>

              <div>
                <span>
                  Assignee
                </span>

                <strong>
                  {members.find(
                    (
                      member,
                    ) =>
                      member.id ===
                      detail.assignee_id,
                  )
                    ?.display_name ||
                    'Unassigned'}
                </strong>
              </div>

              <div>
                <span>
                  Due
                </span>

                <strong>
                  {detail.due_date ||
                    'Not set'}
                </strong>
              </div>
            </div>

            <div
              className="finance-review-actions"
              style={{
                marginTop: 12,
              }}
            >
              <span className="posho-section-label">
                Move to
              </span>

              {STATUSES.filter(
                (
                  status,
                ) =>
                  status !==
                  detail.status,
              ).map(
                (
                  status,
                ) => (
                  <button
                    key={
                      status
                    }
                    type="button"
                    className="button button-secondary"
                    disabled={
                      busy
                    }
                    onClick={() =>
                      changeStatus(
                        status,
                      )
                    }
                  >
                    {pretty(
                      status,
                    )}
                  </button>
                ),
              )}
            </div>

            <div
              className="finance-review-actions"
              style={{
                marginTop: 8,
              }}
            >
              <button
                type="button"
                className="button button-secondary"
                disabled={
                  busy
                }
                onClick={() =>
                  setBilling(
                    detail,
                  )
                }
              >
                Convert to paid charge
              </button>
            </div>

            <div
              style={{
                marginTop: 16,
              }}
            >
              <span className="posho-section-label">
                Checklist
              </span>

              <div
                className="finance-review-actions"
                style={{ marginBottom: 8 }}
              >
                <span className="posho-section-label">
                  Start from template
                </span>

                {[
                  {
                    label: 'Social graphic',
                    items: [
                      'Receive copy',
                      'Receive brand assets',
                      'Design',
                      'Internal review',
                      'Client review',
                      'Export',
                      'Deliver',
                    ],
                  },
                  {
                    label: 'Content update',
                    items: [
                      'Confirm page and section',
                      'Receive new content',
                      'Apply update',
                      'Verify on mobile',
                      'Confirm with client',
                    ],
                  },
                  {
                    label: 'Support triage',
                    items: [
                      'Reproduce the issue',
                      'Identify cause',
                      'Fix or escalate',
                      'Confirm resolution',
                    ],
                  },
                ].map((template) => (
                  <button
                    key={template.label}
                    type="button"
                    className="button button-secondary"
                    onClick={() =>
                      setChecklistEdit(
                        template.items
                          .map(
                            (item) =>
                              `[ ] ${item}`,
                          )
                          .join('\n'),
                      )
                    }
                  >
                    {template.label}
                  </button>
                ))}
              </div>

              <textarea
                value={
                  checklistEdit
                }
                onChange={(
                  event,
                ) =>
                  setChecklistEdit(
                    event
                      .target
                      .value,
                  )
                }
                rows={4}
                placeholder="[ ] Receive copy&#10;[x] Design"
                aria-label="Request checklist, one per line. Prefix done items with [x]."
              />

              <div
                className="finance-review-actions"
                style={{
                  marginTop: 8,
                }}
              >
                <button
                  type="button"
                  className="button button-secondary"
                  disabled={
                    busy
                  }
                  onClick={
                    saveChecklist
                  }
                >
                  Save checklist
                </button>
              </div>
            </div>

            <div
              style={{
                marginTop: 16,
              }}
            >
              <span className="posho-section-label">
                Discussion
              </span>

              <div className="posho-timeline">
                {comments.length ===
                0 ? (
                  <p className="admin-card-description">
                    No comments yet.
                  </p>
                ) : (
                  comments.map(
                    (
                      comment,
                    ) => (
                      <div
                        key={
                          comment.id
                        }
                        className="posho-timeline-item"
                      >
                        <span
                          className="posho-timeline-dot"
                          aria-hidden="true"
                        />

                        <div className="posho-timeline-body">
                          <strong>
                            {comment.author_kind ===
                            'client'
                              ? 'Client'
                              : 'Team'}
                            {comment.internal
                              ? ' · internal'
                              : ''}
                          </strong>

                          <p>
                            {
                              comment.body
                            }
                          </p>

                          <time>
                            {new Date(
                              comment.created_at,
                            ).toLocaleString(
                              'en-NG',
                            )}
                          </time>
                        </div>
                      </div>
                    ),
                  )
                )}
              </div>

              <form
                onSubmit={
                  postComment
                }
                className="posho-form-grid"
                style={{
                  marginTop: 8,
                }}
              >
                <label>
                  <span>
                    Add comment
                  </span>

                  <textarea
                    value={
                      commentBody
                    }
                    onChange={(
                      event,
                    ) =>
                      setCommentBody(
                        event
                          .target
                          .value,
                      )
                    }
                    maxLength={5000}
                  />
                </label>

                <label className="finance-checkbox-row">
                  <input
                    type="checkbox"
                    checked={
                      commentInternal
                    }
                    onChange={(
                      event,
                    ) =>
                      setCommentInternal(
                        event
                          .target
                          .checked,
                      )
                    }
                  />

                  <span>
                    Internal (hidden
                    from client)
                  </span>
                </label>

                <button
                  type="submit"
                  className="button button-secondary"
                  disabled={
                    busy
                  }
                >
                  <Icon name="chat"                     size={15}
                  />
                  Post comment
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {billing && (
        <div
          className="posho-modal-backdrop"
          onClick={() =>
            !busy &&
            setBilling(
              null,
            )
          }
        >
          <form
            role="dialog"
            aria-modal="true"
            aria-label="Bill request"
            className="posho-modal"
            onClick={(
              event,
            ) =>
              event.stopPropagation()
            }
            onSubmit={
              submitBill
            }
          >
            <div className="posho-modal-heading">
              <h3>
                Convert to paid charge
              </h3>

              <button
                type="button"
                onClick={() =>
                  setBilling(
                    null,
                  )
                }
                aria-label="Close billing form"
                disabled={
                  busy
                }
              >
                <Icon name="close"                   size={19}
                />
              </button>
            </div>

            <p className="posho-modal-description">
              Creates a one-off additional
              cost on the linked project.
              Out-of-scope work is never
              silently absorbed.
            </p>

            {!billing.order_id ? (
              <div
                className="posho-error-block"
                role="alert"
              >
                <strong>
                  No linked project
                </strong>

                <p>
                  Link a project before
                  billing this request.
                </p>
              </div>
            ) : (
              <div className="posho-form-grid">
                <label>
                  <span>
                    Amount (₦)
                  </span>

                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={
                      billAmount
                    }
                    onChange={(
                      event,
                    ) =>
                      setBillAmount(
                        event
                          .target
                          .value,
                      )
                    }
                    required
                  />
                </label>

                <label>
                  <span>
                    Note
                  </span>

                  <input
                    value={
                      billNote
                    }
                    onChange={(
                      event,
                    ) =>
                      setBillNote(
                        event
                          .target
                          .value,
                      )
                    }
                    maxLength={2000}
                  />
                </label>
              </div>
            )}

            <div className="posho-modal-actions">
              <button
                type="button"
                className="button button-secondary"
                onClick={() =>
                  setBilling(
                    null,
                  )
                }
                disabled={
                  busy
                }
              >
                Cancel
              </button>

              <button
                type="submit"
                className="button button-primary"
                disabled={
                  busy ||
                  !billing.order_id
                }
                aria-busy={
                  busy
                }
              >
                {busy
                  ? 'Billing…'
                  : 'Create charge'}
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
