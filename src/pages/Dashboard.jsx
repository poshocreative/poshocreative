import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  FolderKanban,
  ReceiptText,
  Sparkles,
} from 'lucide-react';

import {
  Link,
} from 'react-router-dom';

import BrandLoader from '../components/BrandLoader';

import {
  getMyOrders,
  formatOrderStatus,
} from '../lib/orders';

function formatDate(value) {
  if (!value) {
    return '';
  }

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

export default function Dashboard() {
  const [orders, setOrders] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState('');

  useEffect(() => {
    document.title =
      'Customer Workspace | Posho Creative';

    const load = async () => {
      try {
        setLoading(true);

        const data =
          await getMyOrders();

        setOrders(data);
      } catch (loadError) {
        console.error(
          loadError,
        );

        setError(
          'We could not load your projects.',
        );
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const stats =
    useMemo(() => {
      const active =
        orders.filter(
          (order) =>
            ![
              'completed',
              'cancelled',
            ].includes(
              order.status,
            ),
        ).length;

      const awaiting =
        orders.filter(
          (order) =>
            [
              'quote_sent',
              'awaiting_payment',
              'awaiting_client',
            ].includes(
              order.status,
            ),
        ).length;

      const completed =
        orders.filter(
          (order) =>
            order.status ===
            'completed',
        ).length;

      return {
        active,
        awaiting,
        completed,
        total:
          orders.length,
      };
    }, [orders]);

  if (loading) {
    return (
      <div className="workspace-loading-panel page-reveal">
        <BrandLoader label="Loading your projects..." />
      </div>
    );
  }

  return (
    <div className="workspace-view page-reveal">
      <div className="workspace-view-heading">
        <div>
          <span className="workspace-kicker">
            OVERVIEW
          </span>

          <h2>
            Your projects at a glance.
          </h2>
        </div>

        <div className="workspace-live-indicator">
          <span />
          Account connected
        </div>
      </div>

      {error && (
        <div className="workspace-alert">
          {error}
        </div>
      )}

      <div className="workspace-stat-grid">
        <article className="workspace-stat-card stagger-item">
          <div className="workspace-stat-icon">
            <FolderKanban size={21} />
          </div>

          <span>
            Active projects
          </span>

          <strong>
            {stats.active}
          </strong>
        </article>

        <article className="workspace-stat-card stagger-item">
          <div className="workspace-stat-icon">
            <Clock3 size={21} />
          </div>

          <span>
            Awaiting action
          </span>

          <strong>
            {stats.awaiting}
          </strong>
        </article>

        <article className="workspace-stat-card stagger-item">
          <div className="workspace-stat-icon">
            <CheckCircle2 size={21} />
          </div>

          <span>
            Completed
          </span>

          <strong>
            {stats.completed}
          </strong>
        </article>

        <article className="workspace-stat-card stagger-item">
          <div className="workspace-stat-icon">
            <ReceiptText size={21} />
          </div>

          <span>
            Total orders
          </span>

          <strong>
            {stats.total}
          </strong>
        </article>
      </div>

      <div className="workspace-dashboard-grid">
        <section className="workspace-panel">
          <div className="workspace-panel-heading">
            <div>
              <span>
                PROJECTS
              </span>

              <h3>
                Recent activity
              </h3>
            </div>

            <Link
              to="/dashboard/orders"
              className="text-link"
            >
              View all
              <ArrowRight size={17} />
            </Link>
          </div>

          {orders.length === 0 ? (
            <div className="workspace-empty">
              <div className="workspace-empty-icon">
                <Sparkles size={27} />
              </div>

              <h3>
                Your first project starts here.
              </h3>

              <p>
                Once you submit a Posho Creative project, its status, files and payments will appear in this workspace.
              </p>

              <Link
                to="/order"
                className="button button-primary"
              >
                Start a project
                <ArrowRight size={18} />
              </Link>
            </div>
          ) : (
            <div className="workspace-order-list">
              {orders
                .slice(0, 5)
                .map(
                  (
                    order,
                    index,
                  ) => (
                    <Link
                      key={order.id}
                      to={`/dashboard/orders/${order.reference}`}
                      className="workspace-order-row stagger-item"
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
                      </div>

                      <span
                        className={`workspace-status workspace-status-${order.status}`}
                      >
                        {formatOrderStatus(
                          order.status,
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
                )}
            </div>
          )}
        </section>

        <aside className="workspace-highlight-card">
          <span>
            YOUR WORKSPACE
          </span>

          <h3>
            Every idea stays connected.
          </h3>

          <p>
            Orders, progress updates, project files and payments remain attached to your Posho Creative account.
          </p>

          <div className="workspace-highlight-orbit">
            <span />
            <span />
            <span />
          </div>
        </aside>
      </div>
    </div>
  );
}