import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  ArrowRight,
  Search,
} from 'lucide-react';

import {
  Link,
} from 'react-router-dom';

import BrandLoader from '../components/BrandLoader';

import {
  formatOrderStatus,
  formatProjectState,
  getMyOrders,
} from '../lib/orders';

function formatDate(
  value,
) {
  return new Intl.DateTimeFormat(
    'en-NG',
    {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    },
  ).format(
    new Date(value),
  );
}

const filters = [
  {
    id: 'all',
    label: 'All',
  },
  {
    id: 'review',
    label: 'In review',
  },
  {
    id: 'active',
    label: 'Active',
  },
  {
    id: 'awaiting',
    label: 'Action required',
  },
  {
    id: 'completed',
    label: 'Completed',
  },
  {
    id: 'declined',
    label: 'Declined',
  },
];

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
    useState(
      'all',
    );

  const [
    error,
    setError,
  ] =
    useState('');

  useEffect(() => {
    document.title =
      'My Projects | Posho Creative';

    const load =
      async () => {
        try {
          setOrders(
            await getMyOrders(),
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

  const visibleOrders =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      return orders.filter(
        (order) => {
          const matchesSearch =
            !query ||
            order.reference
              .toLowerCase()
              .includes(
                query,
              ) ||
            order.project_title
              .toLowerCase()
              .includes(
                query,
              ) ||
            order.service_slug
              .toLowerCase()
              .includes(
                query,
              );

          let matchesFilter =
            true;

          if (
            filter ===
            'review'
          ) {
            matchesFilter =
              order
                .review_decision ===
              'pending';
          }

          if (
            filter ===
            'active'
          ) {
            matchesFilter =
              order
                .review_decision ===
                'approved' &&
              ![
                'completed',
                'cancelled',
              ].includes(
                order.status,
              );
          }

          if (
            filter ===
            'awaiting'
          ) {
            matchesFilter =
              order
                .review_decision ===
                'approved' &&
              order
                .customer_action_required;
          }

          if (
            filter ===
            'completed'
          ) {
            matchesFilter =
              order.status ===
                'completed' &&
              order
                .review_decision ===
                'approved';
          }

          if (
            filter ===
            'declined'
          ) {
            matchesFilter =
              order
                .review_decision ===
              'declined';
          }

          return (
            matchesSearch &&
            matchesFilter
          );
        },
      );
    }, [
      orders,
      search,
      filter,
    ]);

  if (loading) {
    return (
      <BrandLoader
        label="Loading your projects..."
      />
    );
  }

  return (
    <div className="workspace-view page-reveal">
      <div className="workspace-view-heading">
        <div>
          <span className="workspace-kicker">
            PROJECTS
          </span>

          <h2>
            Your work with Posho Creative.
          </h2>
        </div>

        <span className="workspace-count-pill">
          {orders.length}
          {' '}
          {orders.length ===
          1
            ? 'project'
            : 'projects'}
        </span>
      </div>

      <div className="workspace-toolbar">
        <div className="workspace-search">
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
            placeholder="Search project or reference..."
          />
        </div>

        <div className="workspace-filter-tabs">
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
      </div>

      {error && (
        <div className="workspace-alert">
          {error}
        </div>
      )}

      <section className="workspace-orders-table">
        <div className="workspace-orders-table-head">
          <span>
            Project
          </span>

          <span>
            Status
          </span>

          <span>
            Payment
          </span>

          <span>
            Created
          </span>

          <span />
        </div>

        {visibleOrders.length ===
        0 ? (
          <div className="workspace-empty workspace-empty-compact">
            <h3>
              No matching projects.
            </h3>

            <p>
              Try another search or filter.
            </p>
          </div>
        ) : (
          visibleOrders.map(
            (
              order,
              index,
            ) => (
              <Link
                key={
                  order.id
                }
                to={`/dashboard/orders/${order.reference}`}
                className="workspace-orders-table-row stagger-item"
                style={{
                  '--stagger-index':
                    index,
                }}
              >
                <div>
                  <small>
                    {order.reference}
                  </small>

                  <strong>
                    {order.project_title}
                  </strong>

                  <span>
                    {order.service_slug
                      .replaceAll(
                        '-',
                        ' ',
                      )}
                  </span>
                </div>

                <span
                  className={`workspace-status project-review-status ${order.review_decision}`}
                >
                  {formatProjectState(
                    order,
                  )}
                </span>

                <span
                  className={`workspace-status workspace-payment-${order.payment_status}`}
                >
                  {order
                    .review_decision ===
                  'declined'
                    ? 'Not applicable'
                    : formatOrderStatus(
                        order.payment_status,
                      )}
                </span>

                <time>
                  {formatDate(
                    order.created_at,
                  )}
                </time>

                <ArrowRight
                  size={18}
                />
              </Link>
            ),
          )
        )}
      </section>
    </div>
  );
}