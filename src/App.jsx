import {
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';

import AdminProtectedRoute from './components/AdminProtectedRoute';
import AdminShell from './components/AdminShell';
import DashboardShell from './components/DashboardShell';
import Footer from './components/Footer';
import GlobalMotion from './components/GlobalMotion';
import Header from './components/Header';
import ProtectedRoute from './components/ProtectedRoute';
import ScrollToTop from './components/ScrollToTop';
import SeoManager from './components/SeoManager';
import SignOutTransition from './components/SignOutTransition';

import About from './pages/About';
import AdminAccess from './pages/AdminAccess';
import AdminActivity from './pages/AdminActivity';
import AdminAutomations from './pages/AdminAutomations';
import AdminCustomers from './pages/AdminCustomers';
import AdminDashboard from './pages/AdminDashboard';
import AdminFinance from './pages/AdminFinance';
import AdminOrderDetail from './pages/AdminOrderDetail';
import AdminOrders from './pages/AdminOrders';
import AdminPayments from './pages/AdminPayments';
import AdminPricing from './pages/AdminPricing';
import AdminQuotes from './pages/AdminQuotes';
import AdminReports from './pages/AdminReports';
import AdminRequests from './pages/AdminRequests';
import AdminSales from './pages/AdminSales';
import AdminServices from './pages/AdminServices';
import AdminSettings from './pages/AdminSettings';
import AdminTeam from './pages/AdminTeam';
import AdminWork from './pages/AdminWork';
import Contact from './pages/Contact';
import Dashboard from './pages/Dashboard';
import DashboardFiles from './pages/DashboardFiles';
import DashboardNotifications from './pages/DashboardNotifications';
import DashboardOrderDetail from './pages/DashboardOrderDetail';
import DashboardOrders from './pages/DashboardOrders';
import DashboardPay from './pages/DashboardPay';
import DashboardPayments from './pages/DashboardPayments';
import DashboardProfile from './pages/DashboardProfile';
import DashboardProposal from './pages/DashboardProposal';
import DashboardRequests from './pages/DashboardRequests';
import EmailVerified from './pages/EmailVerified';
import Home from './pages/Home';
import Login from './pages/Login';
import NotFound from './pages/NotFound';
import Order from './pages/Order';
import PaymentReturn from './pages/PaymentReturn';
import ServiceDetail from './pages/ServiceDetail';
import Services from './pages/Services';
import Signup from './pages/Signup';

export default function App() {
  const location =
    useLocation();

  const adminArea =
    /^\/m\/[a-f0-9]{64}(?:\/|$)/
      .test(
        location.pathname,
      );

  const clientWorkspace =
    /^\/w\/[a-f0-9]{64}(?:\/|$)/
      .test(
        location.pathname,
      );

  const portalArea =
    adminArea ||
    clientWorkspace;

  return (
    <div className="app">
      <ScrollToTop />

      <SeoManager />

      <GlobalMotion />

      <SignOutTransition />

      {!portalArea && (
        <Header />
      )}

      <Routes>
        <Route
          path="/"
          element={<Home />}
        />

        <Route
          path="/services"
          element={<Services />}
        />

        <Route
          path="/services/:slug"
          element={<ServiceDetail />}
        />

        <Route
          path="/about"
          element={<About />}
        />

        <Route
          path="/contact"
          element={<Contact />}
        />

        <Route
          path="/login"
          element={<Login />}
        />

        <Route
          path="/signup"
          element={<Signup />}
        />

        <Route
          path="/email-verified"
          element={<EmailVerified />}
        />

        <Route
          path="/payment-return"
          element={
            <ProtectedRoute>
              <PaymentReturn />
            </ProtectedRoute>
          }
        />

        <Route
          path="/order"
          element={
            <ProtectedRoute>
              <Order />
            </ProtectedRoute>
          }
        />

        <Route
          path="/w/:portalToken"
          element={
            <ProtectedRoute portalRole="customer">
              <DashboardShell />
            </ProtectedRoute>
          }
        >
          <Route
            index
            element={<Dashboard />}
          />

          <Route
            path="orders"
            element={<DashboardOrders />}
          />

          <Route
            path="orders/:reference"
            element={<DashboardOrderDetail />}
          />

          <Route
            path="orders/:reference/pay"
            element={<DashboardPay />}
          />

          <Route
            path="payments"
            element={<DashboardPayments />}
          />

          <Route
            path="files"
            element={<DashboardFiles />}
          />

          <Route
            path="notifications"
            element={<DashboardNotifications />}
          />

          <Route
            path="requests"
            element={<DashboardRequests />}
          />

          <Route
            path="proposals/:id"
            element={<DashboardProposal />}
          />

          <Route
            path="profile"
            element={<DashboardProfile />}
          />
        </Route>

        <Route
          path="/m/:portalToken/access"
          element={
            <ProtectedRoute portalRole="admin">
              <AdminAccess />
            </ProtectedRoute>
          }
        />

        <Route
          path="/m/:portalToken"
          element={
            <AdminProtectedRoute>
              <AdminShell />
            </AdminProtectedRoute>
          }
        >
          <Route
            index
            element={<AdminDashboard />}
          />

          <Route
            path="orders"
            element={<AdminOrders />}
          />

          <Route
            path="orders/:reference"
            element={<AdminOrderDetail />}
          />

          <Route
            path="customers"
            element={<AdminCustomers />}
          />

          <Route
            path="sales"
            element={<AdminSales />}
          />

          <Route
            path="work"
            element={<AdminWork />}
          />

          <Route
            path="requests"
            element={<AdminRequests />}
          />

          <Route
            path="finance"
            element={<AdminFinance />}
          />

          <Route
            path="reports"
            element={<AdminReports />}
          />

          <Route
            path="services"
            element={<AdminServices />}
          />

          <Route
            path="team"
            element={<AdminTeam />}
          />

          <Route
            path="automations"
            element={<AdminAutomations />}
          />

          <Route
            path="activity"
            element={<AdminActivity />}
          />

          <Route
            path="settings"
            element={<AdminSettings />}
          />

          <Route
            path="quotes"
            element={<AdminQuotes />}
          />

          <Route
            path="payments"
            element={<AdminPayments />}
          />

          <Route
            path="pricing"
            element={<AdminPricing />}
          />
        </Route>

        <Route
          path="/404"
          element={<NotFound />}
        />

        <Route
          path="*"
          element={<NotFound />}
        />
      </Routes>

      {!portalArea && (
        <Footer />
      )}
    </div>
  );
}
