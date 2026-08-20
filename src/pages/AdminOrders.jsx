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
  getAdminOrders,
} from '../lib/admin';

import {
  formatMoney,
  formatOrderStatus,
} from '../lib/orders';

const filters = [
  {
    id: 'all',
    label: 'All',
  },
  {
    id: 'pending',
    label: 'Awaiting review',
  },
  {
    id: 'approved',
    label: 'Approved',
  },
  {
    id: 'declined',
    label: 'Declined',
  },
];

function displayStatus(
  order,
) {
  if (
    order
      .review_decision ===
    'pending'
  ) {
    return 'Awaiting Review';
  }

  if (
    order
      .review_decision ===
    'declined'
  ) {
    return 'Declined';
  }

  return formatOrderStatus(
    order.status,
  );
}

export default function AdminOrders() {
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
      'Orders | Posho Creative Management';

    const load =
      async () => {
        try {
          setOrders(
            await getAdminOrders(),
          );
        } catch (
          loadError
        ) {
          console.error(
            loadError,
          );

          setError(
            'Project requests could not be loaded.',
          );
        } finally {
          setLoading(
            false,
          );
        }
      };

    load();
  }, []);

  const visible =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      return orders.filter(
        (order) => {
          const customer =
            order
              .customers
              ?.full_name ||
            '';

          const email =
            order
              .customers
              ?.email ||
            '';

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
            customer
              .toLowerCase()
              .includes(
                query,
              ) ||
            email
              .toLowerCase()
              .includes(
                query,
              );

          const matchesFilter =
            filter ===
              'all' ||
            order
              .review_decision ===
              filter;

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
        label="Loading project requests..."
      />
    );
  }

  return (
    <div className="admin-view page-reveal">
      <div className="admin-view-heading">
        <div>
          <span>
            PROJECT REQUESTS
          </span>

          <h1>
            Orders.
          </h1>

          <p>
            Review every request before it enters payment and production.
          </p>
        </div>

        <strong className="admin-total-count">
          {orders.length}
          {' '}
          total
        </strong>
      </div>

      <div className="admin-orders-toolbar">
        <div className="admin-search">
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
            placeholder="Search reference, project, customer or email..."
          />
        </div>

        <div className="admin-filter-tabs">
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
        <div className="admin-error">
          {error}
        </div>
      )}

      {visible.length ===
      0 ? (
        <div className="admin-clean-state admin-orders-empty">
          <strong>
            No matching project requests
          </strong>

          <span>
            Change the search or review filter.
          </span>
        </div>
      ) : (
        <div className="admin-orders-directory">
          {visible.map(
            (
              order,
            ) => (
              <Link
                key={
                  order.id
                }
                to={`/admin/orders/${order.reference}`}
                className="admin-order-directory-card"
              >
                <div className="admin-order-directory-main">
                  <div className="admin-order-directory-reference">
                    {order.reference}
                  </div>

                  <h3>
                    {order.project_title}
                  </h3>

                  <p>
                    {order
                      .customers
                      ?.full_name ||
                      order
                        .customers
                        ?.email}
                  </p>

                  <div className="admin-order-directory-meta">
                    <span>
                      {order.service_slug
                        .replaceAll(
                          '-',
                          ' ',
                        )}
                    </span>

                    <span>
                      {order.project_type
                        .replaceAll(
                          '-',
                          ' ',
                        )}
                    </span>
                  </div>
                </div>

                <div className="admin-order-directory-finance">
                  <span>
                    Quote
                  </span>

                  <strong>
                    {formatMoney(
                      order
                        .quoted_amount_kobo,
                    )}
                  </strong>
                </div>

                <span
                  className={`admin-decision-pill ${order.review_decision}`}
                >
                  {displayStatus(
                    order,
                  )}
                </span>

                <ArrowRight
                  size={18}
                />
              </Link>
            ),
          )}
        </div>
      )}
    </div>
  );
}