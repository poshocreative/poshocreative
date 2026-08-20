import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  BadgeDollarSign,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  MoreHorizontal,
  ReceiptText,
  Settings2,
  ShieldCheck,
  UsersRound,
  X,
} from 'lucide-react';

import {
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from 'react-router-dom';

import {
  useAuth,
} from '../context/AuthContext';

const navigation = [
  {
    to: '/admin',
    end: true,
    label: 'Overview',
    icon:
      LayoutDashboard,
  },
  {
    to: '/admin/orders',
    label: 'Orders',
    icon:
      FolderKanban,
  },
  {
    to: '/admin/customers',
    label: 'Clients',
    icon:
      UsersRound,
  },
  {
    to: '/admin/quotes',
    label: 'Quotes',
    icon:
      BadgeDollarSign,
  },
  {
    to: '/admin/payments',
    label: 'Payments',
    icon:
      ReceiptText,
  },
  {
    to: '/admin/pricing',
    label: 'Pricing',
    icon:
      Settings2,
  },
];

const mobilePrimary =
  navigation.slice(
    0,
    3,
  );

const mobileSecondary =
  navigation.slice(
    3,
  );

function routeMatches(
  pathname,
  route,
) {
  if (
    route ===
    '/admin'
  ) {
    return (
      pathname ===
      '/admin'
    );
  }

  return pathname
    .startsWith(
      route,
    );
}

export default function AdminShell() {
  const {
    signOut,
  } =
    useAuth();

  const navigate =
    useNavigate();

  const location =
    useLocation();

  const [
    moreOpen,
    setMoreOpen,
  ] =
    useState(false);

  const currentTitle =
    useMemo(() => {
      const match =
        [...navigation]
          .reverse()
          .find(
            (item) =>
              routeMatches(
                location
                  .pathname,
                item.to,
              ),
          );

      return (
        match?.label ||
        'Management'
      );
    }, [
      location.pathname,
    ]);

  const moreActive =
    mobileSecondary.some(
      (item) =>
        routeMatches(
          location.pathname,
          item.to,
        ),
    );

  useEffect(() => {
    setMoreOpen(
      false,
    );
  }, [
    location.pathname,
  ]);

  useEffect(() => {
    if (!moreOpen) {
      return undefined;
    }

    const oldOverflow =
      document.body
        .style
        .overflow;

    document.body
      .style
      .overflow =
      'hidden';

    const onKeyDown =
      (event) => {
        if (
          event.key ===
          'Escape'
        ) {
          setMoreOpen(
            false,
          );
        }
      };

    window.addEventListener(
      'keydown',
      onKeyDown,
    );

    return () => {
      document.body
        .style
        .overflow =
        oldOverflow;

      window.removeEventListener(
        'keydown',
        onKeyDown,
      );
    };
  }, [
    moreOpen,
  ]);

  const logout =
    async () => {
      setMoreOpen(
        false,
      );

      await signOut();

      navigate(
        '/login',
        {
          replace: true,
        },
      );
    };

  return (
    <main className="admin-pro-shell">
      <aside className="admin-pro-sidebar">
        <div className="admin-pro-brand">
          <img
            src="/brand/posho-creative-logo.png"
            alt="Posho Creative"
          />

          <span>
            MANAGEMENT
          </span>
        </div>

        <div className="admin-pro-nav-label">
          WORKSPACE
        </div>

        <nav className="admin-pro-navigation">
          {navigation.map(
            ({
              to,
              end,
              label,
              icon:
                Icon,
            }) => (
              <NavLink
                key={
                  to
                }
                to={to}
                end={end}
              >
                <span>
                  <Icon
                    size={18}
                  />
                </span>

                <strong>
                  {label}
                </strong>
              </NavLink>
            ),
          )}
        </nav>

        <div className="admin-pro-sidebar-footer">
          <div className="admin-pro-security">
            <ShieldCheck
              size={17}
            />

            <div>
              <strong>
                Protected access
              </strong>

              <span>
                Management session
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={
              logout
            }
            className="admin-pro-signout"
          >
            <LogOut
              size={17}
            />

            Sign out
          </button>
        </div>
      </aside>

      <section className="admin-pro-main">
        <header className="admin-pro-topbar">
          <div className="admin-pro-mobile-brand">
            <img
              src="/brand/posho-creative-icon.png"
              alt=""
            />
          </div>

          <div className="admin-pro-topbar-title">
            <span>
              POSHO CREATIVE
            </span>

            <strong>
              {currentTitle}
            </strong>
          </div>

          <div className="admin-pro-session">
            <span />

            Protected
          </div>
        </header>

        <div className="admin-pro-content">
          <Outlet />
        </div>
      </section>

      <nav
        className="admin-pro-mobile-tabs"
        aria-label="Management navigation"
      >
        {mobilePrimary.map(
          ({
            to,
            end,
            label,
            icon:
              Icon,
          }) => (
            <NavLink
              key={
                to
              }
              to={to}
              end={end}
            >
              <Icon
                size={20}
              />

              <span>
                {label}
              </span>
            </NavLink>
          ),
        )}

        <button
          type="button"
          className={
            moreActive ||
            moreOpen
              ? 'active'
              : ''
          }
          onClick={() =>
            setMoreOpen(
              true,
            )
          }
          aria-expanded={
            moreOpen
          }
        >
          <MoreHorizontal
            size={21}
          />

          <span>
            More
          </span>
        </button>
      </nav>

      <button
        type="button"
        className={`admin-pro-sheet-backdrop ${
          moreOpen
            ? 'visible'
            : ''
        }`}
        onClick={() =>
          setMoreOpen(
            false,
          )
        }
        aria-label="Close management menu"
      />

      <aside
        className={`admin-pro-mobile-sheet ${
          moreOpen
            ? 'open'
            : ''
        }`}
        aria-hidden={
          !moreOpen
        }
      >
        <div className="admin-pro-sheet-handle" />

        <div className="admin-pro-sheet-heading">
          <div>
            <span>
              MANAGEMENT
            </span>

            <h2>
              More controls
            </h2>
          </div>

          <button
            type="button"
            onClick={() =>
              setMoreOpen(
                false,
              )
            }
            aria-label="Close management controls"
          >
            <X
              size={19}
            />
          </button>
        </div>

        <nav className="admin-pro-sheet-links">
          {mobileSecondary.map(
            ({
              to,
              label,
              icon:
                Icon,
            }) => (
              <NavLink
                key={
                  to
                }
                to={to}
              >
                <span>
                  <Icon
                    size={19}
                  />
                </span>

                <div>
                  <strong>
                    {label}
                  </strong>

                  <small>
                    {label ===
                    'Quotes'
                      ? 'Manage project quotations'
                      : label ===
                          'Payments'
                        ? 'Review payment activity'
                        : 'Manage service pricing'}
                  </small>
                </div>
              </NavLink>
            ),
          )}
        </nav>

        <button
          type="button"
          className="admin-pro-mobile-signout"
          onClick={
            logout
          }
        >
          <LogOut
            size={18}
          />

          Sign out of Management
        </button>
      </aside>
    </main>
  );
}