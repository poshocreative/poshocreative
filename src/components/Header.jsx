import {
  useEffect,
  useState,
} from 'react';

import {
  Link,
  NavLink,
  useLocation,
} from 'react-router-dom';

import {
  BriefcaseBusiness,
  CircleUserRound,
  ContactRound,
  Home,
  LayoutDashboard,
  LogIn,
  LogOut,
  Menu,
  PanelsTopLeft,
  ShieldCheck,
  UserRound,
  X,
} from 'lucide-react';

import {
  isAdminEmail,
} from '../config/app';

import {
  useAuth,
} from '../context/AuthContext';

export default function Header() {
  const [
    menuOpen,
    setMenuOpen,
  ] = useState(false);

  const [
    accountOpen,
    setAccountOpen,
  ] = useState(false);

  const location =
    useLocation();

  const {
    isAuthenticated,
    profile,
    user,
    signOut,
  } = useAuth();

  const adminAccount =
    isAdminEmail(
      user?.email,
    );

  const accountName =
    adminAccount
      ? 'Admin'
      : profile?.full_name ||
        user?.email ||
        'Account';

  const firstName =
    adminAccount
      ? 'Admin'
      : profile?.full_name
          ?.trim()
          ?.split(' ')[0] ||
        user?.email
          ?.split('@')[0] ||
        'Customer';

  const initial =
    accountName
      .trim()
      .charAt(0)
      .toUpperCase() ||
    'P';

  const accountRoute =
    adminAccount
      ? '/admin'
      : '/dashboard';

  const accountLabel =
    adminAccount
      ? 'Admin workspace'
      : 'Dashboard';

  const closeMenus =
    () => {
      setMenuOpen(
        false,
      );

      setAccountOpen(
        false,
      );
    };

  const handleSignOut =
    async () => {
      await signOut();

      closeMenus();
    };

  useEffect(() => {
    closeMenus();
  }, [
    location.pathname,
    location.search,
  ]);

  useEffect(() => {
    if (!menuOpen) {
      return undefined;
    }

    const scrollY =
      window.scrollY;

    const previous = {
      overflow:
        document.body
          .style
          .overflow,

      position:
        document.body
          .style
          .position,

      top:
        document.body
          .style.top,

      width:
        document.body
          .style.width,
    };

    document.body
      .style
      .overflow =
      'hidden';

    document.body
      .style
      .position =
      'fixed';

    document.body
      .style.top =
      `-${scrollY}px`;

    document.body
      .style.width =
      '100%';

    const keyHandler =
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
      keyHandler,
    );

    return () => {
      window.removeEventListener(
        'keydown',
        keyHandler,
      );

      document.body
        .style
        .overflow =
        previous.overflow;

      document.body
        .style
        .position =
        previous.position;

      document.body
        .style.top =
        previous.top;

      document.body
        .style
        .width =
        previous.width;

      window.scrollTo(
        0,
        scrollY,
      );
    };
  }, [
    menuOpen,
  ]);

  return (
    <>
      <header className="site-header">
        <div className="container header-inner">
          <Link
            to="/"
            className="brand"
            onClick={
              closeMenus
            }
            aria-label="Posho Creative home"
          >
            <img
              src="/brand/posho-creative-logo.png"
              alt="Posho Creative"
              className="brand-logo"
            />
          </Link>

          <nav
            className="desktop-nav"
            aria-label="Primary navigation"
          >
            <NavLink to="/">
              Home
            </NavLink>

            <NavLink to="/services">
              Services
            </NavLink>

            <NavLink to="/about">
              About
            </NavLink>

            <NavLink to="/contact">
              Contact
            </NavLink>
          </nav>

          <div className="header-actions">
            {!isAuthenticated && (
              <>
                <Link
                  to="/login"
                  className="header-login-link"
                >
                  <LogIn
                    size={16}
                  />

                  Sign in
                </Link>

                <Link
                  to="/order"
                  className="button button-primary desktop-order-button"
                >
                  Start a project
                </Link>
              </>
            )}

            {isAuthenticated && (
              <div className="header-account">
                <button
                  type="button"
                  className="header-account-button"
                  onClick={() =>
                    setAccountOpen(
                      (
                        current,
                      ) =>
                        !current,
                    )
                  }
                  aria-expanded={
                    accountOpen
                  }
                  aria-label="Open account menu"
                >
                  <span className="header-account-avatar">
                    {initial}
                  </span>

                  {adminAccount ? (
                    <ShieldCheck
                      size={16}
                    />
                  ) : (
                    <UserRound
                      size={16}
                    />
                  )}
                </button>

                {accountOpen && (
                  <div className="header-account-menu">
                    <div className="header-account-profile">
                      <strong>
                        {
                          accountName
                        }
                      </strong>

                      <span>
                        {
                          user?.email
                        }
                      </span>
                    </div>

                    <Link
                      to={
                        accountRoute
                      }
                      onClick={
                        closeMenus
                      }
                    >
                      {adminAccount ? (
                        <ShieldCheck
                          size={17}
                        />
                      ) : (
                        <LayoutDashboard
                          size={17}
                        />
                      )}

                      {
                        accountLabel
                      }
                    </Link>

                    <button
                      type="button"
                      onClick={
                        handleSignOut
                      }
                    >
                      <LogOut
                        size={17}
                      />

                      Sign out
                    </button>
                  </div>
                )}
              </div>
            )}

            {!menuOpen && (
              <button
                type="button"
                className="mobile-menu-button"
                aria-label="Open navigation menu"
                aria-expanded="false"
                aria-controls="mobile-navigation-sidebar"
                onClick={() => {
                  setAccountOpen(
                    false,
                  );

                  setMenuOpen(
                    true,
                  );
                }}
              >
                <Menu
                  size={23}
                />
              </button>
            )}
          </div>
        </div>
      </header>

      <div
        className={`mobile-sidebar-layer ${
          menuOpen
            ? 'mobile-sidebar-layer-open'
            : ''
        }`}
        aria-hidden={
          !menuOpen
        }
      >
        <button
          type="button"
          className="mobile-sidebar-backdrop"
          onClick={() =>
            setMenuOpen(
              false,
            )
          }
          aria-label="Close navigation menu"
          tabIndex={
            menuOpen
              ? 0
              : -1
          }
        />

        <aside
          id="mobile-navigation-sidebar"
          className="mobile-sidebar"
          aria-label="Mobile navigation"
        >
          <div className="mobile-sidebar-header">
            <Link
              to="/"
              className="mobile-sidebar-brand"
              onClick={
                closeMenus
              }
            >
              <img
                src="/brand/posho-creative-logo.png"
                alt="Posho Creative"
              />
            </Link>

            <button
              type="button"
              className="mobile-sidebar-close"
              onClick={() =>
                setMenuOpen(
                  false,
                )
              }
              aria-label="Close navigation menu"
            >
              <X
                size={21}
              />
            </button>
          </div>

          {isAuthenticated ? (
            <div className="mobile-sidebar-account">
              <div className="mobile-sidebar-avatar">
                {initial}
              </div>

              <div className="mobile-sidebar-account-copy">
                <span>
                  {adminAccount
                    ? 'Administrator'
                    : 'Signed in as'}
                </span>

                <strong>
                  {firstName}
                </strong>

                <small>
                  {user?.email}
                </small>
              </div>
            </div>
          ) : (
            <div className="mobile-sidebar-welcome">
              <div className="mobile-sidebar-welcome-icon">
                <CircleUserRound
                  size={20}
                />
              </div>

              <div>
                <span>
                  POSHO CREATIVE
                </span>

                <strong>
                  Your creative partner.
                </strong>
              </div>
            </div>
          )}

          <div className="mobile-sidebar-scroll">
            <div className="mobile-sidebar-section">
              <span className="mobile-sidebar-label">
                Navigation
              </span>

              <nav className="mobile-sidebar-navigation">
                <NavLink
                  to="/"
                  end
                  onClick={
                    closeMenus
                  }
                >
                  <span className="mobile-sidebar-nav-icon">
                    <Home
                      size={18}
                    />
                  </span>

                  <span>
                    Home
                  </span>
                </NavLink>

                <NavLink
                  to="/services"
                  onClick={
                    closeMenus
                  }
                >
                  <span className="mobile-sidebar-nav-icon">
                    <PanelsTopLeft
                      size={18}
                    />
                  </span>

                  <span>
                    Services
                  </span>
                </NavLink>

                <NavLink
                  to="/about"
                  onClick={
                    closeMenus
                  }
                >
                  <span className="mobile-sidebar-nav-icon">
                    <BriefcaseBusiness
                      size={18}
                    />
                  </span>

                  <span>
                    About
                  </span>
                </NavLink>

                <NavLink
                  to="/contact"
                  onClick={
                    closeMenus
                  }
                >
                  <span className="mobile-sidebar-nav-icon">
                    <ContactRound
                      size={18}
                    />
                  </span>

                  <span>
                    Contact
                  </span>
                </NavLink>
              </nav>
            </div>

            {isAuthenticated && (
              <div className="mobile-sidebar-section">
                <span className="mobile-sidebar-label">
                  {adminAccount
                    ? 'Administration'
                    : 'Your account'}
                </span>

                <nav className="mobile-sidebar-navigation">
                  <NavLink
                    to={
                      accountRoute
                    }
                    onClick={
                      closeMenus
                    }
                  >
                    <span className="mobile-sidebar-nav-icon">
                      {adminAccount ? (
                        <ShieldCheck
                          size={18}
                        />
                      ) : (
                        <LayoutDashboard
                          size={18}
                        />
                      )}
                    </span>

                    <span>
                      {
                        accountLabel
                      }
                    </span>
                  </NavLink>
                </nav>
              </div>
            )}
          </div>

          <div className="mobile-sidebar-footer">
            {!isAuthenticated && (
              <Link
                to="/order"
                className="mobile-sidebar-project-button"
                onClick={
                  closeMenus
                }
              >
                <span>
                  Start a project
                </span>
              </Link>
            )}

            {isAuthenticated ? (
              <button
                type="button"
                className="mobile-sidebar-secondary-action mobile-sidebar-signout"
                onClick={
                  handleSignOut
                }
              >
                <LogOut
                  size={17}
                />

                Sign out
              </button>
            ) : (
              <Link
                to="/login"
                className="mobile-sidebar-secondary-action"
                onClick={
                  closeMenus
                }
              >
                <LogIn
                  size={17}
                />

                Sign in to your account
              </Link>
            )}

            <p className="mobile-sidebar-motto">
              We see what you imagine.
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}