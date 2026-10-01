import {
  useEffect,
  useState,
} from 'react';



import Icon from '../components/ui/Icon';
import {
  Navigate,
  useNavigate,
  useSearchParams,
} from 'react-router-dom';

import Link from '../components/PortalLink';

import {
  isAdminEmail,
} from '../config/app';

import {
  AUTH_SENDER_EMAIL,
  isValidEmail,
  mapAuthErrorToMessage,
} from '../lib/authEmail';

import {
  getMyMembership,
} from '../lib/permissions';

import {
  useAuth,
} from '../context/AuthContext';

export default function Login() {
  const {
    signIn,
    sendSignInOtp,
    resendSignupConfirmation,
    isAuthenticated,
    loading,
    user,
    portalRoutes,
  } = useAuth();

  const navigate =
    useNavigate();

  const [
    searchParams,
  ] =
    useSearchParams();

  const requestedNext =
    searchParams.get(
      'next',
    ) ||
    '';

  const publicProtectedNext =
    requestedNext ===
      '/order' ||
    requestedNext
      .startsWith(
        '/payment-return',
      )
      ? requestedNext
      : '';

  const [
    form,
    setForm,
  ] = useState({
    email: '',
    password: '',
  });

  const [
    showPassword,
    setShowPassword,
  ] = useState(false);

  const [
    submitting,
    setSubmitting,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState('');

  const [
    mode,
    setMode,
  ] = useState('password');

  const [
    otpSent,
    setOtpSent,
  ] = useState(false);

  const [
    info,
    setInfo,
  ] = useState('');

  const [
    showResend,
    setShowResend,
  ] = useState(false);

  const [
    resending,
    setResending,
  ] = useState(false);

  useEffect(() => {
    document.title =
      'Sign In | Posho Creative';
  }, []);

  const [
    teamTarget,
    setTeamTarget,
  ] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function routeTeam() {
      if (
        loading ||
        !isAuthenticated ||
        isAdminEmail(
          user?.email,
        )
      ) {
        return;
      }

      try {
        const membership =
          await getMyMembership();

        if (
          !cancelled &&
          membership.member
        ) {
          setTeamTarget(
            portalRoutes
              .adminBase,
          );
        }
      } catch {
        // fall through to client workspace
      }
    }

    routeTeam();

    return () => {
      cancelled = true;
    };
  }, [
    loading,
    isAuthenticated,
    user,
    portalRoutes,
  ]);

  if (
    !loading &&
    isAuthenticated
  ) {
    if (
      isAdminEmail(
        user?.email,
      )
    ) {
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

    if (
      teamTarget
    ) {
      return (
        <Navigate
          to={
            teamTarget
          }
          replace
        />
      );
    }

    return (
      <Navigate
        to={
          publicProtectedNext ||
          portalRoutes
            .customerBase
        }
        replace
      />
    );
  }

  const updateField = (
    field,
    value,
  ) => {
    setForm(
      (
        current,
      ) => ({
        ...current,
        [field]:
          value,
      }),
    );

    setError('');
    setInfo('');
    setShowResend(false);
  };

  const switchMode = (
    nextMode,
  ) => {
    setMode(nextMode);
    setError('');
    setInfo('');
    setOtpSent(false);
    setShowResend(false);
  };

  const handleResendConfirmation =
    async () => {
      if (
        !isValidEmail(
          form.email,
        )
      ) {
        return;
      }

      setResending(true);

      const {
        error: resendError,
      } =
        await resendSignupConfirmation(
          form.email,
        );

      setResending(false);

      if (resendError) {
        setError(
          mapAuthErrorToMessage(
            resendError,
          ),
        );

        return;
      }

      setInfo(
        `Verification email resent to ${form.email.trim()}. Check inbox and spam for ${AUTH_SENDER_EMAIL}.`,
      );
    };

  const handleSubmit =
    async (
      event,
    ) => {
      event.preventDefault();

      if (
        mode === 'otp'
      ) {
        if (
          !isValidEmail(
            form.email,
          )
        ) {
          setError(
            'Enter your account email to receive a code.',
          );

          return;
        }

        setSubmitting(
          true,
        );

        setError('');
        setInfo('');

        const {
          error: otpError,
        } =
          await sendSignInOtp(
            form.email,
          );

        setSubmitting(
          false,
        );

        if (otpError) {
          setError(
            mapAuthErrorToMessage(
              otpError,
            ),
          );

          return;
        }

        setOtpSent(true);

        setInfo(
          `We sent a 6-digit sign-in code to ${form.email.trim()} from ${AUTH_SENDER_EMAIL}.`,
        );

        return;
      }

      if (
        !form.email.trim() ||
        !form.password
      ) {
        setError(
          'Enter your email and password.',
        );

        return;
      }

      setSubmitting(
        true,
      );

      setError('');
      setInfo('');
      setShowResend(false);

      const {
        data,
        error:
          signInError,
        portalRoutes:
          nextPortalRoutes,
      } =
        await signIn(
          form,
        );

      setSubmitting(
        false,
      );

      if (
        signInError
      ) {
        const message =
          signInError.message
            ?.toLowerCase() ||
          '';

        if (
          message.includes(
            'invalid login',
          )
        ) {
          setError(
            'The email or password you entered is incorrect.',
          );
        } else if (
          message.includes(
            'email not confirmed',
          )
        ) {
          setError(
            'Confirm your email address before signing in. Check your inbox for the verification email.',
          );

          setShowResend(true);
        } else {
          setError(
            mapAuthErrorToMessage(
              signInError,
            ),
          );
        }

        return;
      }

      const signedInEmail =
        data?.user?.email ||
        form.email;

      if (
        isAdminEmail(
          signedInEmail,
        )
      ) {
        navigate(
          nextPortalRoutes
            .adminAccess,
          {
            replace: true,
          },
        );

        return;
      }

      try {
        const membership =
          await getMyMembership();

        if (
          membership.member
        ) {
          navigate(
            nextPortalRoutes
              .adminBase,
            {
              replace: true,
            },
          );

          return;
        }
      } catch {
        // fall through to client workspace
      }

      navigate(
        publicProtectedNext ||
          nextPortalRoutes
            .customerBase,
        {
          replace: true,
        },
      );
    };

  return (
    <main className="auth-page">
      <div className="auth-page-decoration auth-page-decoration-one" />
      <div className="auth-page-decoration auth-page-decoration-two" />

      <div className="container auth-layout">
        <section className="auth-brand-panel">
          <Link
            to="/"
            className="auth-brand-logo-link"
          >
            <img
              src="/brand/posho-creative-logo.png"
              alt="Posho Creative"
              className="auth-brand-logo"
            />
          </Link>

          <div className="auth-brand-copy">
            <span>
              POSHO CREATIVE ACCOUNT
            </span>

            <h1>
              Your projects.
              <br />
              One workspace.
            </h1>

            <p>
              Sign in to manage your
              projects, track progress,
              access files and view
              payments.
            </p>
          </div>

          <div className="auth-brand-footer">
            We see what you imagine.
          </div>
        </section>

        <section className="auth-form-panel">
          <div className="auth-form-card">
            <div className="auth-form-heading">
              <span className="section-kicker">
                Welcome back
              </span>

              <h2>
                Sign in to your account.
              </h2>

              <p>
                Continue to your secure
                Posho Creative workspace.
              </p>
            </div>

            <form
              className="auth-form"
              onSubmit={
                handleSubmit
              }
            >
              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  padding: 4,
                  borderRadius: 14,
                  background:
                    'var(--brand-primary-faint, #f2eafa)',
                }}
              >
                <button
                  type="button"
                  onClick={() =>
                    switchMode(
                      'password',
                    )
                  }
                  style={{
                    flex: 1,
                    minHeight: 42,
                    borderRadius: 10,
                    fontSize: 12,
                    fontWeight: 700,
                    background:
                      mode ===
                      'password'
                        ? '#ffffff'
                        : 'transparent',
                    color:
                      mode ===
                      'password'
                        ? 'var(--text)'
                        : 'var(--text-soft)',
                    boxShadow:
                      mode ===
                      'password'
                        ? '0 4px 14px rgba(26,16,41,0.08)'
                        : 'none',
                  }}
                >
                  Password
                </button>

                <button
                  type="button"
                  onClick={() =>
                    switchMode(
                      'otp',
                    )
                  }
                  style={{
                    flex: 1,
                    minHeight: 42,
                    borderRadius: 10,
                    fontSize: 12,
                    fontWeight: 700,
                    background:
                      mode ===
                      'otp'
                        ? '#ffffff'
                        : 'transparent',
                    color:
                      mode ===
                      'otp'
                        ? 'var(--text)'
                        : 'var(--text-soft)',
                    boxShadow:
                      mode ===
                      'otp'
                        ? '0 4px 14px rgba(26,16,41,0.08)'
                        : 'none',
                  }}
                >
                  Email code
                </button>
              </div>

              <div className="auth-field">
                <label htmlFor="email">
                  Email address
                </label>

                <div className="auth-input-wrapper">
                  <Icon name="mail"
                    size={18}
                  />

                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={
                      form.email
                    }
                    onChange={(
                      event,
                    ) =>
                      updateField(
                        'email',
                        event
                          .target
                          .value,
                      )
                    }
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              {mode ===
                'password' && (
                <div className="auth-field">
                  <div className="auth-field-label-row">
                    <label htmlFor="password">
                      Password
                    </label>

                    <Link to="/forgot-password">
                      Forgot password?
                    </Link>
                  </div>

                  <div className="auth-input-wrapper">
                    <Icon name="lock"
                      size={18}
                    />

                    <input
                      id="password"
                      type={
                        showPassword
                          ? 'text'
                          : 'password'
                      }
                      autoComplete="current-password"
                      value={
                        form.password
                      }
                      onChange={(
                        event,
                      ) =>
                        updateField(
                          'password',
                          event
                            .target
                            .value,
                        )
                      }
                      placeholder="Enter your password"
                    />

                    <button
                      type="button"
                      className="auth-password-toggle"
                      onClick={() =>
                        setShowPassword(
                          (
                            current,
                          ) =>
                            !current,
                        )
                      }
                      aria-label={
                        showPassword
                          ? 'Hide password'
                          : 'Show password'
                      }
                    >
                      {showPassword ? (
                        <Icon name="visibility_off"
                          size={17}
                        />
                      ) : (
                        <Icon name="visibility"
                          size={17}
                        />
                      )}
                    </button>
                  </div>
                </div>
              )}

              {mode === 'otp' && (
                <p
                  className="auth-switch-copy"
                  style={{
                    margin: 0,
                    textAlign:
                      'left',
                    lineHeight: 1.7,
                  }}
                >
                  We will email a
                  6-digit sign-in code
                  from{' '}
                  {AUTH_SENDER_EMAIL}.
                  No password needed.
                </p>
              )}

              {error && (
                <div className="auth-error">
                  {error}

                  {showResend && (
                    <div
                      style={{
                        marginTop: 10,
                      }}
                    >
                      <button
                        type="button"
                        disabled={
                          resending
                        }
                        onClick={
                          handleResendConfirmation
                        }
                        style={{
                          fontWeight: 700,
                          color:
                            'var(--brand-primary)',
                          textDecoration:
                            'underline',
                        }}
                      >
                        {resending
                          ? 'Resending...'
                          : 'Resend verification email'}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {info &&
                !error && (
                  <div
                    className="auth-error"
                    style={{
                      borderColor:
                        'rgba(32, 135, 72, 0.25)',
                      background:
                        'rgba(32, 135, 72, 0.07)',
                      color:
                        '#207848',
                    }}
                  >
                    {info}

                    {otpSent && (
                      <div
                        style={{
                          marginTop: 10,
                        }}
                      >
                        <Link
                          to={`/verify-otp?email=${encodeURIComponent(form.email.trim())}&type=magiclink`}
                          style={{
                            fontWeight: 700,
                          }}
                        >
                          Enter code now
                        </Link>
                      </div>
                    )}
                  </div>
                )}

              <button
                type="submit"
                className="button button-primary auth-submit-button"
                disabled={
                  submitting
                }
              >
                {submitting
                  ? mode ===
                    'otp'
                    ? 'Sending code...'
                    : 'Signing in...'
                  : mode ===
                      'otp'
                    ? 'Send sign-in code'
                    : 'Sign in'}

                {!submitting && (
                  <Icon name="arrow_forward"
                    size={18}
                  />
                )}
              </button>
            </form>

            <p className="auth-switch-copy">
              New to Posho Creative?{' '}
              <Link
                to={
                  publicProtectedNext
                    ? `/signup?next=${encodeURIComponent(publicProtectedNext)}`
                    : '/signup'
                }
              >
                Create an account
              </Link>
            </p>

            <p className="auth-switch-copy">
              Trouble signing in?{' '}
              <Link to="/forgot-password">
                Reset password
              </Link>{' '}
              ·{' '}
              <Link to="/verify-otp">
                Use OTP code
              </Link>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
