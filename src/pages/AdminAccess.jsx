import {
  useEffect,
  useState,
} from 'react';

import {
  ArrowRight,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  LogOut,
  ShieldCheck,
} from 'lucide-react';

import {
  Navigate,
  useNavigate,
} from 'react-router-dom';

import {
  useAuth,
} from '../context/AuthContext';

import {
  getAdminAccessState,
  verifyAdminAccessCode,
} from '../lib/admin';

export default function AdminAccess() {
  const navigate =
    useNavigate();

  const {
    user,
    signOut,
    loading,
    portalRoutes,
  } = useAuth();

  const [checking, setChecking] =
    useState(true);

  const [
    authorisedAccount,
    setAuthorisedAccount,
  ] = useState(false);

  const [code, setCode] =
    useState('');

  const [
    showCode,
    setShowCode,
  ] = useState(false);

  const [
    submitting,
    setSubmitting,
  ] = useState(false);

  const [error, setError] =
    useState('');

  const [
    attemptsRemaining,
    setAttemptsRemaining,
  ] = useState(null);

  useEffect(() => {
    document.title =
      'Administrator Access | Posho Creative';
  }, []);

  useEffect(() => {
    let active = true;

    const check =
      async () => {
        if (
          loading ||
          !user
        ) {
          return;
        }

        try {
          const state =
            await getAdminAccessState();

          if (!active) {
            return;
          }

          if (
            !state
              .isAdminAccount
          ) {
            setAuthorisedAccount(
              false,
            );

            setChecking(false);

            return;
          }

          if (
            state.hasAccess
          ) {
            navigate(
              portalRoutes
                .adminBase,
              {
                replace: true,
              },
            );

            return;
          }

          setAuthorisedAccount(
            true,
          );
        } catch (checkError) {
          console.error(
            checkError,
          );

          setError(
            'Administrative account verification could not be completed.',
          );
        } finally {
          if (active) {
            setChecking(
              false,
            );
          }
        }
      };

    check();

    return () => {
      active = false;
    };
  }, [
    loading,
    user,
    navigate,
    portalRoutes.adminBase,
  ]);

  if (
    !loading &&
    !user
  ) {
    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }

  if (
    !checking &&
    !authorisedAccount
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

  const submit =
    async (event) => {
      event.preventDefault();

      if (!code.trim()) {
        setError(
          'Enter the administrative access code.',
        );

        return;
      }

      try {
        setSubmitting(true);
        setError('');
        setAttemptsRemaining(
          null,
        );

        await verifyAdminAccessCode(
          code,
        );

        navigate(
          portalRoutes
            .adminBase,
          {
            replace: true,
          },
        );
      } catch (
        accessError
      ) {
        const details =
          accessError?.details;

        setError(
          accessError.message,
        );

        if (
          typeof details
            ?.attemptsRemaining ===
          'number'
        ) {
          setAttemptsRemaining(
            details
              .attemptsRemaining,
          );
        }

        setCode('');
      } finally {
        setSubmitting(false);
      }
    };

  const handleSignOut =
    async () => {
      await signOut();

      navigate(
        '/login',
        {
          replace: true,
        },
      );
    };

  return (
    <main className="admin-access-page">
      <div className="admin-access-glow admin-access-glow-one" />
      <div className="admin-access-glow admin-access-glow-two" />

      <div className="admin-access-shell">
        <section className="admin-access-brand">
          <img
            src="/brand/posho-creative-logo.png"
            alt="Posho Creative"
          />

          <div>
            <span>
              ADMINISTRATION
            </span>

            <h1>
              Protected
              <br />
              workspace.
            </h1>

            <p>
              Administrative operations
              require a second verification
              layer after account sign-in.
            </p>
          </div>

          <div className="admin-access-security">
            <ShieldCheck
              size={20}
            />

            <div>
              <strong>
                Session protected
              </strong>

              <span>
                Administrative access is
                verified separately for
                each login session.
              </span>
            </div>
          </div>
        </section>

        <section className="admin-access-form-side">
          <div className="admin-access-card">
            <div className="admin-access-lock">
              <LockKeyhole
                size={25}
              />
            </div>

            <span className="admin-access-kicker">
              ACCESS CONTROL
            </span>

            <h2>
              Enter access code.
            </h2>

            <p>
              Signed in as{' '}
              <strong>
                {user?.email}
              </strong>
            </p>

            <form
              onSubmit={submit}
              className="admin-access-form"
            >
              <label
                htmlFor="admin-access-code"
              >
                Administrative access code
              </label>

              <div className="admin-access-input">
                <KeyRound
                  size={18}
                />

                <input
                  id="admin-access-code"
                  type={
                    showCode
                      ? 'text'
                      : 'password'
                  }
                  value={code}
                  onChange={(
                    event,
                  ) => {
                    setCode(
                      event
                        .target
                        .value,
                    );

                    setError(
                      '',
                    );
                  }}
                  autoComplete="one-time-code"
                  placeholder="Enter private access code"
                  autoFocus
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowCode(
                      (
                        current,
                      ) =>
                        !current,
                    )
                  }
                  aria-label={
                    showCode
                      ? 'Hide access code'
                      : 'Show access code'
                  }
                >
                  {showCode ? (
                    <EyeOff
                      size={17}
                    />
                  ) : (
                    <Eye
                      size={17}
                    />
                  )}
                </button>
              </div>

              {error && (
                <div className="admin-access-error">
                  {error}

                  {attemptsRemaining !==
                    null && (
                    <span>
                      {
                        attemptsRemaining
                      }{' '}
                      attempt
                      {attemptsRemaining ===
                      1
                        ? ''
                        : 's'}{' '}
                      remaining before temporary lock.
                    </span>
                  )}
                </div>
              )}

              <button
                type="submit"
                className="admin-access-submit"
                disabled={
                  submitting ||
                  checking
                }
              >
                <span>
                  {submitting
                    ? 'Verifying access...'
                    : 'Continue to admin'}
                </span>

                {!submitting && (
                  <ArrowRight
                    size={18}
                  />
                )}
              </button>
            </form>

            <button
              type="button"
              className="admin-access-signout"
              onClick={
                handleSignOut
              }
            >
              <LogOut
                size={16}
              />

              Sign out instead
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
