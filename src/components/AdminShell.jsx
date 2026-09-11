import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';



import Icon from './ui/Icon';
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
  usePermissions,
} from '../lib/permissions';

import {
  getAdminPendingPartPaymentCount,
} from '../lib/projectFinance';

import {
  getKnowledge,
} from '../lib/operations';

import CommandPalette from './CommandPalette';

const primaryNav = [
  {
    suffix: '',
    end: true,
    label: 'Overview',
    icon: 'dashboard',
    capability: null,
  },
  {
    suffix: 'orders',
    label: 'Projects',
    icon: 'folder_special',
    capability: null,
  },
  {
    suffix: 'work',
    label: 'Work',
    icon: 'assignment',
    capability: null,
  },
  {
    suffix: 'customers',
    label: 'Clients',
    icon: 'people',
    capability: null,
  },
  {
    suffix: 'sales',
    label: 'Sales',
    icon: 'work',
    capability:
      'sales.manage',
  },
  {
    suffix: 'finance',
    label: 'Finance',
    icon: 'receipt',
    capability:
      'finance.manage',
  },
  {
    suffix: 'reports',
    label: 'Reports',
    icon: 'show_chart',
    capability:
      'reports.view',
  },
];

const moreNav = [
  {
    suffix: 'requests',
    label: 'Requests',
    hint: 'Service request queue',
    icon: 'schedule',
    capability:
      'requests.manage',
  },
  {
    suffix: 'services',
    label: 'Services',
    hint: 'Catalog, packages and intake',
    icon: 'tune',
    capability:
      'services.manage',
  },
  {
    suffix: 'team',
    label: 'Team',
    hint: 'Members and capacity',
    icon: 'people',
    capability:
      'team.manage',
  },
  {
    suffix: 'automations',
    label: 'Automations',
    hint: 'Rules and run history',
    icon: 'account_tree',
    capability:
      'automations.manage',
  },
  {
    suffix: 'activity',
    label: 'Activity',
    hint: 'Operational feed and audit',
    icon: 'notifications_active',
    capability:
      'reports.view',
  },
  {
    suffix: 'settings',
    label: 'Settings',
    hint: 'Business rules and system',
    icon: 'tune',
    capability:
      'settings.manage',
  },
  {
    suffix: 'quotes',
    label: 'Quotes',
    hint: 'Manage project quotations',
    icon: 'paid',
    capability:
      'finance.manage',
  },
  {
    suffix: 'payments',
    label: 'Payments',
    hint: 'Review payment activity',
    icon: 'receipt',
    capability:
      'finance.manage',
  },
  {
    suffix: 'pricing',
    label: 'Pricing',
    hint: 'Manage service pricing',
    icon: 'paid',
    capability:
      'services.manage',
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

export default function AdminShell() {
  const {
    signOut,
    signingOut,
    adminPath,
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

  const [
    pendingPartPaymentCount,
    setPendingPartPaymentCount,
  ] = useState(0);

  const [
    disabledFlags,
    setDisabledFlags,
  ] = useState([]);

  const loadPendingPartPayments =
    useCallback(async () => {
      try {
        setPendingPartPaymentCount(
          await getAdminPendingPartPaymentCount(),
        );
      } catch (error) {
        console.error(
          'Unable to load pending part-payment count:',
          error,
        );
      }
    }, []);

  const {
    can,
  } =
    usePermissions();

  useEffect(() => {
    let cancelled = false;

    getKnowledge()
      .then(({ flags }) => {
        if (!cancelled) {
          setDisabledFlags(
            (flags || [])
              .filter((flag) => flag.enabled === false)
              .map((flag) => flag.key),
          );
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDisabledFlags([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const visibleByFlag = useCallback(
    (suffix) => {
      const flag =
        suffix === 'sales'
          ? 'sales_crm'
          : suffix === 'requests'
            ? 'requests'
            : suffix === 'team'
              ? 'team'
              : suffix === 'automations'
                ? 'automations'
                : null;

      return (
        !flag || !disabledFlags.includes(flag)
      );
    },
    [disabledFlags],
  );

  const navigation =
    useMemo(
      () =>
        primaryNav
          .filter(
            (
              item,
            ) =>
              visibleByFlag(
                item.suffix,
              ) &&
              (!item.capability ||
                can(
                  item.capability,
                )),
          )
          .map(
            (item) => ({
              ...item,
              to:
                adminPath(
                  item.suffix,
                ),
              badge:
                item.suffix === 'payments'
                  ? pendingPartPaymentCount
                  : 0,
            }),
          ),
      [
        adminPath,
        pendingPartPaymentCount,
        can,
        visibleByFlag,
      ],
    );

  const moreNavigation =
    useMemo(
      () =>
        moreNav
          .filter(
            (
              item,
            ) =>
              visibleByFlag(
                item.suffix,
              ) &&
              (!item.capability ||
                can(
                  item.capability,
                )),
          )
          .map(
            (item) => ({
              ...item,
              to:
                adminPath(
                  item.suffix,
                ),
              badge:
                item.suffix === 'payments'
                  ? pendingPartPaymentCount
                  : 0,
            }),
          ),
      [
        adminPath,
        pendingPartPaymentCount,
        can,
        visibleByFlag,
      ],
    );

  const mobilePrimary =
    navigation.filter(
      (
        item,
      ) =>
        [
          '',
          'orders',
          'customers',
        ].includes(
          item.suffix,
        ),
    );

  const mobileSecondary = [
    ...navigation.filter(
      (
        item,
      ) =>
        ![
          '',
          'orders',
          'customers',
        ].includes(
          item.suffix,
        ),
    ),
    ...moreNavigation,
  ];

  const allNavigation =
    useMemo(
      () => [
        ...navigation,
        ...moreNavigation,
      ],
      [
        navigation,
        moreNavigation,
      ],
    );

  const currentTitle =
    useMemo(() => {
      const match =
        [...allNavigation]
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
      allNavigation,
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
    loadPendingPartPayments();

    const refresh = () =>
      loadPendingPartPayments();

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
      'posho:admin-part-payments-changed',
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
        'posho:admin-part-payments-changed',
        refresh,
      );
    };
  }, [
    loadPendingPartPayments,
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
              badge,
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

                {badge > 0 && (
                  <span className="admin-pro-nav-badge" aria-label={`${badge} pending part-payment requests`}>
                    <Icon name="notifications_active" size={12} />
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </NavLink>
            ),
          )}
        </nav>

        {moreNavigation.length >
          0 && (
          <>
            <div className="admin-pro-nav-label">
              MORE
            </div>

            <nav
              className="admin-pro-navigation admin-pro-navigation-more"
              aria-label="More management sections"
            >
              {moreNavigation.map(
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
                        size={17}
                      />
                    </span>

                    <strong>
                      {label}
                    </strong>
                  </NavLink>
                ),
              )}
            </nav>
          </>
        )}

        <div className="admin-pro-sidebar-footer">
          <div className="admin-pro-security">
            <Icon name="verified_user" 
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
            disabled={
              signingOut
            }
            aria-busy={
              signingOut
            }
            className="admin-pro-signout"
          >
            <Icon name="logout" 
              size={17}
            />

            {signingOut
              ? 'Signing out…'
              : 'Sign out'}
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

          <CommandPalette />

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
            badge,
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

              {badge > 0 && (
                <strong className="admin-pro-mobile-badge">
                  {badge > 99 ? '99+' : badge}
                </strong>
              )}
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
          <Icon name="more_horiz" 
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
            <Icon name="close" 
              size={19}
            />
          </button>
        </div>

        <nav className="admin-pro-sheet-links">
          {mobileSecondary.map(
            ({
              to,
              label,
              badge,
              hint,
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

                  {badge > 0 && (
                    <span className="admin-pro-sheet-badge">
                      {badge} pending
                    </span>
                  )}

                  {hint && (
                    <small>
                      {hint}
                    </small>
                  )}
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
          disabled={
            signingOut
          }
          aria-busy={
            signingOut
          }
        >
          <Icon name="logout" 
            size={18}
          />

          {signingOut
            ? 'Signing out…'
            : 'Sign out of Management'}
        </button>
      </aside>
    </main>
  );
}
