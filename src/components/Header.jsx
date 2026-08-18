import {
  useState,
} from 'react';

import {
  Link,
  NavLink,
} from 'react-router-dom';

import {
  ArrowUpRight,
  LayoutDashboard,
  LogIn,
  LogOut,
  Menu,
  UserRound,
  X,
} from 'lucide-react';

import { useAuth } from '../context/AuthContext';

export default function Header() {
  const [menuOpen, setMenuOpen] =
    useState(false);

  const [accountOpen, setAccountOpen] =
    useState(false);

  const {
    isAuthenticated,
    profile,
    user,
    signOut,
  } = useAuth();

  const closeMenus = () => {
    setMenuOpen(false);
    setAccountOpen(false);
  };

  const handleSignOut = async () => {
    await signOut();

    closeMenus();
  };

  const accountName =
    profile?.full_name ||
    user?.email ||
    'Account';

  const initial =
    accountName
      .trim()
      .charAt(0)
      .toUpperCase() || 'P';

  return (
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
                aria-expanded={accountOpen}
              >
                <span className="header-account-avatar">
                  {initial}
                </span>

                <UserRound size={16} />
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
                    <LayoutDashboard size={17} />
                    Dashboard
                  </Link>

                  <button
                    type="button"
                    onClick={handleSignOut}
                  >
                    <LogOut size={17} />
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
            <ArrowUpRight size={17} />
          </Link>

          <button
            type="button"
            className="mobile-menu-button"
            aria-label={
              menuOpen
                ? 'Close navigation menu'
                : 'Open navigation menu'
            }
            aria-expanded={menuOpen}
            onClick={() =>
              setMenuOpen(
                (current) =>
                  !current,
              )
            }
          >
            {menuOpen ? (
              <X size={23} />
            ) : (
              <Menu size={23} />
            )}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="mobile-nav-wrapper">
          <nav
            className="container mobile-nav"
            aria-label="Mobile navigation"
          >
            <NavLink
              to="/"
              onClick={closeMenus}
            >
              Home
            </NavLink>

            <NavLink
              to="/services"
              onClick={closeMenus}
            >
              Services
            </NavLink>

            <NavLink
              to="/about"
              onClick={closeMenus}
            >
              About
            </NavLink>

            <NavLink
              to="/contact"
              onClick={closeMenus}
            >
              Contact
            </NavLink>

            {isAuthenticated ? (
              <>
                <NavLink
                  to="/dashboard"
                  onClick={closeMenus}
                >
                  Dashboard
                </NavLink>

                <button
                  type="button"
                  className="mobile-signout-button"
                  onClick={handleSignOut}
                >
                  Sign out
                </button>
              </>
            ) : (
              <NavLink
                to="/login"
                onClick={closeMenus}
              >
                Sign in
              </NavLink>
            )}

            <Link
              to="/order"
              className="button button-primary"
              onClick={closeMenus}
            >
              Start a project
              <ArrowUpRight size={17} />
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}