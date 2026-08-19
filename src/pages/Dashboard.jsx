import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  ArrowRight,
  CircleDollarSign,
  Clock3,
  FolderKanban,
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
      .then(setOrders)
      .catch(
        console.error,
      )
      .finally(() =>
        setLoading(false),
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
      <BrandLoader label="Opening your workspace..." />
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

  return (
    <div className="workspace-view page-reveal">
      <div className="workspace-view-heading">
        <div>
          <span className="workspace-kicker">
            OVERVIEW
          </span>

          <h2>
            Everything that needs your attention.
          </h2>
        </div>

        <div className="workspace-live-indicator">
          <span />
          Account connected
        </div>
      </div>

      <div className="workspace-stat-grid">
        <article className="workspace-stat-card">
          <FolderKanban
            size={22}
          />

          <span>
            Active projects
          </span>

          <strong>
            {metrics.active}
          </strong>
        </article>

        <article className="workspace-stat-card">
          <Clock3
            size={22}
          />

          <span>
            Action required
          </span>

          <strong>
            {metrics.action}
          </strong>
        </article>

        <article className="workspace-stat-card">
          <CircleDollarSign
            size={22}
          />

          <span>
            Outstanding
          </span>

          <strong className="workspace-money-stat">
            {formatMoney(
              metrics.outstanding,
            )}
          </strong>
        </article>

        <article className="workspace-stat-card">
          <Sparkles
            size={22}
          />

          <span>
            Completed
          </span>

          <strong>
            {metrics.completed}
          </strong>
        </article>
      </div>

      {actionOrders.length >
        0 && (
        <section className="workspace-action-section">
          <span>
            ACTION REQUIRED
          </span>

          <h3>
            Your projects are waiting for you.
          </h3>

          <div className="workspace-action-list">
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
                  <div>
                    <small>
                      {
                        order.reference
                      }
                    </small>

                    <strong>
                      {
                        order.project_title
                      }
                    </strong>

                    <span>
                      {order.customer_action_label ||
                        formatOrderStatus(
                          order.status,
                        )}
                    </span>
                  </div>

                  <ArrowRight
                    size={18}
                  />
                </Link>
              ),
            )}
          </div>
        </section>
      )}

      <section className="workspace-panel">
        <div className="workspace-panel-heading">
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
            className="text-link"
          >
            View all
            <ArrowRight
              size={17}
            />
          </Link>
        </div>

        {orders.length ===
        0 ? (
          <div className="workspace-empty">
            <h3>
              Start your first project.
            </h3>

            <p>
              Your project journey, quote, payment and delivered files will all appear here.
            </p>

            <Link
              to="/order"
              className="button button-primary"
            >
              Start project
            </Link>
          </div>
        ) : (
          <div className="workspace-order-list">
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
                    className="workspace-order-row"
                  >
                    <div>
                      <small>
                        {
                          order.reference
                        }
                      </small>

                      <strong>
                        {
                          order.project_title
                        }
                      </strong>
                    </div>

                    <span className={`workspace-status workspace-status-${order.status}`}>
                      {formatOrderStatus(
                        order.status,
                      )}
                    </span>

                    <span>
                      {formatMoney(
                        order
                          .quoted_amount_kobo,
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
      </section>
    </div>
  );
}