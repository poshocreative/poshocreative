import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  supabase,
} from '../lib/supabase';

import {
  appendPortalPath,
  clearPortalSession,
  createPortalSession,
  ensurePortalSession,
  getPortalRoutes,
} from '../lib/portalSession';

const AuthContext =
  createContext(null);

export function AuthProvider({
  children,
}) {
  const [
    session,
    setSession,
  ] = useState(null);

  const [
    user,
    setUser,
  ] = useState(null);

  const [
    profile,
    setProfile,
  ] = useState(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    profileLoading,
    setProfileLoading,
  ] = useState(false);

  const [
    portalSession,
    setPortalSession,
  ] = useState(null);

  const loadProfile =
    useCallback(
      async (userId) => {
        if (!userId) {
          setProfile(null);

          return null;
        }

        setProfileLoading(
          true,
        );

        try {
          const {
            data,
            error,
          } =
            await supabase
              .from(
                'customers',
              )
              .select(`
                id,
                user_id,
                full_name,
                email,
                phone,
                business_name,
                preferred_contact_method,
                created_at,
                updated_at
              `)
              .eq(
                'user_id',
                userId,
              )
              .maybeSingle();

          if (error) {
            console.error(
              'Unable to load customer profile:',
              error,
            );

            setProfile(null);

            return null;
          }

          setProfile(
            data || null,
          );

          return (
            data || null
          );
        } catch (error) {
          console.error(
            'Unexpected profile loading error:',
            error,
          );

          setProfile(null);

          return null;
        } finally {
          setProfileLoading(
            false,
          );
        }
      },
      [],
    );

  useEffect(() => {
    let mounted = true;

    const initialiseAuth =
      async () => {
        try {
          const {
            data,
            error,
          } =
            await supabase.auth
              .getSession();

          if (!mounted) {
            return;
          }

          if (error) {
            console.error(
              'Unable to restore Supabase session:',
              error,
            );
          }

          const initialSession =
            data?.session ||
            null;

          setSession(
            initialSession,
          );

          setUser(
            initialSession?.user ||
              null,
          );

          setPortalSession(
            initialSession?.user?.id
              ? ensurePortalSession(
                  initialSession
                    .user.id,
                )
              : null,
          );

          if (
            initialSession
              ?.user?.id
          ) {
            await loadProfile(
              initialSession
                .user.id,
            );
          }
        } catch (error) {
          console.error(
            'Authentication initialization failed:',
            error,
          );

          if (mounted) {
            setSession(null);
            setUser(null);
            setProfile(null);
          }
        } finally {
          if (mounted) {
            setLoading(false);
          }
        }
      };

    initialiseAuth();

    const {
      data:
        authListener,
    } =
      supabase.auth
        .onAuthStateChange(
          (
            _event,
            nextSession,
          ) => {
            if (!mounted) {
              return;
            }

            setSession(
              nextSession ||
                null,
            );

            setUser(
              nextSession?.user ||
                null,
            );

            setPortalSession(
              nextSession?.user?.id
                ? ensurePortalSession(
                    nextSession
                      .user.id,
                  )
                : null,
            );

            if (!nextSession) {
              clearPortalSession();
            }

            if (
              nextSession
                ?.user?.id
            ) {
              setTimeout(
                () => {
                  loadProfile(
                    nextSession
                      .user.id,
                  );
                },
                0,
              );
            } else {
              setProfile(null);
            }

            setLoading(false);
          },
        );

    return () => {
      mounted = false;

      authListener
        ?.subscription
        ?.unsubscribe();
    };
  }, [
    loadProfile,
  ]);

  const signUp =
    async ({
      fullName,
      email,
      phone,
      businessName,
      password,
    }) => {
      try {
        const emailRedirectTo =
          `${window.location.origin}/email-verified`;

        const {
          data,
          error,
        } =
          await supabase.auth
            .signUp({
              email:
                email
                  .trim()
                  .toLowerCase(),

              password,

              options: {
                emailRedirectTo,

                data: {
                  full_name:
                    fullName
                      .trim(),

                  phone:
                    phone
                      .trim(),

                  business_name:
                    businessName
                      .trim(),

                  preferred_contact_method:
                    'whatsapp',
                },
              },
            });

        return {
          data,
          error,
        };
      } catch (error) {
        return {
          data: null,
          error,
        };
      }
    };

  const signIn =
    async ({
      email,
      password,
    }) => {
      try {
        const {
          data,
          error,
        } =
          await supabase.auth
            .signInWithPassword({
              email:
                email
                  .trim()
                  .toLowerCase(),

              password,
            });

        const nextPortalSession =
          !error &&
          data?.user?.id
            ? createPortalSession(
                data.user.id,
              )
            : null;

        if (nextPortalSession) {
          setPortalSession(
            nextPortalSession,
          );
        }

        return {
          data,
          error,
          portalRoutes:
            getPortalRoutes(
              nextPortalSession,
            ),
        };
      } catch (error) {
        return {
          data: null,
          error,
        };
      }
    };

  const signOut =
    async () => {
      try {
        const {
          error,
        } =
          await supabase.auth
            .signOut();

        if (!error) {
          clearPortalSession();
          setSession(null);
          setUser(null);
          setProfile(null);
          setPortalSession(null);
        }

        return {
          error,
        };
      } catch (error) {
        return {
          error,
        };
      }
    };

  const refreshProfile =
    useCallback(
      async () => {
        if (!user?.id) {
          return null;
        }

        return loadProfile(
          user.id,
        );
      },
      [
        user?.id,
        loadProfile,
      ],
    );

  const value =
    useMemo(
      () => {
        const portalRoutes =
          getPortalRoutes(
            portalSession,
          );

        return ({
        session,
        user,
        profile,
        portalSession,
        portalRoutes,

        loading,
        profileLoading,

        isAuthenticated:
          Boolean(user),

        signUp,
        signIn,
        signOut,
        refreshProfile,
        customerPath:
          (suffix = '') =>
            appendPortalPath(
              portalRoutes
                .customerBase,
              suffix,
            ),
        adminPath:
          (suffix = '') =>
            appendPortalPath(
              portalRoutes
                .adminBase,
              suffix,
            ),
      });
      },
      [
        session,
        user,
        profile,
        loading,
        profileLoading,
        portalSession,
        refreshProfile,
      ],
    );

  return (
    <AuthContext.Provider
      value={value}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context =
    useContext(
      AuthContext,
    );

  if (!context) {
    throw new Error(
      'useAuth must be used inside AuthProvider.',
    );
  }

  return context;
}
