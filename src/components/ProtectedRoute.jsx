import {
  Navigate,
  useLocation,
} from 'react-router-dom';

import BrandLoader from './BrandLoader';

import {
  useAuth,
} from '../context/AuthContext';

export default function ProtectedRoute({
  children,
}) {
  const {
    isAuthenticated,
    loading,
  } = useAuth();

  const location =
    useLocation();

  if (loading) {
    return (
      <main className="protected-loading-page">
        <BrandLoader
          fullscreen
          label="Securing your workspace..."
        />
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