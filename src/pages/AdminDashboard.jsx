import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  ArrowRight,
  Banknote,
  CheckCircle2,
  Clock3,
  FolderKanban,
  RefreshCw,
  UsersRound,
  XCircle,
} from 'lucide-react';

import {
  Link,
} from 'react-router-dom';

import BrandLoader from '../components/BrandLoader';

import {
  getAdminOverview,
} from '../lib/admin';

import {
  formatMoney,
  formatOrderStatus,
} from '../lib/orders';

function displayState(
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

export default function AdminDashboard() {
  const [
    overview,
    setOverview,
  ] =
    useState(null);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    refreshing,
    setRefreshing,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState('');

  const load =
    useCallback(
      async (
        refresh = false,
      ) => {
        try {
          if (refresh) {
            setRefreshing(
              true,
            );
          }

          setError('');

          const data =
            await getAdminOverview();

          setOverview(
            data,
          );
        } catch (
          loadError
        ) {
          console.error(
            loadError,
          );

          setError(
            'The management overview could not be loaded.',
          );
        } finally {
          setLoading(
            false,
          );

          setRefreshing(
            false,
          );
        }
      },
      [],
    );

  useEffect(() => {
    document.title =
      'Management Portal | Posho Creative';

    load();
  }, [
    load,
  ]);

  if (loading) {
    return (
      <BrandLoader
        label="Preparing management overview..."
      />
    );
  }

  return (
    <div className="admin-view admin-dashboard-v2 page-reveal">
      <div className="admin-view-heading admin-dashboard-heading">
        <div>
          <span>
            OPERATIONS
          </span>

          <h1>
            Management
            <br />
            overview.
          </h1>

          <p>
            Review incoming work, monitor active projects and keep commercial activity organised.
          </p>
        </div>

        <button
          type="button"
          className="admin-refresh-button"
          onClick={() =>
            load(true)
          }
          disabled={
            refreshing
          }
        >
          <RefreshCw
            size={17}
            className={
              refreshing
                ? 'admin-spin'
                : ''
            }
          />

          Refresh
        </button>
      </div>

      {error && (
        <div className="admin-error">
          {error}
        </div>
      )}

      <div className="admin-dashboard-stat-grid">
        <article className="admin-dashboard-stat admin-dashboard-stat-priority">
          <div>
            <Clock3
              size={20}
            />
          </div>

          <span>
            Awaiting review
          </span>

          <strong>
            {overview
              ?.pendingReview ||
              0}
          </strong>

          <small>
            New project requests
          </small>
        </article>

        <article className="admin-dashboard-stat">
          <div>
            <FolderKanban
              size={20}
            />
          </div>

          <span>
            Active projects
          </span>

          <strong>
            {overview
              ?.activeProjects ||
              0}
          </strong>

          <small>
            Approved and ongoing
          </small>
        </article>

        <article className="admin-dashboard-stat">
          <div>
            <Banknote
              size={20}
            />
          </div>

          <span>
            Awaiting payment
          </span>

          <strong>
            {overview
              ?.awaitingPayment ||
              0}
          </strong>

          <small>
            Quotes ready for payment
          </small>
        </article>

        <article className="admin-dashboard-stat">
          <div>
            <UsersRound
              size={20}
            />
          </div>

          <span>
            Customers
          </span>

          <strong>
            {overview
              ?.customers ||
              0}
          </strong>

          <small>
            Registered client accounts
          </small>
        </article>

        <article className="admin-dashboard-stat admin-dashboard-stat-money">
          <div>
            <CheckCircle2
              size={20}
            />
          </div>

          <span>
            Confirmed revenue
          </span>

          <strong>
            {formatMoney(
              overview
                ?.revenue ||
                0,
            )}
          </strong>

          <small>
            Successfully verified payments
          </small>
        </article>

        <article className="admin-dashboard-stat admin-dashboard-stat-money">
          <div>
            <Banknote
              size={20}
            />
          </div>

          <span>
            Outstanding
          </span>

          <strong>
            {formatMoney(
              overview
                ?.outstanding ||
                0,
            )}
          </strong>

          <small>
            Approved unpaid balances
          </small>
        </article>
      </div>

      <div className="admin-dashboard-grid">
        <section className="admin-dashboard-panel admin-review-queue">
          <div className="admin-dashboard-panel-heading">
            <div>
              <span>
                REVIEW QUEUE
              </span>

              <h2>
                New project requests
              </h2>
            </div>

            <Link
              to="/admin/orders"
            >
              View all

              <ArrowRight
                size={16}
              />
            </Link>
          </div>

          {overview
            ?.pendingOrders
            ?.length ? (
            <div className="admin-dashboard-list">
              {overview
                .pendingOrders
                .map(
                  (
                    order,
                  ) => (
                    <Link
                      key={
                        order.id
                      }
                      to={`/admin/orders/${order.reference}`}
                      className="admin-dashboard-list-row"
                    >
                      <div>
                        <small>
                          {order.reference}
                        </small>

                        <strong>
                          {order.project_title}
                        </strong>

                        <span>
                          {order
                            .customers
                            ?.full_name ||
                            order
                              .customers
                              ?.email}
                        </span>
                      </div>

                      <span className="admin-decision-pill pending">
                        Review
                      </span>

                      <ArrowRight
                        size={17}
                      />
                    </Link>
                  ),
                )}
            </div>
          ) : (
            <div className="admin-clean-state">
              <CheckCircle2
                size={24}
              />

              <strong>
                Review queue clear
              </strong>

              <span>
                There are no new project requests awaiting a decision.
              </span>
            </div>
          )}
        </section>

        <aside className="admin-dashboard-panel admin-dashboard-summary">
          <div className="admin-dashboard-panel-heading">
            <div>
              <span>
                DECISIONS
              </span>

              <h2>
                Order review
              </h2>
            </div>
          </div>

          <div className="admin-decision-summary-row">
            <div className="decision-icon approved">
              <CheckCircle2
                size={17}
              />
            </div>

            <span>
              Approved
            </span>

            <strong>
              {overview
                ?.approved ||
                0}
            </strong>
          </div>

          <div className="admin-decision-summary-row">
            <div className="decision-icon declined">
              <XCircle
                size={17}
              />
            </div>

            <span>
              Declined
            </span>

            <strong>
              {overview
                ?.declined ||
                0}
            </strong>
          </div>
        </aside>
      </div>

      <section className="admin-dashboard-panel admin-recent-panel">
        <div className="admin-dashboard-panel-heading">
          <div>
            <span>
              RECENT ACTIVITY
            </span>

            <h2>
              Latest projects
            </h2>
          </div>
        </div>

        <div className="admin-dashboard-list">
          {(overview
            ?.recentOrders ||
            []).map(
            (
              order,
            ) => (
              <Link
                key={
                  order.id
                }
                to={`/admin/orders/${order.reference}`}
                className="admin-dashboard-list-row"
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
                      ?.replaceAll(
                        '-',
                        ' ',
                      )}
                  </span>
                </div>

                <span
                  className={`admin-decision-pill ${order.review_decision}`}
                >
                  {displayState(
                    order,
                  )}
                </span>

                <ArrowRight
                  size={17}
                />
              </Link>
            ),
          )}
        </div>
      </section>
    </div>
  );
}