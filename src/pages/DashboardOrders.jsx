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
  getMyOrders,
} from '../lib/orders';

function formatDate(value) {
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
  'all',
  'active',
  'awaiting',
  'completed',
];

export default function DashboardOrders() {
  const [orders, setOrders] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [search, setSearch] =
    useState('');

  const [filter, setFilter] =
    useState('all');

  const [error, setError] =
    useState('');

  useEffect(() => {
    document.title =
      'My Orders | Posho Creative';

    const load = async () => {
      try {
        setOrders(
          await getMyOrders(),
        );
      } catch (loadError) {
        console.error(
          loadError,
        );

        setError(
          'We could not load your orders.',
        );
      } finally {
        setLoading(false);
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
              .includes(query) ||
            order.project_title
              .toLowerCase()
              .includes(query) ||
            order.service_slug
              .toLowerCase()
              .includes(query);

          let matchesFilter =
            true;

          if (
            filter === 'active'
          ) {
            matchesFilter =
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
              [
                'quote_sent',
                'awaiting_payment',
                'awaiting_client',
              ].includes(
                order.status,
              );
          }

          if (
            filter ===
            'completed'
          ) {
            matchesFilter =
              order.status ===
              'completed';
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
      <div className="workspace-loading-panel page-reveal">
        <BrandLoader label="Loading your orders..." />
      </div>
    );
  }

  return (
    <div className="workspace-view page-reveal">
      <div className="workspace-view-heading">
        <div>
          <span className="workspace-kicker">
            MY ORDERS
          </span>

          <h2>
            Every project, one place.
          </h2>
        </div>

        <span className="workspace-count-pill">
          {orders.length}{' '}
          {orders.length === 1
            ? 'project'
            : 'projects'}
        </span>
      </div>

      <div className="workspace-toolbar">
        <div className="workspace-search">
          <Search size={17} />

          <input
            type="search"
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value,
              )
            }
            placeholder="Search reference, project or service..."
          />
        </div>

        <div className="workspace-filter-tabs">
          {filters.map(
            (item) => (
              <button
                type="button"
                key={item}
                className={
                  filter === item
                    ? 'active'
                    : ''
                }
                onClick={() =>
                  setFilter(item)
                }
              >
                {item === 'all'
                  ? 'All'
                  : item ===
                      'awaiting'
                    ? 'Awaiting action'
                    : item
                        .charAt(0)
                        .toUpperCase() +
                      item.slice(1)}
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
          <span>Project</span>
          <span>Status</span>
          <span>Payment</span>
          <span>Created</span>
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
                key={order.id}
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
                  className={`workspace-status workspace-status-${order.status}`}
                >
                  {formatOrderStatus(
                    order.status,
                  )}
                </span>

                <span
                  className={`workspace-status workspace-payment-${order.payment_status}`}
                >
                  {formatOrderStatus(
                    order.payment_status,
                  )}
                </span>

                <time>
                  {formatDate(
                    order.created_at,
                  )}
                </time>

                <ArrowRight size={18} />
              </Link>
            ),
          )
        )}
      </section>
    </div>
  );
}