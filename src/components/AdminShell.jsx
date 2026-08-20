import {
  useEffect,
  useState,
} from 'react';

import {
  BadgeDollarSign,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Menu,
  ReceiptText,
  Settings2,
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
    label: 'Customers',
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
    menuOpen,
    setMenuOpen,
  ] =
    useState(false);

  useEffect(() => {
    setMenuOpen(
      false,
    );
  }, [
    location.pathname,
  ]);

  useEffect(() => {
    if (!menuOpen) {
      return undefined;
    }

    const originalOverflow =
      document.body
        .style
        .overflow;

    document.body
      .style
      .overflow =
      'hidden';

    const handleKeyDown =
      (event) => {
        if (
          event.key ===
          'Escape'
        ) {
          setMenuOpen(
            false,
          );
        }
      };

    window.addEventListener(
      'keydown',
      handleKeyDown,
    );

    return () => {
      document.body
        .style
        .overflow =
        originalOverflow;

      window.removeEventListener(
        'keydown',
        handleKeyDown,
      );
    };
  }, [
    menuOpen,
  ]);

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

  return (
    <main className="admin-control admin-control-v2">
      <button
        type="button"
        className={`admin-mobile-backdrop ${
          menuOpen
            ? 'visible'
            : ''
        }`}
        onClick={() =>
          setMenuOpen(
            false,
          )
        }
        aria-label="Close admin navigation"
      />

      <aside
        className={`admin-control-sidebar admin-control-sidebar-v2 ${
          menuOpen
            ? 'is-open'
            : ''
        }`}
      >
        <div className="admin-control-brand">
          <img
            src="/brand/posho-creative-logo.png"
            alt="Posho Creative"
          />

          <span>
            ADMIN
          </span>

          <button
            type="button"
            className="admin-sidebar-close"
            onClick={() =>
              setMenuOpen(
                false,
              )
            }
            aria-label="Close navigation"
          >
            <X
              size={19}
            />
          </button>
        </div>

        <div className="admin-sidebar-label">
          MANAGEMENT
        </div>

        <nav>
          {navigation.map(
            ({
              to,
              end,
              label,
              icon:
                Icon,
            }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
              >
                <span className="admin-nav-icon">
                  <Icon
                    size={18}
                  />
                </span>

                {label}
              </NavLink>
            ),
          )}
        </nav>

        <div className="admin-sidebar-footer">
          <div>
            <span>
              POSHO CREATIVE
            </span>

            <strong>
              Management Portal
            </strong>
          </div>

          <button
            type="button"
            onClick={
              logout
            }
            className="admin-control-signout"
          >
            <LogOut
              size={17}
            />

            Sign out
          </button>
        </div>
      </aside>

      <section className="admin-control-main">
        <header className="admin-control-topbar admin-control-topbar-v2">
          <div className="admin-topbar-mobile-group">
            <button
              type="button"
              className="admin-mobile-menu-button"
              onClick={() =>
                setMenuOpen(
                  true,
                )
              }
              aria-label="Open admin navigation"
            >
              <Menu
                size={20}
              />
            </button>

            <div>
              <span>
                POSHO CREATIVE
              </span>

              <strong>
                Management Portal
              </strong>
            </div>
          </div>

          <div className="admin-online-status">
            <span />

            Protected session
          </div>
        </header>

        <div className="admin-control-content admin-control-content-v2">
          <Outlet />
        </div>
      </section>
    </main>
  );
}