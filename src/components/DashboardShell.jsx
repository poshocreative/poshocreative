import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  Bell,
  FileText,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  MoreHorizontal,
  ReceiptText,
  Settings,
  ShieldCheck,
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

import {
  getUnreadNotificationCount,
} from '../lib/notificationCenter';

const navigationItems = [
  {
    suffix: '',

    end:
      true,

    label:
      'Overview',

    icon:
      LayoutDashboard,
  },
  {
    suffix: 'orders',

    label:
      'Projects',

    icon:
      FolderKanban,
  },
  {
    suffix: 'payments',

    label:
      'Payments',

    icon:
      ReceiptText,
  },
  {
    suffix: 'files',

    label:
      'Files',

    icon:
      FileText,
  },
  {
    suffix: 'notifications',

    label:
      'Updates',

    icon:
      Bell,
  },
  {
    suffix: 'profile',

    label:
      'Profile',

    icon:
      Settings,
  },
];

function routeMatches(
  pathname,
  route,
) {
  return (
    pathname === route ||
    pathname.startsWith(
      `${route}/`,
    )
  );
}

export default function DashboardShell() {
  const {
    profile,
    user,
    signOut,
    signingOut,
    customerPath,
  } =
    useAuth();

  const location =
    useLocation();

  const navigate =
    useNavigate();

  const [
    unreadCount,
    setUnreadCount,
  ] =
    useState(0);

  const [
    moreOpen,
    setMoreOpen,
  ] =
    useState(false);

  const navigation =
    useMemo(
      () =>
        navigationItems.map(
          (item) => ({
            ...item,
            to:
              customerPath(
                item.suffix,
              ),
          }),
        ),
      [
        customerPath,
      ],
    );

  const mobilePrimary =
    navigation.slice(0, 3);

  const mobileSecondary =
    navigation.slice(3);

  const fullName =
    profile?.full_name ||
    user?.email
      ?.split('@')[0] ||
    'Customer';

  const firstName =
    fullName
      .trim()
      .split(' ')[0];

  const currentTitle =
    useMemo(() => {
      if (
        location.pathname
          .includes(
            '/orders/',
          )
      ) {
        return 'Project';
      }

      const match =
        [...navigation]
          .reverse()
          .find(
            (
              item,
            ) =>
              routeMatches(
                location
                  .pathname,
                item.to,
              ),
          );

      return (
        match?.label ||
        'Workspace'
      );
    }, [
      location.pathname,
      navigation,
    ]);

  const moreActive =
    mobileSecondary.some(
      (
        item,
      ) =>
        routeMatches(
          location.pathname,
          item.to,
        ),
    );

  const loadUnreadCount =
    useCallback(
      async () => {
        if (!user?.id) {
          setUnreadCount(
            0,
          );

          return;
        }

        try {
          const count =
            await getUnreadNotificationCount();

          setUnreadCount(
            count,
          );
        } catch (
          error
        ) {
          console.error(
            'Unable to load unread update count:',
            error,
          );
        }
      },
      [
        user?.id,
      ],
    );

  useEffect(() => {
    loadUnreadCount();
  }, [
    location.pathname,
    loadUnreadCount,
  ]);

  useEffect(() => {
    setMoreOpen(
      false,
    );
  }, [
    location.pathname,
  ]);

  useEffect(() => {
    const refresh =
      () =>
        loadUnreadCount();

    const timer =
      window.setInterval(
        refresh,
        30000,
      );

    window.addEventListener(
      'focus',
      refresh,
    );

    window.addEventListener(
      'posho:notifications-changed',
      refresh,
    );

    return () => {
      window.clearInterval(
        timer,
      );

      window.removeEventListener(
        'focus',
        refresh,
      );

      window.removeEventListener(
        'posho:notifications-changed',
        refresh,
      );
    };
  }, [
    loadUnreadCount,
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

    const handleKey =
      (
        event,
      ) => {
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
      handleKey,
    );

    return () => {
      document.body
        .style
        .overflow =
        oldOverflow;

      window.removeEventListener(
        'keydown',
        handleKey,
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

      const {
        error,
      } =
        await signOut();

      if (error) {
        return;
      }

      navigate(
        '/login',
        {
          replace:
            true,
        },
      );
    };

  const unreadLabel =
    unreadCount >
    99
      ? '99+'
      : unreadCount;

  return (
    <main className="client-pro-shell">
      <aside className="client-pro-sidebar">
        <div className="client-pro-brand">
          <img
            src="/brand/posho-creative-logo.png"
            alt="Posho Creative"
          />

          <span>
            CLIENT
          </span>
        </div>

        <div className="client-pro-account">
          <div className="client-pro-avatar">
            {firstName
              .charAt(0)
              .toUpperCase()}
          </div>

          <div>
            <span>
              WELCOME BACK
            </span>

            <strong>
              {firstName}
            </strong>
          </div>
        </div>

        <div className="client-pro-nav-label">
          WORKSPACE
        </div>

        <nav className="client-pro-navigation">
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
                to={
                  to
                }
                end={
                  end
                }
              >
                <span className="client-pro-nav-icon">
                  <Icon
                    size={18}
                  />

                  {label ===
                    'Updates' &&
                    unreadCount >
                      0 && (
                      <i>
                        {unreadLabel}
                      </i>
                    )}
                </span>

                <strong>
                  {label}
                </strong>
              </NavLink>
            ),
          )}
        </nav>

        <div className="client-pro-sidebar-footer">
          <div className="client-pro-security">
            <ShieldCheck
              size={17}
            />

            <div>
              <strong>
                Secure workspace
              </strong>

              <span>
                Private client account
              </span>
            </div>
          </div>

          <button
            type="button"
            className="client-pro-signout"
            onClick={
              logout
            }
            disabled={
              signingOut
            }
            aria-busy={
              signingOut
            }
          >
            <LogOut
              size={17}
            />

            {signingOut
              ? 'Signing out…'
              : 'Sign out'}
          </button>
        </div>
      </aside>

      <section className="client-pro-main">
        <header className="client-pro-topbar">
          <div className="client-pro-mobile-brand">
            <img
              src="/brand/posho-creative-icon.png"
              alt=""
            />
          </div>

          <div className="client-pro-topbar-title">
            <span>
              POSHO CREATIVE
            </span>

            <strong>
              {currentTitle}
            </strong>
          </div>

          <div className="client-pro-session">
            <span />

            Secure
          </div>
        </header>

        <div className="client-pro-content">
          <Outlet />
        </div>
      </section>

      <nav
        className="client-pro-mobile-tabs"
        aria-label="Client workspace navigation"
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
              to={
                to
              }
              end={
                end
              }
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

          {unreadCount >
            0 && (
            <strong className="client-pro-more-badge">
              {unreadLabel}
            </strong>
          )}
        </button>
      </nav>

      <button
        type="button"
        className={`client-pro-sheet-backdrop ${
          moreOpen
            ? 'visible'
            : ''
        }`}
        onClick={() =>
          setMoreOpen(
            false,
          )
        }
        aria-label="Close client workspace menu"
      />

      <aside
        className={`client-pro-mobile-sheet ${
          moreOpen
            ? 'open'
            : ''
        }`}
        aria-hidden={
          !moreOpen
        }
      >
        <div className="client-pro-sheet-handle" />

        <div className="client-pro-sheet-heading">
          <div>
            <span>
              CLIENT WORKSPACE
            </span>

            <h2>
              More
            </h2>
          </div>

          <button
            type="button"
            onClick={() =>
              setMoreOpen(
                false,
              )
            }
            aria-label="Close workspace menu"
          >
            <X
              size={19}
            />
          </button>
        </div>

        <nav className="client-pro-sheet-links">
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
                to={
                  to
                }
              >
                <span>
                  <Icon
                    size={19}
                  />

                  {label ===
                    'Updates' &&
                    unreadCount >
                      0 && (
                      <i>
                        {unreadLabel}
                      </i>
                    )}
                </span>

                <div>
                  <strong>
                    {label}
                  </strong>

                  <small>
                    {label ===
                    'Files'
                      ? 'Project references and delivered files'
                      : label ===
                          'Updates'
                        ? 'Project activity and important updates'
                        : 'Account and contact information'}
                  </small>
                </div>
              </NavLink>
            ),
          )}
        </nav>

        <button
          type="button"
          className="client-pro-mobile-signout"
          onClick={
            logout
          }
          disabled={
            signingOut
          }
          aria-busy={
            signingOut
          }
        >
          <LogOut
            size={18}
          />

          {signingOut
            ? 'Signing out…'
            : 'Sign out of Client Workspace'}
        </button>
      </aside>
    </main>
  );
}
