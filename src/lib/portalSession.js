const STORAGE_KEY =
  'posho.portal-session.v1';

const TOKEN_BYTES = 32;

function randomToken() {
  const bytes =
    new Uint8Array(
      TOKEN_BYTES,
    );

  crypto.getRandomValues(
    bytes,
  );

  return Array.from(
    bytes,
    (byte) =>
      byte
        .toString(16)
        .padStart(2, '0'),
  ).join('');
}

function validPortalSession(
  value,
  userId,
) {
  return Boolean(
    value &&
      value.userId === userId &&
      /^[a-f0-9]{64}$/.test(
        value.customerToken ||
          '',
      ) &&
      /^[a-f0-9]{64}$/.test(
        value.adminToken ||
          '',
      ),
  );
}

function readStoredSession() {
  try {
    return JSON.parse(
      window.sessionStorage
        .getItem(
          STORAGE_KEY,
        ) ||
        'null',
    );
  } catch {
    return null;
  }
}

function storePortalSession(
  portalSession,
) {
  window.sessionStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(
      portalSession,
    ),
  );

  return portalSession;
}

export function createPortalSession(
  userId,
) {
  return storePortalSession({
    userId,
    customerToken:
      randomToken(),
    adminToken:
      randomToken(),
    createdAt:
      new Date()
        .toISOString(),
  });
}

export function ensurePortalSession(
  userId,
) {
  const stored =
    readStoredSession();

  return validPortalSession(
    stored,
    userId,
  )
    ? stored
    : createPortalSession(
        userId,
      );
}

export function clearPortalSession() {
  window.sessionStorage
    .removeItem(
      STORAGE_KEY,
    );
}

export function getPortalRoutes(
  portalSession,
) {
  if (!portalSession) {
    return {
      customerBase: '',
      adminBase: '',
      adminAccess: '',
    };
  }

  const customerBase =
    `/w/${portalSession.customerToken}`;

  const adminBase =
    `/m/${portalSession.adminToken}`;

  return {
    customerBase,
    adminBase,
    adminAccess:
      `${adminBase}/access`,
  };
}

export function appendPortalPath(
  base,
  suffix = '',
) {
  if (!base) {
    return '/login';
  }

  const cleanSuffix =
    String(suffix)
      .replace(/^\/+/, '');

  return cleanSuffix
    ? `${base}/${cleanSuffix}`
    : base;
}

export function resolvePortalPath(
  path,
  portalRoutes,
) {
  if (typeof path !== 'string') {
    return path;
  }

  if (
    path === '/dashboard'
  ) {
    return portalRoutes
      .customerBase;
  }

  if (
    path.startsWith(
      '/dashboard/',
    )
  ) {
    return appendPortalPath(
      portalRoutes
        .customerBase,
      path.slice(
        '/dashboard/'.length,
      ),
    );
  }

  if (
    path === '/admin/access'
  ) {
    return portalRoutes
      .adminAccess;
  }

  if (path === '/admin') {
    return portalRoutes
      .adminBase;
  }

  if (
    path.startsWith(
      '/admin/',
    )
  ) {
    return appendPortalPath(
      portalRoutes
        .adminBase,
      path.slice(
        '/admin/'.length,
      ),
    );
  }

  return path;
}

