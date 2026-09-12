import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';



import Icon from '../components/ui/Icon';
import Link from '../components/PortalLink';

import BrandLoader from '../components/BrandLoader';
import { ErrorBlock } from '../components/ui/StateBlocks';

import {
  formatMoney,
  formatOrderStatus,
  getMyOrders,
} from '../lib/orders';

import {
  getMyMeetings,
  getMyProposals,
  getMyRequests,
} from '../lib/clientOps';

const quickLinks = [
  {
    to:
      '/dashboard/orders',

    label:
      'Projects',

    description:
      'View every project and its current status.',

    icon: 'folder_special',
  },
  {
    to:
      '/dashboard/payments',

    label:
      'Payments',

    description:
      'Review transactions and payment history.',

    icon: 'receipt',
  },
  {
    to:
      '/dashboard/files',

    label:
      'Files',

    description:
      'Access project references and delivered files.',

    icon: 'article',
  },
  {
    to:
      '/dashboard/requests',

    label:
      'Requests',

    description:
      'Small tasks, updates and support requests.',

    icon: 'assignment',
  },
  {
    to:
      '/dashboard/notifications',

    label:
      'Updates',

    description:
      'See recent project and account updates.',

    icon: 'notifications',
  },
];

function projectServiceName(
  value,
) {
  if (!value) {
    return 'Posho Creative project';
  }

  return value
    .replaceAll(
      '-',
      ' ',
    )
    .replace(
      /\b\w/g,
      (
        character,
      ) =>
        character.toUpperCase(),
    );
}

export default function Dashboard() {
  const [
    orders,
    setOrders,
  ] =
    useState([]);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    loadError,
    setLoadError,
  ] =
    useState('');

  const [
    nowMs,
  ] =
    useState(
      () =>
        Date.now(),
    );

  const [
    extras,
    setExtras] =
    useState({
      requests: [],
      proposals: [],
      meetings: [],
    });

  const load = useCallback(async () => {
    try {
      setLoadError('');
      setLoading(true);
      setOrders(await getMyOrders());

      try {
        const [requests, proposals, meetings] = await Promise.all([
          getMyRequests().catch(() => []),
          getMyProposals().catch(() => []),
          getMyMeetings().catch(() => []),
        ]);

        setExtras({ requests, proposals, meetings });
      } catch {
        setExtras({ requests: [], proposals: [], meetings: [] });
      }
    } catch {
      setLoadError('Your workspace could not be loaded. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    document.title =
      'Client Workspace | Posho Creative';

    load();
  }, [load]);

  const metrics =
    useMemo(() => {
      const active =
        orders.filter(
          (
            order,
          ) =>
            ![
              'completed',
              'cancelled',
            ].includes(
              order.status,
            ),
        ).length;

      const action =
        orders.filter(
          (
            order,
          ) =>
            order
              .customer_action_required,
        ).length;

      const completed =
        orders.filter(
          (
            order,
          ) =>
            order.status ===
            'completed',
        ).length;

      const outstanding =
        orders.reduce(
          (
            total,
            order,
          ) =>
            total +
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
            ),
          0,
        );

      return {
        active,
        action,
        completed,
        outstanding,
      };
    }, [
      orders,
    ]);

  if (loading) {
    return (
      <BrandLoader
        label="Opening your workspace..."
      />
    );
  }

  if (loadError) {
    return (
      <div className="workspace-view">
        <ErrorBlock message={loadError} onRetry={load} />
      </div>
    );
  }

  const actionOrders =
    orders.filter(
      (
        order,
      ) =>
        order
          .customer_action_required,
    );

  const awaitingReview = [
    ...extras.proposals
      .filter((proposal) =>
        ['sent', 'viewed'].includes(proposal.status),
      )
      .map((proposal) => ({
        id: `proposal-${proposal.id}`,
        to: `/dashboard/proposals/${proposal.id}`,
        reference: proposal.number,
        title: proposal.title,
        label: 'Proposal awaiting decision',
      })),
    ...extras.requests
      .filter(
        (request) =>
          request.status === 'waiting_on_client',
      )
      .map((request) => ({
        id: `request-${request.id}`,
        to: '/dashboard/requests',
        reference: request.reference,
        title: request.title,
        label: 'Request needs your input',
      })),
  ];

  const upcomingMeetings = extras.meetings
    .filter(
      (meeting) =>
        meeting.status === 'scheduled' &&
        new Date(meeting.scheduled_at).getTime() >= nowMs,
    )
    .slice(0, 3);

  const nextPayment = orders
    .map((order) => ({
      order,
      outstanding: Math.max(
        Number(order.quoted_amount_kobo || 0) -
          Number(order.paid_amount_kobo || 0),
        0,
      ),
    }))
    .filter(
      (row) =>
        row.outstanding > 0 &&
        row.order.review_decision === 'approved' &&
        !['completed', 'cancelled'].includes(row.order.status),
    )
    .sort((a, b) => {
      const dateA = a.order.deadline || '9999';
      const dateB = b.order.deadline || '9999';

      return dateA < dateB ? -1 : 1;
    })[0];

  const metricCards = [
    {
      label:
        'Active projects',

      value:
        metrics.active,

      detail:
        'Currently open',

      icon: 'folder_special',

      className:
        'projects',
    },
    {
      label:
        'Action required',

      value:
        metrics.action,

      detail:
        metrics.action === 1
          ? 'Needs your response'
          : 'Items need your response',

      icon: 'schedule',

      className:
        'attention',
    },
    {
      label:
        'Outstanding',

      value:
        formatMoney(
          metrics.outstanding,
        ),

      detail:
        'Across your projects',

      icon: 'monetization_on',

      className:
        'money',
    },
    {
      label:
        'Completed',

      value:
        metrics.completed,

      detail:
        'Delivered projects',

      icon: 'auto_awesome',

      className:
        'completed',
    },
  ];

  return (
    <div className="workspace-view workspace-dashboard-v3 page-reveal">
      <div className="workspace-view-heading workspace-view-heading-v3">
        <div>
          <span className="workspace-kicker">
            OVERVIEW
          </span>

          <h2>
            Your workspace at a glance.
          </h2>

          <p>
            Stay on top of active work, payments and anything that needs your attention.
          </p>
        </div>

        <div className="workspace-overview-state">
          <span />

          Account active
        </div>
      </div>

      <div className="workspace-stat-grid workspace-stat-grid-v3">
        {metricCards.map(
          (
            metric,
          ) => {
            const iconName = metric.icon;

            return (
              <article
                key={
                  metric.label
                }
                className={`workspace-stat-card workspace-stat-card-v3 workspace-stat-${metric.className}`}
              >
                <div className="workspace-stat-icon">
                  <Icon name={iconName} size={19}
                  />
                </div>

                <div className="workspace-stat-copy">
                  <span>
                    {metric.label}
                  </span>

                  <strong
                    className={
                      metric.className ===
                      'money'
                        ? 'workspace-money-stat'
                        : ''
                    }
                  >
                    {metric.value}
                  </strong>

                  <small>
                    {metric.detail}
                  </small>
                </div>
              </article>
            );
          },
        )}
      </div>

      {awaitingReview.length > 0 && (
        <section className="workspace-priority-section">
          <div className="workspace-priority-heading">
            <div>
              <span>
                AWAITING REVIEW
              </span>

              <h3>
                Decisions waiting on you.
              </h3>

              <p>
                Proposals and requests that need your answer.
              </p>
            </div>

            <div className="workspace-priority-count">
              {awaitingReview.length}
            </div>
          </div>

          <div className="workspace-priority-list">
            {awaitingReview.map((item) => (
              <Link key={item.id} to={item.to}>
                <div className="workspace-priority-project">
                  <small>
                    {item.reference}
                  </small>

                  <strong>
                    {item.title}
                  </strong>

                  <span>
                    {item.label}
                  </span>
                </div>

                <div className="workspace-priority-arrow">
                  <Icon name="arrow_forward" size={17} />
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {(nextPayment || upcomingMeetings.length > 0) && (
        <section className="workspace-panel">
          <div className="workspace-panel-heading">
            <div>
              <span>UP NEXT</span>

              <h3>What is coming</h3>
            </div>
          </div>

          {nextPayment && (
            <div className="workspace-priority-list">
              <Link
                to={`/dashboard/orders/${nextPayment.order.reference}/pay`}
              >
                <div className="workspace-priority-project">
                  <small>
                    NEXT PAYMENT
                  </small>

                  <strong>
                    {formatMoney(nextPayment.outstanding)}
                  </strong>

                  <span>
                    {nextPayment.order.project_title}
                    {nextPayment.order.deadline
                      ? ` · Due ${nextPayment.order.deadline}`
                      : ''}
                  </span>
                </div>

                <div className="workspace-priority-arrow">
                  <Icon name="arrow_forward" size={17} />
                </div>
              </Link>
            </div>
          )}

          {upcomingMeetings.map((meeting) => (
            <p key={meeting.id} style={{ fontSize: 13 }}>
              Meeting ({String(meeting.kind || '').replaceAll('_', ' ')}) ·{' '}
              {new Date(meeting.scheduled_at).toLocaleString('en-NG')}
            </p>
          ))}
        </section>
      )}

      {actionOrders.length === 0 &&
        awaitingReview.length === 0 &&
        !nextPayment && (
          <section className="workspace-panel workspace-caught-up">
            <p>
              <strong>You are all caught up.</strong>
            </p>

            <p style={{ fontSize: 13, color: '#5f5878' }}>
              Nothing needs your attention right now.
            </p>
          </section>
        )}

      {actionOrders.length >
        0 && (
        <section className="workspace-priority-section">
          <div className="workspace-priority-heading">
            <div>
              <span>
                ACTION REQUIRED
              </span>

              <h3>
                Your attention is needed.
              </h3>

              <p>
                Complete the next step below to keep your project moving.
              </p>
            </div>

            <div className="workspace-priority-count">
              {actionOrders.length}
            </div>
          </div>

          <div className="workspace-priority-list">
            {actionOrders.map(
              (
                order,
              ) => (
                <Link
                  key={
                    order.id
                  }
                  to={`/dashboard/orders/${order.reference}`}
                >
                  <div className="workspace-priority-project">
                    <small>
                      {order.reference}
                    </small>

                    <strong>
                      {order.project_title}
                    </strong>

                    <span>
                      {order.customer_action_label ||
                        formatOrderStatus(
                          order.status,
                        )}
                    </span>
                  </div>

                  <div className="workspace-priority-arrow">
                    <Icon name="arrow_forward" 
                      size={17}
                    />
                  </div>
                </Link>
              ),
            )}
          </div>
        </section>
      )}

      <div className="workspace-overview-grid">
        <section className="workspace-panel workspace-recent-projects-panel">
          <div className="workspace-panel-heading workspace-panel-heading-v3">
            <div>
              <span>
                RECENT PROJECTS
              </span>

              <h3>
                Project activity
              </h3>
            </div>

            <Link
              to="/dashboard/orders"
              className="workspace-panel-link"
            >
              View all

              <Icon name="arrow_forward" 
                size={15}
              />
            </Link>
          </div>

          {orders.length ===
          0 ? (
            <div className="workspace-empty workspace-dashboard-empty">
              <div className="workspace-empty-icon">
                <Icon name="folder_special"
                  size={20}
                />
              </div>

              <h3>
                Start your first project.
              </h3>

              <p>
                Your project journey, quotation, payment and delivered files will appear here.
              </p>

              <Link
                to="/order"
                className="button button-primary"
              >
                <Icon name="add" 
                  size={17}
                />

                New project
              </Link>
            </div>
          ) : (
            <div className="workspace-project-list-v3">
              {orders
                .slice(
                  0,
                  6,
                )
                .map(
                  (
                    order,
                  ) => (
                    <Link
                      key={
                        order.id
                      }
                      to={`/dashboard/orders/${order.reference}`}
                      className="workspace-project-row-v3"
                    >
                      <div className="workspace-project-main-v3">
                        <small>
                          {order.reference}
                        </small>

                        <strong>
                          {order.project_title}
                        </strong>

                        <span>
                          {projectServiceName(
                            order.service_slug,
                          )}
                        </span>
                      </div>

                      <div className="workspace-project-value-v3">
                        <span>
                          Project value
                        </span>

                        <strong>
                          {formatMoney(
                            order
                              .quoted_amount_kobo,
                          )}
                        </strong>
                      </div>

                      <span
                        className={`workspace-status workspace-status-${order.status}`}
                      >
                        {formatOrderStatus(
                          order.status,
                        )}
                      </span>

                      <div className="workspace-project-arrow-v3">
                        <Icon name="arrow_forward" 
                          size={17}
                        />
                      </div>
                    </Link>
                  ),
                )}
            </div>
          )}
        </section>

        <aside className="workspace-quick-panel">
          <div className="workspace-quick-panel-heading">
            <span>
              QUICK ACCESS
            </span>

            <h3>
              Everything in one place.
            </h3>

            <p>
              Jump straight to the part of your workspace you need.
            </p>
          </div>

          <div className="workspace-quick-links">
            {quickLinks.map(
              (
                item,
              ) => {
                const iconName = item.icon;

                return (
                  <Link
                    key={
                      item.to
                    }
                    to={
                      item.to
                    }
                  >
                    <div className="workspace-quick-link-icon">
                      <Icon name={iconName} size={17}
                      />
                    </div>

                    <div>
                      <strong>
                        {item.label}
                      </strong>

                      <span>
                        {item.description}
                      </span>
                    </div>

                    <Icon name="arrow_forward" 
                      size={15}
                    />
                  </Link>
                );
              },
            )}
          </div>

          <Link
            to="/order"
            className="workspace-quick-new-project"
          >
            <Icon name="add" 
              size={17}
            />

            <div>
              <strong>
                Start a new project
              </strong>

              <span>
                Send Posho Creative a new request.
              </span>
            </div>
          </Link>
        </aside>
      </div>
    </div>
  );
}
