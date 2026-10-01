import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  useNavigate,
  useSearchParams,
} from 'react-router-dom';

import Icon from '../components/ui/Icon';
import Link from '../components/PortalLink';

import { useAuth } from '../context/AuthContext';

import {
  AUTH_RESEND_COOLDOWN_SECONDS,
  AUTH_SENDER_EMAIL,
  emailRedirectTo,
  isValidEmail,
  mapAuthErrorToMessage,
} from '../lib/authEmail';

import { supabase } from '../lib/supabase';

const OTP_TYPES = [
  { value: 'signup', label: 'Account confirmation' },
  { value: 'recovery', label: 'Password recovery' },
  { value: 'magiclink', label: 'Magic link login' },
  { value: 'email', label: 'Email change' },
];

export default function VerifyOtp() {
  const {
    verifyEmailOtp,
    portalRoutes,
  } = useAuth();

  const navigate = useNavigate();

  const [searchParams] =
    useSearchParams();

  const initialEmail =
    searchParams.get('email') || '';

  const initialType =
    searchParams.get('type') ||
    'signup';

  const [email, setEmail] =
    useState(initialEmail);

  const [type, setType] =
    useState(
      OTP_TYPES.some(
        (option) =>
          option.value ===
          initialType,
      )
        ? initialType
        : 'signup',
    );

  const [code, setCode] =
    useState('');

  const [submitting, setSubmitting] =
    useState(false);

  const [resending, setResending] =
    useState(false);

  const [error, setError] =
    useState('');

  const [info, setInfo] =
    useState('');

  const [cooldown, setCooldown] =
    useState(0);

  useEffect(() => {
    document.title =
      'Enter Verification Code | Posho Creative';
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

  const typeLabel = useMemo(
    () =>
      OTP_TYPES.find(
        (option) =>
          option.value === type,
      )?.label || 'Verification',
    [type],
  );

  const handleVerify = async (
    event,
  ) => {
    event.preventDefault();

    if (!isValidEmail(email)) {
      setError(
        'Enter the email address that received the code.',
      );

      return;
    }

    const cleanCode = String(code)
      .replace(/\s+/g, '')
      .trim();

    if (
      cleanCode.length < 6
    ) {
      setError(
        'Enter the 6-digit code from your email.',
      );

      return;
    }

    setSubmitting(true);
    setError('');
    setInfo('');

    const {
      data,
      error: verifyError,
      portalRoutes: nextRoutes,
    } = await verifyEmailOtp({
      email,
      token: cleanCode,
      type,
    });

    setSubmitting(false);

    if (verifyError) {
      setError(
        mapAuthErrorToMessage(
          verifyError,
        ),
      );

      return;
    }

    setInfo(
      'Code accepted. Opening your workspace...',
    );

    const target =
      nextRoutes?.customerBase ||
      portalRoutes?.customerBase ||
      '/login';

    window.setTimeout(() => {
      if (
        data?.session &&
        target &&
        target !== '/login'
      ) {
        navigate(target, {
          replace: true,
        });
      } else {
        navigate('/login', {
          replace: true,
        });
      }
    }, 900);
  };

  const handleResend = async () => {
    if (
      cooldown > 0 ||
      resending
    ) {
      return;
    }

    if (!isValidEmail(email)) {
      setError(
        'Enter your email first, then resend the code.',
      );

      return;
    }

    setResending(true);
    setError('');
    setInfo('');

    try {
      let result;

      if (type === 'recovery') {
        result =
          await supabase.auth.resetPasswordForEmail(
            email
              .trim()
              .toLowerCase(),
            {
              redirectTo:
                emailRedirectTo(
                  '/reset-password',
                ),
            },
          );
      } else if (
        type === 'magiclink'
      ) {
        result =
          await supabase.auth.signInWithOtp(
            {
              email: email
                .trim()
                .toLowerCase(),

              options: {
                emailRedirectTo:
                  emailRedirectTo(
                    '/email-verified',
                  ),
              },
            },
          );
      } else {
        result =
          await supabase.auth.resend(
            {
              type:
                type === 'email'
                  ? 'email'
                  : 'signup',
              email: email
                .trim()
                .toLowerCase(),

              options: {
                emailRedirectTo:
                  emailRedirectTo(
                    '/email-verified',
                  ),
              },
            },
          );
      }

      if (result?.error) {
        setError(
          mapAuthErrorToMessage(
            result.error,
          ),
        );
      } else {
        setInfo(
          `A fresh code was sent to ${email.trim()}. It can take up to a minute.`,
        );

        setCooldown(
          AUTH_RESEND_COOLDOWN_SECONDS,
        );
      }
    } catch (caught) {
      setError(
        mapAuthErrorToMessage(
          caught,
        ),
      );
    } finally {
      setResending(false);
    }
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
              EMAIL CODE
            </span>

            <h1>
              Check your
              <br />
              inbox.
            </h1>

            <p>
              Enter the 6-digit code
              sent from{' '}
              {AUTH_SENDER_EMAIL}.
              Codes expire quickly.
              Check spam and
              promotions if needed.
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
                One-time code
              </span>

              <h2>
                Verify {typeLabel.toLowerCase()}.
              </h2>

              <p>
                Codes are delivered
                through the same
                secure Posho Creative
                mailer as sign-in,
                signup and password
                reset emails.
              </p>
            </div>

            <form
              className="auth-form"
              onSubmit={handleVerify}
            >
              <div className="auth-field">
                <label htmlFor="otpEmail">
                  Email address
                </label>

                <div className="auth-input-wrapper">
                  <Icon
                    name="mail"
                    size={18}
                  />

                  <input
                    id="otpEmail"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(
                      event,
                    ) => {
                      setEmail(
                        event.target
                          .value,
                      );

                      setError('');
                      setInfo('');
                    }}
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              <div className="auth-field">
                <label htmlFor="otpType">
                  Code type
                </label>

                <select
                  id="otpType"
                  value={type}
                  onChange={(
                    event,
                  ) =>
                    setType(
                      event.target
                        .value,
                    )
                  }
                  style={{
                    minHeight: 55,
                    padding:
                      '0 16px',
                    borderRadius: 15,
                    border:
                      '1px solid var(--border)',
                    background:
                      '#ffffff',
                    fontSize: 14,
                  }}
                >
                  {OTP_TYPES.map(
                    (
                      option,
                    ) => (
                      <option
                        key={
                          option.value
                        }
                        value={
                          option.value
                        }
                      >
                        {
                          option.label
                        }
                      </option>
                    ),
                  )}
                </select>
              </div>

              <div className="auth-field">
                <label htmlFor="otpCode">
                  6-digit code
                </label>

                <input
                  id="otpCode"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={8}
                  value={code}
                  onChange={(
                    event,
                  ) => {
                    setCode(
                      event.target.value.replace(
                        /[^\d]/g,
                        '',
                      ),
                    );

                    setError('');
                  }}
                  placeholder="123456"
                  style={{
                    letterSpacing:
                      '0.35em',
                    textAlign:
                      'center',
                    fontWeight: 700,
                    fontSize: 18,
                  }}
                />
              </div>

              {error && (
                <div className="auth-error">
                  {error}
                </div>
              )}

              {info && !error && (
                <div
                  className="auth-error"
                  style={{
                    borderColor:
                      'rgba(32, 135, 72, 0.25)',
                    background:
                      'rgba(32, 135, 72, 0.07)',
                    color: '#207848',
                  }}
                >
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
                  ? 'Verifying...'
                  : 'Verify code'}

                {!submitting && (
                  <Icon
                    name="arrow_forward"
                    size={18}
                  />
                )}
              </button>

              <button
                type="button"
                className="button button-secondary auth-submit-button"
                disabled={
                  resending ||
                  cooldown > 0
                }
                onClick={
                  handleResend
                }
              >
                {cooldown > 0
                  ? `Resend in ${cooldown}s`
                  : resending
                    ? 'Sending...'
                    : 'Resend code'}
              </button>
            </form>

            <p className="auth-switch-copy">
              Prefer links?{' '}
              <Link to="/login">
                Sign in with password
              </Link>{' '}
              ·{' '}
              <Link to="/forgot-password">
                Reset password
              </Link>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
