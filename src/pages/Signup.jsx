import {
  useEffect,
  useState,
} from 'react';



import Icon from '../components/ui/Icon';
import OtpInput from '../components/OtpInput';
import PasswordStrength from '../components/PasswordStrength';
import {
  Navigate,
  useSearchParams,
} from 'react-router-dom';

import Link from '../components/PortalLink';

import { useAuth } from '../context/AuthContext';

import {
  AUTH_RESEND_COOLDOWN_SECONDS,
  mapAuthErrorToMessage,
  OTP_CODE_LENGTH,
} from '../lib/authEmail';

export default function Signup() {
  const {
    signUp,
    verifyEmailOtp,
    resendSignupConfirmation,
    isAuthenticated,
    loading,
    portalRoutes,
  } = useAuth();

  const [searchParams] =
    useSearchParams();

  const next =
    searchParams.get('next') ===
      '/order'
      ? '/order'
      : portalRoutes
          .customerBase;

  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    businessName: '',
    password: '',
    confirmPassword: '',
  });

  const [showPassword, setShowPassword] =
    useState(false);

  const [submitting, setSubmitting] =
    useState(false);

  const [error, setError] =
    useState('');

  const [confirmationSent, setConfirmationSent] =
    useState(false);

  const [resending, setResending] =
    useState(false);

  const [resendInfo, setResendInfo] =
    useState('');

  const [cooldown, setCooldown] =
    useState(0);

  const [verifyingOtp, setVerifyingOtp] =
    useState(false);

  const [otpResetKey, setOtpResetKey] =
    useState(0);

  useEffect(() => {
    document.title =
      'Create Account | Posho Creative';
  }, []);

  useEffect(() => {
    if (cooldown <= 0) {
      return;
    }

    const timer = window.setTimeout(
      () =>
        setCooldown(
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
  }, [cooldown]);

  if (
    !loading &&
    isAuthenticated &&
    !confirmationSent
  ) {
    return (
      <Navigate
        to={next}
        replace
      />
    );
  }

  const updateField = (
    field,
    value,
  ) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));

    setError('');
  };

  const handleSubmit = async (
    event,
  ) => {
    event.preventDefault();

    if (
      !form.fullName.trim() ||
      !form.email.trim() ||
      !form.phone.trim() ||
      !form.password ||
      !form.confirmPassword
    ) {
      setError(
        'Complete all required fields.',
      );

      return;
    }

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        form.email,
      )
    ) {
      setError(
        'Enter a valid email address.',
      );

      return;
    }

    if (form.password.length < 8) {
      setError(
        'Your password must contain at least 8 characters.',
      );

      return;
    }

    if (
      form.password !==
      form.confirmPassword
    ) {
      setError(
        'Your passwords do not match.',
      );

      return;
    }

    setSubmitting(true);
    setError('');

    const {
      data,
      error: signUpError,
    } = await signUp(form);

    setSubmitting(false);

    if (signUpError) {
      setError(
        mapAuthErrorToMessage(
          signUpError,
        ),
      );

      return;
    }

    if (data?.session) {
      window.location.assign(next);
      return;
    }

    setConfirmationSent(true);

    setCooldown(
      AUTH_RESEND_COOLDOWN_SECONDS,
    );
  };

  const handleResendConfirmation =
    async () => {
      if (
        resending ||
        cooldown > 0
      ) {
        return;
      }

      setResending(true);
      setResendInfo('');

      const {
        error: resendError,
      } =
        await resendSignupConfirmation(
          form.email,
        );

      setResending(false);

      if (resendError) {
        setResendInfo('');

        setError(
          mapAuthErrorToMessage(
            resendError,
          ),
        );

        return;
      }

      setResendInfo(
        `Confirmation code resent to ${form.email}. Check your inbox and spam folder.`,
      );

      setCooldown(
        AUTH_RESEND_COOLDOWN_SECONDS,
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
      } = await verifyEmailOtp({
        email: form.email,
        token: code,
        type: 'signup',
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

      if (data?.session) {
        window.location.assign(
          next,
        );
      }
    };

  if (confirmationSent) {
    return (
      <main className="auth-page auth-confirmation-page">
        <div className="container auth-confirmation-container">
          <div className="auth-confirmation-card">
            <div className="auth-confirmation-icon">
              <Icon name="check_circle" size={34} />
            </div>

            <span className="section-kicker">
              Check your email
            </span>

            <h1>
              Confirm your
              <br />
              Posho Creative account.
            </h1>

            <p>
              We sent an 8-digit
              confirmation code to{' '}
              <strong>
                {form.email}
              </strong>
              . Enter it below to
              activate your account.
              Check spam if you
              don't see it within a
              minute.
            </p>

            <div
              style={{
                maxWidth: 380,
                margin:
                  '0 auto 22px',
              }}
            >
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
                label="Confirmation code"
                onComplete={
                  handleOtpComplete
                }
              />
            </div>

            {verifyingOtp && (
              <div
                className="auth-check-card"
                style={{
                  justifyContent:
                    'center',
                  marginBottom: 16,
                }}
              >
                <span className="auth-check-spinner" />
                Verifying code...
              </div>
            )}

            {error && (
              <div
                className="auth-error"
                style={{
                  textAlign: 'left',
                  marginBottom: 16,
                }}
              >
                {error}
              </div>
            )}

            {resendInfo && (
              <p className="auth-hint"
                style={{
                  textAlign: 'center',
                  color: '#207848',
                  fontWeight: 600,
                }}
              >
                {resendInfo}
              </p>
            )}

            <div
              style={{
                display: 'flex',
                gap: 10,
                justifyContent:
                  'center',
                flexWrap: 'wrap',
                marginBottom: 18,
              }}
            >
              <button
                type="button"
                className="button button-secondary"
                disabled={
                  resending ||
                  cooldown > 0
                }
                onClick={
                  handleResendConfirmation
                }
              >
                {cooldown > 0
                  ? `Resend in ${cooldown}s`
                  : resending
                    ? 'Resending...'
                    : 'Resend code'}
              </button>
            </div>

            <Link
              to={`/login?next=${encodeURIComponent(next)}`}
              className="button button-primary"
            >
              Go to sign in
              <Icon name="arrow_forward" size={18} />
            </Link>
          </div>
        </div>
      </main>
    );
  }

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
              YOUR CREATIVE WORKSPACE
            </span>

            <h1>
              Create.
              <br />
              Track.
              <br />
              Grow.
            </h1>

            <p>
              Your Posho Creative account
              keeps your projects,
              payments, files and progress
              together.
            </p>
          </div>

          <div className="auth-brand-footer">
            We see what you imagine.
          </div>
        </section>

        <section className="auth-form-panel">
          <div className="auth-form-card auth-form-card-wide">
            <div className="auth-form-heading">
              <span className="section-kicker">
                Create account
              </span>

              <h2>
                Start your Posho Creative workspace.
              </h2>

              <p>
                Create an account before
                starting and managing
                projects.
              </p>
            </div>

            <form
              className="auth-form"
              onSubmit={handleSubmit}
            >
              <div className="auth-two-column">
                <div className="auth-field">
                  <label htmlFor="fullName">
                    Full name
                  </label>

                  <div className="auth-input-wrapper">
                    <Icon name="person" size={18} />

                    <input
                      id="fullName"
                      type="text"
                      autoComplete="name"
                      value={form.fullName}
                      onChange={(event) =>
                        updateField(
                          'fullName',
                          event.target.value,
                        )
                      }
                      placeholder="Your full name"
                    />
                  </div>
                </div>

                <div className="auth-field">
                  <label htmlFor="phone">
                    Phone / WhatsApp
                  </label>

                  <div className="auth-input-wrapper">
                    <Icon name="phone" size={18} />

                    <input
                      id="phone"
                      type="tel"
                      autoComplete="tel"
                      value={form.phone}
                      onChange={(event) =>
                        updateField(
                          'phone',
                          event.target.value,
                        )
                      }
                      placeholder="+234..."
                    />
                  </div>
                </div>
              </div>

              <div className="auth-field">
                <label htmlFor="businessName">
                  Business or organisation
                  <span>Optional</span>
                </label>

                <input
                  id="businessName"
                  type="text"
                  value={form.businessName}
                  onChange={(event) =>
                    updateField(
                      'businessName',
                      event.target.value,
                    )
                  }
                  placeholder="Business or organisation name"
                />
              </div>

              <div className="auth-field">
                <label htmlFor="signupEmail">
                  Email address
                </label>

                <div className="auth-input-wrapper">
                  <Icon name="mail" size={18} />

                  <input
                    id="signupEmail"
                    type="email"
                    autoComplete="email"
                    value={form.email}
                    onChange={(event) =>
                      updateField(
                        'email',
                        event.target.value,
                      )
                    }
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              <div className="auth-two-column">
                <div className="auth-field">
                  <label htmlFor="signupPassword">
                    Password
                  </label>

                  <div className="auth-input-wrapper">
                    <Icon name="lock" size={18} />

                    <input
                      id="signupPassword"
                      type={
                        showPassword
                          ? 'text'
                          : 'password'
                      }
                      autoComplete="new-password"
                      value={form.password}
                      onChange={(event) =>
                        updateField(
                          'password',
                          event.target.value,
                        )
                      }
                      placeholder="Minimum 8 characters"
                    />

                    <button
                      type="button"
                      className="auth-password-toggle"
                      onClick={() =>
                        setShowPassword(
                          (current) =>
                            !current,
                        )
                      }
                    >
                      {showPassword ? (
                        <Icon name="visibility_off" size={17} />
                      ) : (
                        <Icon name="visibility" size={17} />
                      )}
                    </button>
                  </div>
                </div>

                <div className="auth-field">
                  <label htmlFor="confirmPassword">
                    Confirm password
                  </label>

                  <input
                    id="confirmPassword"
                    type={
                      showPassword
                        ? 'text'
                        : 'password'
                    }
                    autoComplete="new-password"
                    value={
                      form.confirmPassword
                    }
                    onChange={(event) =>
                      updateField(
                        'confirmPassword',
                        event.target.value,
                      )
                    }
                    placeholder="Repeat password"
                  />
                </div>
              </div>

              <PasswordStrength
                password={
                  form.password
                }
              />

              {error && (
                <div className="auth-error">
                  {error}
                </div>
              )}

              <button
                type="submit"
                className="button button-primary auth-submit-button"
                disabled={submitting}
              >
                {submitting
                  ? 'Creating account...'
                  : 'Create account'}

                {!submitting && (
                  <Icon name="arrow_forward" size={18} />
                )}
              </button>
            </form>

            <p className="auth-switch-copy">
              Already have an account?{' '}
              <Link
                to={`/login?next=${encodeURIComponent(next)}`}
              >
                Sign in
              </Link>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
