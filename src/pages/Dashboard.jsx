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
  Plus,
  ReceiptText,
  WalletCards,
} from 'lucide-react';

import {
  Link,
} from 'react-router-dom';

import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

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
  ).format(new Date(value));
}

function formatStatus(status) {
  return status
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase(),
    );
}

export default function Dashboard() {
  const {
    user,
    profile,
  } = useAuth();

  const [orders, setOrders] =
    useState([]);

  const [loadingOrders, setLoadingOrders] =
    useState(true);

  useEffect(() => {
    document.title =
      'Dashboard | Posho Creative';
  }, []);

  useEffect(() => {
    const loadOrders = async () => {
      if (!user?.id) {
        return;
      }

      setLoadingOrders(true);

      const {
        data,
        error,
      } = await supabase
        .from('orders')
        .select(`
          id,
          reference,
          service_slug,
          project_type,
          project_title,
          status,
          payment_status,
          quoted_amount_kobo,
          paid_amount_kobo,
          created_at,
          updated_at
        `)
        .eq('user_id', user.id)
        .order('created_at', {
          ascending: false,
        });

      if (error) {
        console.error(
          'Unable to load orders:',
          error,
        );

        setOrders([]);
      } else {
        setOrders(data ?? []);
      }

      setLoadingOrders(false);
    };

    loadOrders();
  }, [user?.id]);

  const stats = useMemo(() => {
    const completed =
      orders.filter(
        (order) =>
          order.status === 'completed',
      ).length;

    const active =
      orders.filter(
        (order) =>
          ![
            'completed',
            'cancelled',
          ].includes(order.status),
      ).length;

    const awaitingAction =
      orders.filter(
        (order) =>
          [
            'quote_sent',
            'awaiting_payment',
            'awaiting_client',
          ].includes(order.status),
      ).length;

    return {
      total: orders.length,
      active,
      awaitingAction,
      completed,
    };
  }, [orders]);

  const firstName =
    profile?.full_name
      ?.trim()
      ?.split(' ')[0] ||
    user?.email?.split('@')[0] ||
    'there';

  return (
    <main className="customer-dashboard-page">
      <section className="dashboard-top">
        <div className="container dashboard-top-inner">
          <div>
            <span className="dashboard-kicker">
              CUSTOMER WORKSPACE
            </span>

            <h1>
              Hello, {firstName}.
            </h1>

            <p>
              Manage your Posho Creative
              projects from one place.
            </p>
          </div>

          <Link
            to="/order"
            className="button button-primary"
          >
            <Plus size={18} />
            Start new project
          </Link>
        </div>
      </section>

      <section className="dashboard-content-section">
        <div className="container">
          <nav className="dashboard-nav">
            <Link
              to="/dashboard"
              className="active"
            >
              Overview
            </Link>

            <Link to="/dashboard/orders">
              Orders
            </Link>

            <Link to="/dashboard/payments">
              Payments
            </Link>

            <Link to="/dashboard/files">
              Files
            </Link>

            <Link to="/dashboard/profile">
              Profile
            </Link>
          </nav>

          <div className="dashboard-stats-grid">
            <article className="dashboard-stat-card">
              <div className="dashboard-stat-icon">
                <FolderKanban size={21} />
              </div>

              <span>
                Active projects
              </span>

              <strong>
                {stats.active}
              </strong>
            </article>

            <article className="dashboard-stat-card">
              <div className="dashboard-stat-icon">
                <Clock3 size={21} />
              </div>

              <span>
                Awaiting action
              </span>

              <strong>
                {stats.awaitingAction}
              </strong>
            </article>

            <article className="dashboard-stat-card">
              <div className="dashboard-stat-icon">
                <CheckCircle2 size={21} />
              </div>

              <span>
                Completed
              </span>

              <strong>
                {stats.completed}
              </strong>
            </article>

            <article className="dashboard-stat-card">
              <div className="dashboard-stat-icon">
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

          <div className="dashboard-main-grid">
            <section className="dashboard-panel">
              <div className="dashboard-panel-heading">
                <div>
                  <span>
                    PROJECTS
                  </span>

                  <h2>
                    Recent orders
                  </h2>
                </div>

                <Link
                  to="/dashboard/orders"
                  className="text-link"
                >
                  View all
                  <ArrowRight size={17} />
                </Link>
              </div>

              {loadingOrders ? (
                <div className="dashboard-empty">
                  <div className="auth-check-spinner" />

                  <p>
                    Loading your projects...
                  </p>
                </div>
              ) : orders.length === 0 ? (
                <div className="dashboard-empty">
                  <div className="dashboard-empty-icon">
                    <FolderKanban size={26} />
                  </div>

                  <h3>
                    No projects yet.
                  </h3>

                  <p>
                    Start your first Posho
                    Creative project and it
                    will appear here.
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
                <div className="dashboard-order-list">
                  {orders
                    .slice(0, 5)
                    .map((order) => (
                      <Link
                        key={order.id}
                        to={`/dashboard/orders/${order.reference}`}
                        className="dashboard-order-row"
                      >
                        <div className="dashboard-order-reference">
                          <span>
                            {order.reference}
                          </span>

                          <strong>
                            {
                              order.project_title
                            }
                          </strong>
                        </div>

                        <div className="dashboard-order-meta">
                          <span>
                            {formatStatus(
                              order.status,
                            )}
                          </span>

                          <small>
                            {formatDate(
                              order.created_at,
                            )}
                          </small>
                        </div>

                        <ArrowRight size={18} />
                      </Link>
                    ))}
                </div>
              )}
            </section>

            <aside className="dashboard-side-panel">
              <div className="dashboard-side-card dashboard-side-card-dark">
                <WalletCards size={24} />

                <span>
                  PAYMENTS
                </span>

                <h3>
                  Project payments stay
                  connected to your account.
                </h3>

                <p>
                  Quotes, successful
                  payments and balances will
                  appear here as your
                  projects progress.
                </p>

                <Link to="/dashboard/payments">
                  View payments
                  <ArrowRight size={16} />
                </Link>
              </div>

              <div className="dashboard-side-card">
                <span>
                  NEED SOMETHING ELSE?
                </span>

                <h3>
                  Start another idea.
                </h3>

                <p>
                  You can manage multiple
                  Posho Creative projects
                  from the same account.
                </p>

                <Link
                  to="/order"
                  className="text-link"
                >
                  Start new project
                  <ArrowRight size={16} />
                </Link>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </main>
  );
}