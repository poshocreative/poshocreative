import {
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';

import AdminProtectedRoute from './components/AdminProtectedRoute';
import DashboardShell from './components/DashboardShell';
import Footer from './components/Footer';
import GlobalMotion from './components/GlobalMotion';
import Header from './components/Header';
import ProtectedRoute from './components/ProtectedRoute';
import ScrollToTop from './components/ScrollToTop';

import About from './pages/About';
import AdminAccess from './pages/AdminAccess';
import AdminDashboard from './pages/AdminDashboard';
import Contact from './pages/Contact';
import Dashboard from './pages/Dashboard';
import DashboardFiles from './pages/DashboardFiles';
import DashboardNotifications from './pages/DashboardNotifications';
import DashboardOrderDetail from './pages/DashboardOrderDetail';
import DashboardOrders from './pages/DashboardOrders';
import DashboardPayments from './pages/DashboardPayments';
import DashboardProfile from './pages/DashboardProfile';
import EmailVerified from './pages/EmailVerified';
import Home from './pages/Home';
import Login from './pages/Login';
import NotFound from './pages/NotFound';
import Order from './pages/Order';
import ServiceDetail from './pages/ServiceDetail';
import Services from './pages/Services';
import Signup from './pages/Signup';

export default function App() {
  const location =
    useLocation();

  const adminArea =
    location.pathname ===
      '/admin' ||
    location.pathname
      .startsWith(
        '/admin/',
      );

  return (
    <div className="app">
      <ScrollToTop />

      <GlobalMotion />

      {!adminArea && (
        <Header />
      )}

      <Routes>
        <Route
          path="/"
          element={<Home />}
        />

        <Route
          path="/services"
          element={
            <Services />
          }
        />

        <Route
          path="/services/:slug"
          element={
            <ServiceDetail />
          }
        />

        <Route
          path="/about"
          element={<About />}
        />

        <Route
          path="/contact"
          element={
            <Contact />
          }
        />

        <Route
          path="/login"
          element={<Login />}
        />

        <Route
          path="/signup"
          element={
            <Signup />
          }
        />

        <Route
          path="/email-verified"
          element={
            <EmailVerified />
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
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardShell />
            </ProtectedRoute>
          }
        >
          <Route
            index
            element={
              <Dashboard />
            }
          />

          <Route
            path="orders"
            element={
              <DashboardOrders />
            }
          />

          <Route
            path="orders/:reference"
            element={
              <DashboardOrderDetail />
            }
          />

          <Route
            path="payments"
            element={
              <DashboardPayments />
            }
          />

          <Route
            path="files"
            element={
              <DashboardFiles />
            }
          />

          <Route
            path="notifications"
            element={
              <DashboardNotifications />
            }
          />

          <Route
            path="profile"
            element={
              <DashboardProfile />
            }
          />
        </Route>

        <Route
          path="/admin/access"
          element={
            <ProtectedRoute>
              <AdminAccess />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin"
          element={
            <AdminProtectedRoute>
              <AdminDashboard />
            </AdminProtectedRoute>
          }
        />

        <Route
          path="/404"
          element={
            <NotFound />
          }
        />

        <Route
          path="*"
          element={
            <NotFound />
          }
        />
      </Routes>

      {!adminArea && (
        <Footer />
      )}
    </div>
  );
}