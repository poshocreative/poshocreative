import {
  useEffect,
  useState,
} from 'react';

import Icon from '../components/ui/Icon';
import Link from '../components/PortalLink';

import { useAuth } from '../context/AuthContext';

import {
  AUTH_RESEND_COOLDOWN_SECONDS,
  AUTH_SENDER_EMAIL,
  isValidEmail,
  mapAuthErrorToMessage,
} from '../lib/authEmail';

export default function ForgotPassword() {
  const { sendPasswordReset } =
    useAuth();

  const [email, setEmail] =
    useState('');

  const [submitting, setSubmitting] =
    useState(false);

  const [error, setError] =
    useState('');

  const [sent, setSent] =
    useState(false);

  const [cooldown, setCooldown] =
    useState(0);

  useEffect(() => {
    document.title =
      'Reset Password | Posho Creative';
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

  const handleSubmit = async (
    event,
  ) => {
    event.preventDefault();

    if (
      !isValidEmail(email)
    ) {
      setError(
        'Enter the email address linked to your account.',
      );

      return;
    }

    setSubmitting(true);
    setError('');

    const { error: resetError } =
      await sendPasswordReset(
        email,
      );

    setSubmitting(false);

    if (resetError) {
      setError(
        mapAuthErrorToMessage(
          resetError,
        ),
      );

      return;
    }

    setSent(true);

    setCooldown(
      AUTH_RESEND_COOLDOWN_SECONDS,
    );
  };

  const handleResend = async () => {
    if (
      cooldown > 0 ||
      submitting
    ) {
      return;
    }

    setSubmitting(true);
    setError('');

    const { error: resetError } =
      await sendPasswordReset(
        email,
      );

    setSubmitting(false);

    if (resetError) {
      setError(
        mapAuthErrorToMessage(
          resetError,
        ),
      );

      return;
    }

    setCooldown(
      AUTH_RESEND_COOLDOWN_SECONDS,
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
              ACCOUNT RECOVERY
            </span>

            <h1>
              Locked out?
              <br />
              Let's fix it.
            </h1>

            <p>
              Request a secure
              password reset link.
              It arrives from{' '}
              {AUTH_SENDER_EMAIL}{' '}
              within a minute.
              Check spam if you
              don't see it.
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
                Reset password
              </span>

              <h2>
                Recover your account.
              </h2>

              <p>
                {sent
                  ? `We sent a reset link to ${email}. It expires soon, so open it promptly.`
                  : 'Enter your account email and we will send a secure reset link.'}
              </p>
            </div>

            {!sent ? (
              <form
                className="auth-form"
                onSubmit={
                  handleSubmit
                }
              >
                <div className="auth-field">
                  <label htmlFor="resetEmail">
                    Email address
                  </label>

                  <div className="auth-input-wrapper">
                    <Icon
                      name="mail"
                      size={18}
                    />

                    <input
                      id="resetEmail"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(
                        event,
                      ) =>
                        {
                          setEmail(
                            event
                              .target
                              .value,
                          );

                          setError(
                            '',
                          );
                        }
                      }
                      placeholder="you@example.com"
                    />
                  </div>
                </div>

                {error && (
                  <div className="auth-error">
                    {error}
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
                    ? 'Sending reset link...'
                    : 'Send reset link'}

                  {!submitting && (
                    <Icon
                      name="arrow_forward"
                      size={18}
                    />
                  )}
                </button>
              </form>
            ) : (
              <>
                {error && (
                  <div className="auth-error">
                    {error}
                  </div>
                )}

                <button
                  type="button"
                  className="button button-primary auth-submit-button"
                  disabled={
                    submitting ||
                    cooldown > 0
                  }
                  onClick={
                    handleResend
                  }
                >
                  {cooldown > 0
                    ? `Resend available in ${cooldown}s`
                    : submitting
                      ? 'Resending...'
                      : 'Resend reset email'}
                </button>

                <p
                  className="auth-switch-copy"
                  style={{
                    textAlign:
                      'left',
                    lineHeight: 1.7,
                  }}
                >
                  Didn't get it? Check
                  spam for{' '}
                  {AUTH_SENDER_EMAIL},
                  wait a minute, then
                  resend. Prefer a
                  one-time code?{' '}
                  <Link
                    to={`/verify-otp?email=${encodeURIComponent(email)}&type=recovery`}
                  >
                    Enter OTP code
                  </Link>
                  .
                </p>
              </>
            )}

            <p className="auth-switch-copy">
              Remembered it?{' '}
              <Link to="/login">
                Back to sign in
              </Link>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
