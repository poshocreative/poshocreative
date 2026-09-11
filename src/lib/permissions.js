import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  supabase,
} from './supabase';

export const CAPABILITIES = [
  'sales.manage',
  'services.manage',
  'requests.manage',
  'finance.manage',
  'team.manage',
  'automations.manage',
  'settings.manage',
  'reports.view',
];

export const ROLE_CAPABILITIES = {
  owner: [...CAPABILITIES],
  administrator: [
    'sales.manage',
    'services.manage',
    'requests.manage',
    'finance.manage',
    'team.manage',
    'automations.manage',
    'settings.manage',
    'reports.view',
  ],
  project_manager: [
    'sales.manage',
    'requests.manage',
    'reports.view',
  ],
  finance: [
    'finance.manage',
    'reports.view',
  ],
  creative: [
    'requests.manage',
  ],
  developer: [
    'requests.manage',
  ],
  client_success: [
    'sales.manage',
    'requests.manage',
  ],
  support: [
    'requests.manage',
  ],
  viewer: [
    'reports.view',
  ],
};

export const ROLE_LABELS = {
  owner: 'Owner',
  administrator: 'Administrator',
  project_manager: 'Project Manager',
  finance: 'Finance',
  creative: 'Creative',
  developer: 'Developer',
  client_success: 'Client Success',
  support: 'Support',
  viewer: 'Viewer',
};

export function capabilitiesForRole(
  role,
  stored = null,
) {
  if (
    Array.isArray(
      stored,
    ) &&
    stored.length >
      0
  ) {
    return stored.filter(
      (
        capability,
      ) =>
        CAPABILITIES.includes(
          capability,
        ),
    );
  }

  return (
    ROLE_CAPABILITIES[
      role
    ] || []
  );
}

export async function getMyMembership() {
  const {
    data: {
      user,
    },
  } =
    await supabase.auth.getUser();

  if (!user) {
    return {
      isOwner: false,
      member: null,
      capabilities: [],
    };
  }

  const [
    access,
    member,
  ] =
    await Promise.all([
      supabase.rpc(
        'has_admin_access',
      ),
      supabase
        .from(
          'team_members',
        )
        .select('*')
        .eq(
          'user_id',
          user.id,
        )
        .maybeSingle()
        .then(
          (
            result,
          ) => result,
          () => ({
            data: null,
          }),
        ),
    ]);

  const isOwner =
    access.data ===
    true;

  const row =
    member?.data ||
    null;

  if (isOwner) {
    return {
      isOwner: true,
      member: row,
      capabilities: [
        ...CAPABILITIES,
      ],
    };
  }

  if (
    !row ||
    row.status !==
      'active'
  ) {
    return {
      isOwner: false,
      member: null,
      capabilities: [],
    };
  }

  return {
    isOwner: false,
    member: row,
    capabilities:
      capabilitiesForRole(
        row.role,
        row.capabilities,
      ),
  };
}

export function usePermissions() {
  const [
    state,
    setState,
  ] = useState({
    loading: true,
    isOwner: false,
    member: null,
    capabilities: [],
  });

  const refresh =
    useCallback(
      async () => {
        try {
          const membership =
            await getMyMembership();

          setState({
            loading: false,
            ...membership,
          });
        } catch {
          setState({
            loading: false,
            isOwner: false,
            member: null,
            capabilities: [],
          });
        }
      },
      [],
    );

  useEffect(() => {
    refresh();
  }, [
    refresh,
  ]);

  const can = useCallback(
    (
      capability,
    ) => {
      if (
        state.isOwner
      ) {
        return true;
      }

      return state.capabilities.includes(
        capability,
      );
    },
    [
      state,
    ],
  );

  return {
    ...state,
    can,
    refresh,
  };
}
