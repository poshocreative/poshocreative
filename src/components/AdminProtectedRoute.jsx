import {
  useEffect,
  useState,
} from 'react';

import {
  Navigate,
  useLocation,
  useParams,
} from 'react-router-dom';

import BrandLoader from './BrandLoader';

import {
  useAuth,
} from '../context/AuthContext';

import {
  getAdminAccessState,
} from '../lib/admin';

export default function AdminProtectedRoute({
  children,
}) {
  const location =
    useLocation();

  const {
    isAuthenticated,
    loading,
    portalRoutes,
    portalSession,
  } = useAuth();

  const {
    portalToken,
  } = useParams();

  const [
    state,
    setState,
  ] = useState({
    checking: true,
    isAdminAccount:
      false,
    hasAccess: false,
  });

  useEffect(() => {
    let active = true;

    const check =
      async () => {
        if (
          loading ||
          !isAuthenticated
        ) {
          return;
        }

        try {
          const result =
            await getAdminAccessState();

          if (!active) {
            return;
          }

          setState({
            checking:
              false,

            ...result,
          });
        } catch (error) {
          console.error(
            'Admin access check failed:',
            error,
          );

          if (!active) {
            return;
          }

          setState({
            checking:
              false,

            isAdminAccount:
              false,

            hasAccess:
              false,
          });
        }
      };

    check();

    return () => {
      active = false;
    };
  }, [
    loading,
    isAuthenticated,
    location.pathname,
  ]);

  if (loading) {
    return (
      <BrandLoader
        fullscreen
        label="Securing administrator session..."
      />
    );
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }

  if (
    portalToken !==
      portalSession
        ?.adminToken
  ) {
    return (
      <Navigate
        to={
          portalRoutes.adminAccess
        }
        replace
      />
    );
  }

  if (state.checking) {
    return (
      <BrandLoader
        fullscreen
        label="Checking administrative access..."
      />
    );
  }

  if (
    !state.isAdminAccount
  ) {
    return (
      <Navigate
        to={
          portalRoutes
            .customerBase
        }
        replace
      />
    );
  }

  if (!state.hasAccess) {
    return (
      <Navigate
        to={
          portalRoutes
            .adminAccess
        }
        replace
      />
    );
  }

  return children;
}
