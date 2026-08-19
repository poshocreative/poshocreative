import {
  Bell,
  FileText,
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
    <main className="workspace-page">
      <div className="workspace-glow workspace-glow-one" />
      <div className="workspace-glow workspace-glow-two" />

      <section className="workspace-header workspace-header-v2">
        <div className="container workspace-header-inner">
          <div className="workspace-heading">
            <span>
              CLIENT WORKSPACE
            </span>

            <h1>
              Welcome, {firstName}.
            </h1>

            <p>
              Projects, quotes, payments, files and updates — organised around your account.
            </p>
          </div>

          <Link
            to="/order"
            className="button button-primary"
          >
            <Plus
              size={18}
            />
            New project
          </Link>
        </div>
      </section>

      <div className="workspace-navigation-wrapper">
        <div className="container">
          <nav className="workspace-navigation">
            <NavLink
              to="/dashboard"
              end
            >
              <LayoutDashboard
                size={17}
              />
              Overview
            </NavLink>

            <NavLink to="/dashboard/orders">
              <ReceiptText
                size={17}
              />
              Projects
            </NavLink>

            <NavLink to="/dashboard/payments">
              <ReceiptText
                size={17}
              />
              Payments
            </NavLink>

            <NavLink to="/dashboard/files">
              <FileText
                size={17}
              />
              Files
            </NavLink>

            <NavLink to="/dashboard/notifications">
              <Bell
                size={17}
              />
              Updates
            </NavLink>

            <NavLink to="/dashboard/profile">
              <Settings
                size={17}
              />
              Profile
            </NavLink>
          </nav>
        </div>
      </div>

      <section className="workspace-view-section">
        <div className="container">
          <Outlet />
        </div>
      </section>
    </main>
  );
}