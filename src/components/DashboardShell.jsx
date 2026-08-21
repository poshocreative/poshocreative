import {
  ArrowRight,
  Bell,
  FileText,
  FolderKanban,
  LayoutDashboard,
  Plus,
  ReceiptText,
  Settings,
} from 'lucide-react';

import {
  Link,
  NavLink,
  Outlet,
} from 'react-router-dom';

import {
  useAuth,
} from '../context/AuthContext';

export default function DashboardShell() {
  const {
    profile,
    user,
  } =
    useAuth();

  const fullName =
    profile?.full_name ||
    user?.email
      ?.split('@')[0] ||
    'Customer';

  const firstName =
    fullName
      .trim()
      .split(' ')[0];

  return (
    <main className="workspace-page workspace-page-v3">
      <div className="workspace-glow workspace-glow-one" />
      <div className="workspace-glow workspace-glow-two" />

      <section className="workspace-header workspace-header-v3">
        <div className="container workspace-header-inner workspace-header-inner-v3">
          <div className="workspace-heading workspace-heading-v3">
            <div className="workspace-eyebrow-row">
              <span>
                CLIENT WORKSPACE
              </span>

              <div className="workspace-account-state">
                <span />

                Secure account
              </div>
            </div>

            <h1>
              Welcome back, {firstName}.
            </h1>

            <p>
              Manage your projects, payments, files and updates from one organised workspace.
            </p>
          </div>

          <div className="workspace-header-actions">
            <Link
              to="/dashboard/orders"
              className="workspace-header-secondary-action"
            >
              Projects

              <ArrowRight
                size={16}
              />
            </Link>

            <Link
              to="/order"
              className="button button-primary workspace-new-project-button"
            >
              <Plus
                size={18}
              />

              New project
            </Link>
          </div>
        </div>
      </section>

      <div className="workspace-navigation-wrapper workspace-navigation-wrapper-v3">
        <div className="container">
          <nav
            className="workspace-navigation workspace-navigation-v3"
            aria-label="Client workspace"
          >
            <NavLink
              to="/dashboard"
              end
            >
              <LayoutDashboard
                size={17}
              />

              <span>
                Overview
              </span>
            </NavLink>

            <NavLink to="/dashboard/orders">
              <FolderKanban
                size={17}
              />

              <span>
                Projects
              </span>
            </NavLink>

            <NavLink to="/dashboard/payments">
              <ReceiptText
                size={17}
              />

              <span>
                Payments
              </span>
            </NavLink>

            <NavLink to="/dashboard/files">
              <FileText
                size={17}
              />

              <span>
                Files
              </span>
            </NavLink>

            <NavLink to="/dashboard/notifications">
              <Bell
                size={17}
              />

              <span>
                Updates
              </span>
            </NavLink>

            <NavLink to="/dashboard/profile">
              <Settings
                size={17}
              />

              <span>
                Profile
              </span>
            </NavLink>
          </nav>
        </div>
      </div>

      <section className="workspace-view-section workspace-view-section-v3">
        <div className="container">
          <Outlet />
        </div>
      </section>
    </main>
  );
}