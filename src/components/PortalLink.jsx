import {
  Link,
} from 'react-router-dom';

import {
  useAuth,
} from '../context/AuthContext';

import {
  resolvePortalPath,
} from '../lib/portalSession';

export default function PortalLink({
  to,
  ...props
}) {
  const {
    portalRoutes,
  } = useAuth();

  return (
    <Link
      {...props}
      to={
        resolvePortalPath(
          to,
          portalRoutes,
        )
      }
    />
  );
}

