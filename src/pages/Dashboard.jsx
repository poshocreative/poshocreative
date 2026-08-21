import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  ArrowRight,
  Bell,
  CircleDollarSign,
  Clock3,
  FileText,
  FolderKanban,
  Plus,
  ReceiptText,
  Sparkles,
} from 'lucide-react';

import {
  Link,
} from 'react-router-dom';

import BrandLoader from '../components/BrandLoader';

import {
  formatMoney,
  formatOrderStatus,
  getMyOrders,
} from '../lib/orders';

const quickLinks = [
  {
    to:
      '/dashboard/orders',

    label:
      'Projects',

    description:
      'View every project and its current status.',

    icon:
      FolderKanban,
  },
  {
    to:
      '/dashboard/payments',

    label:
      'Payments',

    description:
      'Review transactions and payment history.',

    icon:
      ReceiptText,
  },
  {
    to:
      '/dashboard/files',

    label:
      'Files',

    description:
      'Access project references and delivered files.',

    icon:
      FileText,
  },
  {
    to:
      '/dashboard/notifications',

    label:
      'Updates',

    description:
      'See recent project and account updates.',

    icon:
      Bell,
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

  useEffect(() => {
    document.title =
      'Client Workspace | Posho Creative';

    getMyOrders()
      .then(
        setOrders,
      )
      .catch(
        console.error,
      )
      .finally(() =>
        setLoading(
          false,
        ),
      );
  }, []);

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

  const actionOrders =
    orders.filter(
      (
        order,
      ) =>
        order
          .customer_action_required,
    );

  const metricCards = [
    {
      label:
        'Active projects',

      value:
        metrics.active,

      detail:
        'Currently open',

      icon:
        FolderKanban,

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

      icon:
        Clock3,

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

      icon:
        CircleDollarSign,

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

      icon:
        Sparkles,

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
            const Icon =
              metric.icon;

            return (
              <article
                key={
                  metric.label
                }
                className={`workspace-stat-card workspace-stat-card-v3 workspace-stat-${metric.className}`}
              >
                <div className="workspace-stat-icon">
                  <Icon
                    size={19}
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
                    <ArrowRight
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

              <ArrowRight
                size={15}
              />
            </Link>
          </div>

          {orders.length ===
          0 ? (
            <div className="workspace-empty workspace-dashboard-empty">
              <div className="workspace-empty-icon">
                <FolderKanban
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
                <Plus
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
                        <ArrowRight
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
                const Icon =
                  item.icon;

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
                      <Icon
                        size={17}
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

                    <ArrowRight
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
            <Plus
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