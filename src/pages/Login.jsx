import {
  useEffect,
  useState,
} from 'react';



import Icon from '../components/ui/Icon';
import OtpInput from '../components/OtpInput';
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
  isValidEmail,
  mapAuthErrorToMessage,
  OTP_CODE_LENGTH,
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
    verifyEmailOtp,
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

  const [
    otpStep,
    setOtpStep,
  ] = useState('email');

  const [
    verifyingOtp,
    setVerifyingOtp,
  ] = useState(false);

  const [
    otpCooldown,
    setOtpCooldown,
  ] = useState(0);

  const [
    otpResetKey,
    setOtpResetKey,
  ] = useState(0);

  useEffect(() => {
    document.title =
      'Sign In | Posho Creative';
  }, []);

  useEffect(() => {
    if (otpCooldown <= 0) {
      return;
    }

    const timer = window.setTimeout(
      () =>
        setOtpCooldown(
          (current) =>
            Math.max(
              0,
              current - 1,
            ),
        ),
      1000,
    );

    return () =>
      window.clearTimeout(
        timer,
      );
  }, [otpCooldown]);

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
    setShowResend(false);
    setOtpStep('email');
    setOtpCooldown(0);
  };

  const routeAfterSignIn = async (
    signedInEmail,
    nextPortalRoutes,
  ) => {
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
        `Verification email resent to ${form.email.trim()}. Check your inbox and spam folder — it arrives within a minute.`,
      );
    };

  const handleOtpComplete =
    async (code) => {
      if (
        verifyingOtp ||
        String(code || '').length <
          OTP_CODE_LENGTH
      ) {
        return;
      }

      setVerifyingOtp(true);
      setError('');

      const {
        data,
        error: verifyError,
        portalRoutes:
          nextPortalRoutes,
      } = await verifyEmailOtp({
        email: form.email,
        token: code,
        type: 'magiclink',
      });

      setVerifyingOtp(false);

      if (verifyError) {
        setError(
          mapAuthErrorToMessage(
            verifyError,
          ),
        );

        setOtpResetKey(
          (current) =>
            current + 1,
        );

        return;
      }

      await routeAfterSignIn(
        data?.user?.email ||
          form.email,
        nextPortalRoutes
          ?.customerBase
          ? nextPortalRoutes
          : portalRoutes,
      );
    };

  const handleOtpResend =
    async () => {
      if (
        otpCooldown > 0 ||
        submitting
      ) {
        return;
      }

      setSubmitting(true);
      setError('');

      const {
        error: otpError,
      } = await sendSignInOtp(
        form.email,
      );

      setSubmitting(false);

      if (otpError) {
        setError(
          mapAuthErrorToMessage(
            otpError,
          ),
        );

        return;
      }

      setOtpResetKey(
        (current) => current + 1,
      );

      setOtpCooldown(60);

      setInfo(
        `A fresh code is on its way to ${form.email.trim()}.`,
      );
    };

  const handleOtpBack = () => {
    setOtpStep('email');
    setError('');
    setInfo('');
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

        setOtpStep('code');

        setOtpResetKey(
          (current) => current + 1,
        );

        setOtpCooldown(60);

        setInfo(
          `Enter the 8-digit code we sent to ${form.email.trim()}.`,
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

      await routeAfterSignIn(
        signedInEmail,
        nextPortalRoutes,
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
              <div className="auth-mode-tabs">
                <button
                  type="button"
                  className={
                    mode ===
                    'password'
                      ? 'auth-mode-tab auth-mode-tab-active'
                      : 'auth-mode-tab'
                  }
                  onClick={() =>
                    switchMode(
                      'password',
                    )
                  }
                >
                  Password
                </button>

                <button
                  type="button"
                  className={
                    mode === 'otp'
                      ? 'auth-mode-tab auth-mode-tab-active'
                      : 'auth-mode-tab'
                  }
                  onClick={() =>
                    switchMode(
                      'otp',
                    )
                  }
                >
                  Email code
                </button>
              </div>

              {mode === 'otp' &&
              otpStep === 'code' ? (
                <>
                  <p className="auth-hint">
                    Code sent to{' '}
                    <span className="auth-otp-email-pill">
                      {form.email.trim()}
                    </span>{' '}
                    Enter it below to
                    sign in.
                  </p>

                  <OtpInput
                    length={
                      OTP_CODE_LENGTH
                    }
                    resetKey={
                      otpResetKey
                    }
                    disabled={
                      verifyingOtp
                    }
                    hasError={Boolean(
                      error,
                    )}
                    onComplete={
                      handleOtpComplete
                    }
                  />

                  {verifyingOtp && (
                    <div className="auth-check-card">
                      <span className="auth-check-spinner" />
                      Verifying code...
                    </div>
                  )}

                  {error && (
                    <div className="auth-error">
                      {error}
                    </div>
                  )}

                  {info &&
                    !error && (
                      <div className="auth-success">
                        {info}
                      </div>
                    )}

                  <div className="auth-resend-row">
                    <button
                      type="button"
                      className="auth-step-back"
                      onClick={
                        handleOtpBack
                      }
                    >
                      ← Use a different
                      email
                    </button>

                    <button
                      type="button"
                      className="auth-step-back"
                      disabled={
                        otpCooldown >
                          0 ||
                        submitting
                      }
                      onClick={
                        handleOtpResend
                      }
                    >
                      {otpCooldown >
                      0
                        ? `Resend in ${otpCooldown}s`
                        : submitting
                          ? 'Sending...'
                          : 'Resend code'}
                    </button>
                  </div>
                </>
              ) : (
                <>
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

                  {mode ===
                    'otp' && (
                    <p className="auth-hint">
                      We will email you
                      an 8-digit code.
                      Enter it here —
                      no password
                      needed.
                    </p>
                  )}

                  {error && (
                    <div className="auth-error">
                      {error}

                      {showResend && (
                        <div className="auth-inline-action">
                          <button
                            type="button"
                            disabled={
                              resending
                            }
                            onClick={
                              handleResendConfirmation
                            }
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
                      <div className="auth-success">
                        {info}
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
                </>
              )}
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
          </div>
        </section>
      </div>
    </main>
  );
}
