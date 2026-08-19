import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  Banknote,
  FolderKanban,
  LogOut,
  RefreshCw,
  ShieldCheck,
  UsersRound,
} from 'lucide-react';

import {
  useNavigate,
} from 'react-router-dom';

import BrandLoader from '../components/BrandLoader';

import {
  useAuth,
} from '../context/AuthContext';

import {
  getAdminOverview,
} from '../lib/admin';

function formatMoney(
  amountKobo,
) {
  return new Intl.NumberFormat(
    'en-NG',
    {
      style: 'currency',
      currency: 'NGN',
      maximumFractionDigits:
        0,
    },
  ).format(
    Number(
      amountKobo ||
        0,
    ) / 100,
  );
}

function formatStatus(
  value,
) {
  return value
    ?.replaceAll(
      '_',
      ' ',
    )
    ?.replace(
      /\b\w/g,
      (character) =>
        character.toUpperCase(),
    );
}

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

export default function AdminDashboard() {
  const navigate =
    useNavigate();

  const {
    user,
    signOut,
  } = useAuth();

  const [
    overview,
    setOverview,
  ] = useState(null);

  const [loading, setLoading] =
    useState(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [error, setError] =
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
          } else {
            setLoading(
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
            'The administrative overview could not be loaded.',
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
      'Admin Workspace | Posho Creative';

    load();
  }, [load]);

  const logout =
    async () => {
      await signOut();

      navigate(
        '/login',
        {
          replace: true,
        },
      );
    };

  if (loading) {
    return (
      <main className="admin-loading-page">
        <BrandLoader
          fullscreen
          label="Opening Posho Creative administration..."
        />
      </main>
    );
  }

  return (
    <main className="admin-page">
      <header className="admin-topbar">
        <div className="admin-topbar-brand">
          <img
            src="/brand/posho-creative-logo.png"
            alt="Posho Creative"
          />

          <div>
            <strong>
              Administration
            </strong>

            <span>
              Protected workspace
            </span>
          </div>
        </div>

        <div className="admin-topbar-actions">
          <div className="admin-secure-badge">
            <ShieldCheck
              size={15}
            />

            Secure session
          </div>

          <button
            type="button"
            onClick={() =>
              load(true)
            }
            disabled={
              refreshing
            }
            className="admin-icon-button"
            aria-label="Refresh dashboard"
          >
            <RefreshCw
              size={17}
              className={
                refreshing
                  ? 'admin-spin'
                  : ''
              }
            />
          </button>

          <button
            type="button"
            onClick={logout}
            className="admin-signout-button"
          >
            <LogOut
              size={16}
            />

            Sign out
          </button>
        </div>
      </header>

      <section className="admin-page-content">
        <div className="admin-heading">
          <div>
            <span>
              POSHO CREATIVE
              ADMIN
            </span>

            <h1>
              Operations
              overview.
            </h1>

            <p>
              Signed in as{' '}
              {user?.email}
            </p>
          </div>
        </div>

        {error && (
          <div className="admin-error">
            {error}
          </div>
        )}

        <div className="admin-stat-grid">
          <article className="admin-stat-card">
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
          </article>

          <article className="admin-stat-card">
            <div>
              <FolderKanban
                size={20}
              />
            </div>

            <span>
              Total orders
            </span>

            <strong>
              {overview
                ?.totalOrders ||
                0}
            </strong>
          </article>

          <article className="admin-stat-card">
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
                ?.activeOrders ||
                0}
            </strong>
          </article>

          <article className="admin-stat-card admin-stat-card-accent">
            <div>
              <Banknote
                size={20}
              />
            </div>

            <span>
              Verified revenue
            </span>

            <strong>
              {formatMoney(
                overview
                  ?.successfulRevenue ||
                  0,
              )}
            </strong>
          </article>
        </div>

        <section className="admin-panel">
          <div className="admin-panel-heading">
            <div>
              <span>
                ACTIVITY
              </span>

              <h2>
                Recent projects
              </h2>
            </div>
          </div>

          {overview
            ?.recentOrders
            ?.length ? (
            <div className="admin-order-list">
              {overview
                .recentOrders
                .map(
                  (
                    order,
                  ) => (
                    <article
                      key={
                        order.id
                      }
                      className="admin-order-row"
                    >
                      <div className="admin-order-main">
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
                          {order
                            .customers
                            ?.full_name ||
                            order
                              .customers
                              ?.email ||
                            'Customer'}
                        </span>
                      </div>

                      <div className="admin-order-service">
                        {order.service_slug
                          ?.replaceAll(
                            '-',
                            ' ',
                          )}
                      </div>

                      <span
                        className={`workspace-status workspace-status-${order.status}`}
                      >
                        {formatStatus(
                          order.status,
                        )}
                      </span>

                      <time>
                        {formatDate(
                          order.created_at,
                        )}
                      </time>
                    </article>
                  ),
                )}
            </div>
          ) : (
            <div className="admin-empty">
              No project orders have
              been submitted yet.
            </div>
          )}
        </section>
      </section>
    </main>
  );
}