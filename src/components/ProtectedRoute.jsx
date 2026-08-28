import {
  Navigate,
  useLocation,
  useParams,
} from 'react-router-dom';

import BrandLoader from './BrandLoader';

import {
  useAuth,
} from '../context/AuthContext';

export default function ProtectedRoute({
  children,
  portalRole = null,
}) {
  const {
    isAuthenticated,
    loading,
    portalRoutes,
    portalSession,
  } = useAuth();

  const {
    portalToken,
  } = useParams();

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

  if (portalRole) {
    const expectedToken =
      portalRole === 'admin'
        ? portalSession
            ?.adminToken
        : portalSession
            ?.customerToken;

    if (
      !expectedToken ||
      portalToken !==
        expectedToken
    ) {
      return (
        <Navigate
          to={
            portalRole === 'admin'
              ? portalRoutes
                  .adminAccess
              : portalRoutes
                  .customerBase
          }
          replace
        />
      );
    }
  }

  return children;
}
