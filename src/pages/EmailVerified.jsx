import {
  useEffect,
  useState,
} from 'react';

import Icon from '../components/ui/Icon';
import Link from '../components/PortalLink';

import {
  useAuth,
} from '../context/AuthContext';

import {
  supabase,
} from '../lib/supabase';

import {
  AUTH_RESEND_COOLDOWN_SECONDS,
  isValidEmail,
  mapAuthErrorToMessage,
} from '../lib/authEmail';

function getUrlState() {
  const searchParams =
    new URLSearchParams(
      window.location.search,
    );

  const hashParams =
    new URLSearchParams(
      window.location.hash.replace(
        /^#/,
        '',
      ),
    );

  return {
    code:
      searchParams.get('code') ||
      '',

    errorDescription:
      searchParams.get(
        'error_description',
      ) ||
      hashParams.get(
        'error_description',
      ) ||
      '',

    errorCode:
      searchParams.get(
        'error_code',
      ) ||
      hashParams.get(
        'error_code',
      ) ||
      '',
  };
}

export default function EmailVerified() {
  const {
    user,
    loading,
    resendSignupConfirmation,
  } = useAuth();

  const [status, setStatus] =
    useState('checking');

  const [message, setMessage] =
    useState('');

  const [resendEmail, setResendEmail] =
    useState('');

  const [resending, setResending] =
    useState(false);

  const [resendInfo, setResendInfo] =
    useState('');

  const [cooldown, setCooldown] =
    useState(0);

  useEffect(() => {
    document.title =
      'Email Verified | Posho Creative';
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
      window.clearTimeout(timer);
  }, [cooldown]);

  useEffect(() => {
    let active = true;

    const checkVerification =
      async () => {
        const {
          code,
          errorDescription,
        } = getUrlState();

        if (errorDescription) {
          if (!active) {
            return;
          }

          setStatus('error');

          setMessage(
            decodeURIComponent(
              errorDescription,
            ) ||
              'We could not verify this email address.',
          );

          return;
        }

        if (loading) {
          return;
        }

        if (
          user?.email_confirmed_at
        ) {
          if (!active) {
            return;
          }

          setStatus('success');

          return;
        }

        try {
          if (code) {
            const {
              error: exchangeError,
            } =
              await supabase.auth.exchangeCodeForSession(
                code,
              );

            if (!active) {
              return;
            }

            if (exchangeError) {
              setStatus('error');

              setMessage(
                mapAuthErrorToMessage(
                  exchangeError,
                ),
              );

              return;
            }

            setStatus('success');

            window.history.replaceState(
              {},
              '',
              '/email-verified',
            );

            return;
          }

          const {
            data,
            error,
          } =
            await supabase.auth.getSession();

          if (!active) {
            return;
          }

          if (error) {
            setStatus('error');

            setMessage(
              'We could not confirm your account session.',
            );

            return;
          }

          const confirmedUser =
            data?.session?.user ||
            user;

          if (
            confirmedUser?.email_confirmed_at
          ) {
            setStatus('success');

            return;
          }

          setStatus('error');

          setMessage(
            'This verification link could not be confirmed. It may have expired or already been used. Request a fresh email below.',
          );
        } catch (error) {
          console.error(
            'Email verification check failed:',
            error,
          );

          if (!active) {
            return;
          }

          setStatus('error');

          setMessage(
            'Something interrupted the verification process. Please try signing in.',
          );
        }
      };

    checkVerification();

    return () => {
      active = false;
    };
  }, [
    user,
    loading,
  ]);

  const handleResend = async (
    event,
  ) => {
    event?.preventDefault?.();

    if (
      cooldown > 0 ||
      resending
    ) {
      return;
    }

    const target =
      resendEmail ||
      user?.email ||
      '';

    if (
      !isValidEmail(target)
    ) {
      setMessage(
        'Enter the email address you signed up with, then resend.',
      );

      return;
    }

    setResending(true);
    setResendInfo('');

    const { error } =
      await resendSignupConfirmation(
        target,
      );

    setResending(false);

    if (error) {
      setMessage(
        mapAuthErrorToMessage(
          error,
        ),
      );

      return;
    }

    setResendInfo(
      `Fresh verification email sent to ${target.trim()}. Check your inbox and spam folder.`,
    );

    setCooldown(
      AUTH_RESEND_COOLDOWN_SECONDS,
    );
  };

  return (
    <main className="system-page verification-page">
      <div className="system-page-orb system-page-orb-one" />
      <div className="system-page-orb system-page-orb-two" />

      <div className="system-grid-decoration">
        <span />
        <span />
        <span />
        <span />
      </div>

      <div className="container system-page-container">
        <section className="verification-card page-reveal">
          {status ===
            'checking' && (
            <>
              <div className="verification-visual verification-visual-loading">
                <div className="verification-orbit verification-orbit-one" />
                <div className="verification-orbit verification-orbit-two" />

                <div className="verification-icon">
                  <Icon name="autorenew"
                    size={34}
                  />
                </div>
              </div>

              <span className="system-kicker">
                POSHO CREATIVE
              </span>

              <h1>
                Confirming your
                <br />
                account.
              </h1>

              <p>
                Securing your Posho
                Creative workspace and
                verifying your email
                address.
              </p>

              <div className="verification-progress">
                <span />
              </div>
            </>
          )}

          {status ===
            'success' && (
            <>
              <div className="verification-visual verification-visual-success">
                <div className="verification-success-ring verification-success-ring-one" />
                <div className="verification-success-ring verification-success-ring-two" />

                <div className="verification-icon">
                  <Icon name="check_circle"
                    size={36}
                  />
                </div>
              </div>

              <span className="system-kicker">
                EMAIL VERIFIED
              </span>

              <h1>
                Your workspace
                <br />
                is ready.
              </h1>

              <p>
                Your email has been
                successfully verified.
                Your Posho Creative
                account is now ready for
                projects, files, payments
                and updates.
              </p>

              <div className="verification-security-note">
                <Icon name="verified_user"
                  size={18}
                />

                <div>
                  <strong>
                    Account secured
                  </strong>

                  <span>
                    Your verified email is
                    connected to your
                    customer workspace.
                  </span>
                </div>
              </div>

              <div className="verification-actions">
                <Link
                  to="/dashboard"
                  className="button button-primary"
                >
                  Open dashboard

                  <Icon name="arrow_forward"
                    size={18}
                  />
                </Link>

                <Link
                  to="/order"
                  className="button button-secondary"
                >
                  Start a project
                </Link>
              </div>
            </>
          )}

          {status ===
            'error' && (
            <>
              <div className="verification-visual verification-visual-error">
                <div className="verification-icon">
                  <Icon name="error"
                    size={35}
                  />
                </div>
              </div>

              <span className="system-kicker">
                VERIFICATION ISSUE
              </span>

              <h1>
                We couldn't confirm
                <br />
                that link.
              </h1>

              <p>
                {message}
              </p>

              <p
                style={{
                  fontSize: 12,
                  lineHeight: 1.7,
                }}
              >
                Links expire quickly.
                Request a fresh email
                or use your 6-digit
                code instead.
              </p>

              {resendInfo && (
                <p
                  style={{
                    fontSize: 12,
                    color: '#207848',
                    fontWeight: 600,
                  }}
                >
                  {resendInfo}
                </p>
              )}

              <form
                onSubmit={
                  handleResend
                }
                style={{
                  display: 'flex',
                  gap: 8,
                  marginTop: 8,
                  flexWrap: 'wrap',
                }}
              >
                <input
                  type="email"
                  value={
                    resendEmail ||
                    user?.email ||
                    ''
                  }
                  onChange={(
                    event,
                  ) =>
                    setResendEmail(
                      event.target
                        .value,
                    )
                  }
                  placeholder="you@example.com"
                  style={{
                    flex: '1 1 200px',
                    minHeight: 48,
                    padding: '0 14px',
                    borderRadius: 12,
                    border:
                      '1px solid var(--border)',
                  }}
                />

                <button
                  type="submit"
                  className="button button-secondary"
                  disabled={
                    resending ||
                    cooldown > 0
                  }
                >
                  {cooldown > 0
                    ? `Resend in ${cooldown}s`
                    : resending
                      ? 'Sending...'
                      : 'Resend email'}
                </button>
              </form>

              <div className="verification-actions">
                <Link
                  to="/login"
                  className="button button-primary"
                >
                  Try signing in

                  <Icon name="arrow_forward"
                    size={18}
                  />
                </Link>

                <Link
                  to="/verify-otp"
                  className="button button-secondary"
                >
                  Use OTP code
                </Link>
              </div>
            </>
          )}
        </section>

        <div className="system-page-signature">
          <span>
            POSHO CREATIVE
          </span>

          <p>
            We see what you imagine.
          </p>
        </div>
      </div>
    </main>
  );
}
