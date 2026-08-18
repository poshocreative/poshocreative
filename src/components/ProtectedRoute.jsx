import {
  Navigate,
  useLocation,
} from 'react-router-dom';

import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({
  children,
}) {
  const {
    isAuthenticated,
    loading,
  } = useAuth();

  const location = useLocation();

  if (loading) {
    return (
      <main className="auth-check-page">
        <div className="auth-check-card">
          <div className="auth-check-spinner" />

          <p>
            Checking your Posho Creative account...
          </p>
        </div>
      </main>
    );
  }

  if (!isAuthenticated) {
    const next =
      `${location.pathname}${location.search}`;

    return (
      <Navigate
        to={`/login?next=${encodeURIComponent(next)}`}
        replace
      />
    );
  }

  return children;
}