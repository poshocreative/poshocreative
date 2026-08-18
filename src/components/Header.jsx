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
  ArrowUpRight,
  BriefcaseBusiness,
  CircleUserRound,
  ContactRound,
  Home,
  LayoutDashboard,
  LogIn,
  LogOut,
  Menu,
  PanelsTopLeft,
  UserRound,
  X,
} from 'lucide-react';

import {
  useAuth,
} from '../context/AuthContext';

export default function Header() {
  const [menuOpen, setMenuOpen] =
    useState(false);

  const [accountOpen, setAccountOpen] =
    useState(false);

  const location =
    useLocation();

  const {
    isAuthenticated,
    profile,
    user,
    signOut,
  } = useAuth();

  const accountName =
    profile?.full_name ||
    user?.email ||
    'Account';

  const firstName =
    profile?.full_name
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

  const closeMenus = () => {
    setMenuOpen(false);
    setAccountOpen(false);
  };

  const openMobileMenu = () => {
    setAccountOpen(false);
    setMenuOpen(true);
  };

  const handleSignOut =
    async () => {
      await signOut();

      closeMenus();
    };

  /*
   * Close the mobile sidebar whenever
   * navigation changes.
   */
  useEffect(() => {
    setMenuOpen(false);
    setAccountOpen(false);
  }, [
    location.pathname,
    location.search,
  ]);

  /*
   * The mobile sidebar must behave
   * independently from the website.
   *
   * While open:
   * - underlying page cannot scroll
   * - current scroll position remains intact
   */
  useEffect(() => {
    if (!menuOpen) {
      return undefined;
    }

    const currentScrollY =
      window.scrollY;

    const previousBodyOverflow =
      document.body.style.overflow;

    const previousBodyPosition =
      document.body.style.position;

    const previousBodyTop =
      document.body.style.top;

    const previousBodyWidth =
      document.body.style.width;

    document.body.style.overflow =
      'hidden';

    document.body.style.position =
      'fixed';

    document.body.style.top =
      `-${currentScrollY}px`;

    document.body.style.width =
      '100%';

    const handleKeyDown = (
      event,
    ) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    };

    window.addEventListener(
      'keydown',
      handleKeyDown,
    );

    return () => {
      window.removeEventListener(
        'keydown',
        handleKeyDown,
      );

      document.body.style.overflow =
        previousBodyOverflow;

      document.body.style.position =
        previousBodyPosition;

      document.body.style.top =
        previousBodyTop;

      document.body.style.width =
        previousBodyWidth;

      window.scrollTo(
        0,
        currentScrollY,
      );
    };
  }, [menuOpen]);

  return (
    <>
      <header className="site-header">
        <div className="container header-inner">
          <Link
            to="/"
            className="brand"
            onClick={closeMenus}
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
              <Link
                to="/login"
                className="header-login-link"
              >
                <LogIn size={16} />

                Sign in
              </Link>
            )}

            {isAuthenticated && (
              <div className="header-account">
                <button
                  type="button"
                  className="header-account-button"
                  onClick={() =>
                    setAccountOpen(
                      (current) =>
                        !current,
                    )
                  }
                  aria-label="Open account menu"
                  aria-expanded={
                    accountOpen
                  }
                >
                  <span className="header-account-avatar">
                    {initial}
                  </span>

                  <UserRound
                    size={16}
                  />
                </button>

                {accountOpen && (
                  <div className="header-account-menu">
                    <div className="header-account-profile">
                      <strong>
                        {accountName}
                      </strong>

                      <span>
                        {user?.email}
                      </span>
                    </div>

                    <Link
                      to="/dashboard"
                      onClick={closeMenus}
                    >
                      <LayoutDashboard
                        size={17}
                      />

                      Dashboard
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

            <Link
              to="/order"
              className="button button-primary desktop-order-button"
            >
              Start a project

              <ArrowUpRight
                size={17}
              />
            </Link>

            <button
              type="button"
              className="mobile-menu-button"
              aria-label="Open navigation menu"
              aria-expanded={
                menuOpen
              }
              aria-controls="mobile-navigation-sidebar"
              onClick={
                openMobileMenu
              }
            >
              <Menu size={23} />
            </button>
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
            setMenuOpen(false)
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
              onClick={closeMenus}
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
                setMenuOpen(false)
              }
              aria-label="Close navigation menu"
            >
              <X size={21} />
            </button>
          </div>

          {isAuthenticated ? (
            <div className="mobile-sidebar-account">
              <div className="mobile-sidebar-avatar">
                {initial}
              </div>

              <div className="mobile-sidebar-account-copy">
                <span>
                  Signed in as
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
                  Your account
                </span>

                <nav className="mobile-sidebar-navigation">
                  <NavLink
                    to="/dashboard"
                    onClick={
                      closeMenus
                    }
                  >
                    <span className="mobile-sidebar-nav-icon">
                      <LayoutDashboard
                        size={18}
                      />
                    </span>

                    <span>
                      Dashboard
                    </span>
                  </NavLink>
                </nav>
              </div>
            )}
          </div>

          <div className="mobile-sidebar-footer">
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

              <ArrowUpRight
                size={18}
              />
            </Link>

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