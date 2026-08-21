import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  FolderKanban,
  Plus,
  Search,
  SlidersHorizontal,
} from 'lucide-react';

import {
  Link,
} from 'react-router-dom';

import BrandLoader from '../components/BrandLoader';

import {
  formatMoney,
  formatOrderStatus,
} from '../lib/orders';

import {
  getProjectBalance,
  getProjectDirectory,
  getProjectDirectoryState,
  getProjectProgressPercent,
  projectMatchesFilter,
  sortProjects,
} from '../lib/projectDirectory';

const filters = [
  {
    id:
      'all',

    label:
      'All',
  },
  {
    id:
      'review',

    label:
      'In review',
  },
  {
    id:
      'active',

    label:
      'Active',
  },
  {
    id:
      'attention',

    label:
      'Needs you',
  },
  {
    id:
      'completed',

    label:
      'Completed',
  },
  {
    id:
      'declined',

    label:
      'Declined',
  },
];

function formatDate(
  value,
) {
  if (!value) {
    return 'Not specified';
  }

  return new Intl.DateTimeFormat(
    'en-NG',
    {
      day:
        'numeric',

      month:
        'short',

      year:
        'numeric',
    },
  ).format(
    new Date(value),
  );
}

function serviceName(
  value,
) {
  if (!value) {
    return 'Creative project';
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

function PaymentState({
  status,
  reviewDecision,
}) {
  if (
    reviewDecision ===
    'declined'
  ) {
    return (
      <span className="project-directory-payment neutral">
        Not applicable
      </span>
    );
  }

  const successful =
    status ===
      'successful' ||
    status ===
      'paid';

  return (
    <span
      className={`project-directory-payment ${
        successful
          ? 'successful'
          : 'pending'
      }`}
    >
      {successful
        ? 'Confirmed'
        : formatOrderStatus(
            status ||
              'pending',
          )}
    </span>
  );
}

export default function DashboardOrders() {
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
    search,
    setSearch,
  ] =
    useState('');

  const [
    filter,
    setFilter,
  ] =
    useState('all');

  const [
    sort,
    setSort,
  ] =
    useState('newest');

  const [
    error,
    setError,
  ] =
    useState('');

  useEffect(() => {
    document.title =
      'Projects | Posho Creative';

    const load =
      async () => {
        try {
          setError('');

          const rows =
            await getProjectDirectory();

          setOrders(
            rows,
          );
        } catch (
          loadError
        ) {
          console.error(
            loadError,
          );

          setError(
            'Your projects could not be loaded.',
          );
        } finally {
          setLoading(
            false,
          );
        }
      };

    load();
  }, []);

  const metrics =
    useMemo(
      () => ({
        total:
          orders.length,

        active:
          orders.filter(
            (
              order,
            ) =>
              order
                .review_decision ===
                'approved' &&
              ![
                'completed',
                'cancelled',
              ].includes(
                order.status,
              ),
          ).length,

        attention:
          orders.filter(
            (
              order,
            ) =>
              order
                .customer_action_required &&
              order
                .review_decision ===
                'approved',
          ).length,

        completed:
          orders.filter(
            (
              order,
            ) =>
              order.status ===
              'completed',
          ).length,
      }),
      [
        orders,
      ],
    );

  const visibleOrders =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      const filtered =
        orders.filter(
          (
            order,
          ) => {
            const searchable =
              [
                order.reference,
                order.project_title,
                order.service_slug,
                order.project_type,
                order.progress_label,
                order
                  .customer_action_label,
              ]
                .filter(
                  Boolean,
                )
                .join(' ')
                .toLowerCase();

            const matchesSearch =
              !query ||
              searchable.includes(
                query,
              );

            return (
              matchesSearch &&
              projectMatchesFilter(
                order,
                filter,
              )
            );
          },
        );

      return sortProjects(
        filtered,
        sort,
      );
    }, [
      orders,
      search,
      filter,
      sort,
    ]);

  if (loading) {
    return (
      <BrandLoader
        label="Loading your projects..."
      />
    );
  }

  const metricCards = [
    {
      label:
        'Total projects',

      value:
        metrics.total,

      icon:
        FolderKanban,
    },
    {
      label:
        'Active',

      value:
        metrics.active,

      icon:
        Clock3,
    },
    {
      label:
        'Needs you',

      value:
        metrics.attention,

      icon:
        AlertCircle,
    },
    {
      label:
        'Completed',

      value:
        metrics.completed,

      icon:
        CheckCircle2,
    },
  ];

  return (
    <div className="workspace-view project-directory page-reveal">
      <div className="workspace-view-heading workspace-view-heading-v3 project-directory-heading">
        <div>
          <span className="workspace-kicker">
            PROJECTS
          </span>

          <h2>
            Your projects, clearly organised.
          </h2>

          <p>
            Follow progress, payments, deadlines and everything that needs your attention.
          </p>
        </div>

        <Link
          to="/order"
          className="button button-primary project-directory-new"
        >
          <Plus
            size={17}
          />

          New project
        </Link>
      </div>

      <div className="project-directory-metrics">
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
              >
                <div>
                  <Icon
                    size={17}
                  />
                </div>

                <span>
                  {metric.label}
                </span>

                <strong>
                  {metric.value}
                </strong>
              </article>
            );
          },
        )}
      </div>

      <section className="project-directory-controls">
        <div className="project-directory-search">
          <Search
            size={17}
          />

          <input
            type="search"
            value={
              search
            }
            onChange={(
              event,
            ) =>
              setSearch(
                event
                  .target
                  .value,
              )
            }
            placeholder="Search project, reference or milestone..."
          />
        </div>

        <label className="project-directory-sort">
          <SlidersHorizontal
            size={15}
          />

          <select
            value={
              sort
            }
            onChange={(
              event,
            ) =>
              setSort(
                event
                  .target
                  .value,
              )
            }
          >
            <option value="newest">
              Newest first
            </option>

            <option value="oldest">
              Oldest first
            </option>

            <option value="deadline">
              Deadline
            </option>

            <option value="progress">
              Progress
            </option>
          </select>
        </label>
      </section>

      <div className="project-directory-filters">
        {filters.map(
          (
            item,
          ) => (
            <button
              key={
                item.id
              }
              type="button"
              className={
                filter ===
                item.id
                  ? 'active'
                  : ''
              }
              onClick={() =>
                setFilter(
                  item.id,
                )
              }
            >
              {item.label}
            </button>
          ),
        )}
      </div>

      {error && (
        <div className="workspace-alert">
          {error}
        </div>
      )}

      {visibleOrders.length ===
      0 ? (
        <section className="workspace-panel project-directory-empty">
          <FolderKanban
            size={26}
          />

          <h3>
            No projects match this view.
          </h3>

          <p>
            Try another search or filter, or start a new project.
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
        </section>
      ) : (
        <div className="project-directory-list">
          {visibleOrders.map(
            (
              order,
              index,
            ) => {
              const state =
                getProjectDirectoryState(
                  order,
                );

              const progress =
                getProjectProgressPercent(
                  order,
                );

              const balance =
                getProjectBalance(
                  order,
                );

              return (
                <article
                  key={
                    order.id
                  }
                  className={`project-directory-card project-directory-card-${state.key} stagger-item`}
                  style={{
                    '--stagger-index':
                      index,
                  }}
                >
                  <div className="project-directory-card-header">
                    <div className="project-directory-card-identity">
                      <small>
                        {order.reference}
                      </small>

                      <h3>
                        {order.project_title}
                      </h3>

                      <p>
                        {serviceName(
                          order.service_slug,
                        )}
                      </p>
                    </div>

                    <span
                      className={`project-directory-state project-directory-state-${state.key}`}
                    >
                      {state.label}
                    </span>
                  </div>

                  {order
                    .review_decision ===
                    'approved' &&
                    order.status !==
                      'cancelled' && (
                    <div className="project-directory-progress">
                      <div className="project-directory-progress-heading">
                        <div>
                          <span>
                            CURRENT MILESTONE
                          </span>

                          <strong>
                            {order.progress_label ||
                              'Awaiting project start'}
                          </strong>
                        </div>

                        <strong>
                          {progress}%
                        </strong>
                      </div>

                      <div
                        className="project-directory-progress-track"
                        role="progressbar"
                        aria-valuemin="0"
                        aria-valuemax="100"
                        aria-valuenow={
                          progress
                        }
                      >
                        <div
                          style={{
                            width:
                              `${progress}%`,
                          }}
                        />
                      </div>

                      {order.progress_message && (
                        <p>
                          {order.progress_message}
                        </p>
                      )}
                    </div>
                  )}

                  {order.customer_action_required &&
                    order.review_decision ===
                      'approved' && (
                    <div className="project-directory-action">
                      <AlertCircle
                        size={16}
                      />

                      <div>
                        <span>
                          YOUR ATTENTION IS NEEDED
                        </span>

                        <strong>
                          {order.customer_action_label ||
                            'Please review this project.'}
                        </strong>
                      </div>
                    </div>
                  )}

                  {order.review_decision ===
                    'declined' &&
                    order.decline_reason && (
                    <div className="project-directory-decline">
                      <span>
                        PROJECT DECISION
                      </span>

                      <p>
                        {order.decline_reason}
                      </p>
                    </div>
                  )}

                  <div className="project-directory-finance">
                    <div>
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

                    <div>
                      <span>
                        Paid
                      </span>

                      <strong>
                        {formatMoney(
                          order
                            .paid_amount_kobo,
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Balance
                      </span>

                      <strong>
                        {formatMoney(
                          balance,
                        )}
                      </strong>
                    </div>
                  </div>

                  <div className="project-directory-meta">
                    <div>
                      <CalendarDays
                        size={15}
                      />

                      <div>
                        <span>
                          Deadline
                        </span>

                        <strong>
                          {formatDate(
                            order.deadline,
                          )}
                        </strong>
                      </div>
                    </div>

                    <div>
                      <CircleDollarSign
                        size={15}
                      />

                      <div>
                        <span>
                          Payment
                        </span>

                        <PaymentState
                          status={
                            order.payment_status
                          }
                          reviewDecision={
                            order.review_decision
                          }
                        />
                      </div>
                    </div>

                    <div>
                      <Clock3
                        size={15}
                      />

                      <div>
                        <span>
                          Submitted
                        </span>

                        <strong>
                          {formatDate(
                            order.submitted_at ||
                              order.created_at,
                          )}
                        </strong>
                      </div>
                    </div>
                  </div>

                  <div className="project-directory-card-footer">
                    <span>
                      {order.progress_updated_at
                        ? `Progress updated ${formatDate(
                            order.progress_updated_at,
                          )}`
                        : 'Project information is up to date.'}
                    </span>

                    <Link
                      to={`/dashboard/orders/${order.reference}`}
                    >
                      Open project

                      <ArrowRight
                        size={16}
                      />
                    </Link>
                  </div>
                </article>
              );
            },
          )}
        </div>
      )}
    </div>
  );
}