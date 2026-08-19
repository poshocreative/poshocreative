import {
  BadgeDollarSign,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  ReceiptText,
  Settings2,
  UsersRound,
} from 'lucide-react';

import {
  NavLink,
  Outlet,
  useNavigate,
} from 'react-router-dom';

import {
  useAuth,
} from '../context/AuthContext';

export default function AdminShell() {
  const {
    signOut,
  } =
    useAuth();

  const navigate =
    useNavigate();

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
    <main className="admin-control">
      <aside className="admin-control-sidebar">
        <div className="admin-control-brand">
          <img
            src="/brand/posho-creative-logo.png"
            alt="Posho Creative"
          />

          <span>
            ADMIN
          </span>
        </div>

        <nav>
          <NavLink
            to="/admin"
            end
          >
            <LayoutDashboard
              size={18}
            />
            Overview
          </NavLink>

          <NavLink to="/admin/orders">
            <FolderKanban
              size={18}
            />
            Orders
          </NavLink>

          <NavLink to="/admin/customers">
            <UsersRound
              size={18}
            />
            Customers
          </NavLink>

          <NavLink to="/admin/quotes">
            <BadgeDollarSign
              size={18}
            />
            Quotes
          </NavLink>

          <NavLink to="/admin/payments">
            <ReceiptText
              size={18}
            />
            Payments
          </NavLink>

          <NavLink to="/admin/pricing">
            <Settings2
              size={18}
            />
            Pricing
          </NavLink>
        </nav>

        <button
          type="button"
          onClick={logout}
          className="admin-control-signout"
        >
          <LogOut
            size={17}
          />
          Sign out
        </button>
      </aside>

      <section className="admin-control-main">
        <header className="admin-control-topbar">
          <div>
            <span>
              POSHO CREATIVE
            </span>

            <strong>
              Control Center
            </strong>
          </div>

          <div className="admin-online-status">
            <span />
            Secure admin session
          </div>
        </header>

        <div className="admin-control-content">
          <Outlet />
        </div>
      </section>
    </main>
  );
}