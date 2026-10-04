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
import OtpInput from '../components/OtpInput';
import Link from '../components/PortalLink';

import { useAuth } from '../context/AuthContext';

import {
  AUTH_RESEND_COOLDOWN_SECONDS,
  emailRedirectTo,
  isValidEmail,
  mapAuthErrorToMessage,
  OTP_CODE_LENGTH,
} from '../lib/authEmail';

import { supabase } from '../lib/supabase';

const VERIFY_CONFIG = {
  signup: {
    kicker: 'Confirm your email',
    title: 'Check your inbox.',
    heading: 'Enter your confirmation code.',
    description: 'We sent an 8-digit confirmation code to activate your account.',
    brandEyebrow: 'EMAIL CONFIRMATION',
    brandTitle: 'Check your inbox.',
    success: 'Email confirmed. Opening your workspace...',
  },
  recovery: {
    kicker: 'Password reset',
    title: 'Check your inbox.',
    heading: 'Enter your reset code.',
    description: 'We sent an 8-digit password reset code. It expires soon.',
    brandEyebrow: 'ACCOUNT RECOVERY',
    brandTitle: 'Check your inbox.',
    success: 'Code accepted. Taking you to set a new password...',
  },
  magiclink: {
    kicker: 'Sign-in code',
    title: 'Check your inbox.',
    heading: 'Enter your sign-in code.',
    description: 'We sent an 8-digit code to sign you in securely — no password needed.',
    brandEyebrow: 'SECURE SIGN-IN',
    brandTitle: 'Check your inbox.',
    success: 'Code accepted. Opening your workspace...',
  },
  email: {
    kicker: 'Confirm email change',
    title: 'Check your inbox.',
    heading: 'Enter your confirmation code.',
    description: 'We sent an 8-digit code to confirm your new email address.',
    brandEyebrow: 'EMAIL CHANGE',
    brandTitle: 'Check your inbox.',
    success: 'Email confirmed. Opening your workspace...',
  },
};

function normalizeOtpType(raw) {
  const value = String(raw || '').trim().toLowerCase();
  if (value === 'signup' || value === 'recovery' || value === 'magiclink' || value === 'email') {
    return value;
  }
  // Supabase aliases / legacy links
  if (value === 'email_change' || value === 'email-change') return 'email';
  if (value === 'invite') return 'signup';
  return 'signup';
}

export default function VerifyOtp() {
  const {
    verifyEmailOtp,
    portalRoutes,
  } = useAuth();

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const queryEmail = searchParams.get('email') || '';
  const queryType = normalizeOtpType(searchParams.get('type'));

  const [email, setEmail] = useState(queryEmail);
  const [editingEmail, setEditingEmail] = useState(!queryEmail);
  const [draftEmail, setDraftEmail] = useState(queryEmail);

  const [submitting, setSubmitting] = useState(false);
  const [otpResetKey, setOtpResetKey] = useState(0);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [cooldown, setCooldown] = useState(0);

  const type = queryType;
  const config = VERIFY_CONFIG[type] || VERIFY_CONFIG.signup;

  useEffect(() => {
    document.title = 'Enter Verification Code | Posho Creative';
  }, []);

  // Keep email in sync if the link query changes (e.g. from Forgot Password).
  useEffect(() => {
    setEmail(queryEmail);
    setDraftEmail(queryEmail);
    setEditingEmail(!queryEmail);
    setError('');
    setInfo('');
    setOtpResetKey((current) => current + 1);
  }, [queryEmail]);

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

  const maskedEmail = useMemo(() => email.trim(), [email]);
  const hasEmail = isValidEmail(email);

  const handleOtpCode = async (rawCode) => {
    if (
      submitting ||
      String(rawCode || '').length < OTP_CODE_LENGTH
    ) {
      return;
    }

    if (!isValidEmail(email)) {
      setError('Enter the email address that received the code.');
      setEditingEmail(true);
      setDraftEmail(email);
      setOtpResetKey((current) => current + 1);
      return;
    }

    const cleanCode = String(rawCode).replace(/\s+/g, '').trim();

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
      setError(mapAuthErrorToMessage(verifyError));
      setOtpResetKey((current) => current + 1);
      return;
    }

    setInfo(config.success);

    window.setTimeout(() => {
      if (!data?.session) {
        navigate('/login', { replace: true });
        return;
      }

      if (type === 'recovery') {
        navigate('/reset-password', { replace: true });
        return;
      }

      const target =
        nextRoutes?.customerBase ||
        portalRoutes?.customerBase ||
        '/login';

      navigate(target, { replace: true });
    }, 900);
  };

  const handleResend = async () => {
    if (cooldown > 0 || resending) {
      return;
    }

    if (!isValidEmail(email)) {
      setError('Enter your email first, then resend the code.');
      setEditingEmail(true);
      return;
    }

    setResending(true);
    setError('');
    setInfo('');

    try {
      let result;

      if (type === 'recovery') {
        result = await supabase.auth.resetPasswordForEmail(
          email.trim().toLowerCase(),
          {
            redirectTo: emailRedirectTo('/reset-password'),
          },
        );
      } else if (type === 'magiclink') {
        result = await supabase.auth.signInWithOtp({
          email: email.trim().toLowerCase(),
          options: {
            emailRedirectTo: emailRedirectTo('/email-verified'),
          },
        });
      } else {
        result = await supabase.auth.resend({
          type: type === 'email' ? 'email' : 'signup',
          email: email.trim().toLowerCase(),
          options: {
            emailRedirectTo: emailRedirectTo('/email-verified'),
          },
        });
      }

      if (result?.error) {
        setError(mapAuthErrorToMessage(result.error));
      } else {
        setInfo(
          `A fresh code was sent to ${email.trim()}. It can take up to a minute — check spam and promotions too.`,
        );
        setCooldown(AUTH_RESEND_COOLDOWN_SECONDS);
        setOtpResetKey((current) => current + 1);
      }
    } catch (caught) {
      setError(mapAuthErrorToMessage(caught));
    } finally {
      setResending(false);
    }
  };

  const saveEmail = (event) => {
    event?.preventDefault();
    if (!isValidEmail(draftEmail)) {
      setError('Enter a valid email address to continue.');
      return;
    }
    setEmail(draftEmail.trim());
    setEditingEmail(false);
    setError('');
    setInfo(`We will verify codes sent to ${draftEmail.trim()}.`);
    setOtpResetKey((current) => current + 1);
  };

  return (
    <main className="auth-page">
      <div className="auth-page-decoration auth-page-decoration-one" />
      <div className="auth-page-decoration auth-page-decoration-two" />

      <div className="container auth-layout">
        <section className="auth-brand-panel">
          <Link to="/" className="auth-brand-logo-link">
            <img
              src="/brand/posho-creative-logo.png"
              alt="Posho Creative"
              className="auth-brand-logo"
            />
          </Link>

          <div className="auth-brand-copy">
            <span>{config.brandEyebrow}</span>

            <h1>
              {config.brandTitle.split('.')[0]}.
              <br />
              inbox.
            </h1>

            <p>
              Enter the 8-digit code we emailed you. Codes expire
              quickly. Check spam and promotions if needed.
            </p>
          </div>

          <div className="auth-brand-footer">
            We see what you imagine.
          </div>
        </section>

        <section className="auth-form-panel">
          <div className="auth-form-card">
            <div className="auth-form-heading">
              <span className="section-kicker">{config.kicker}</span>

              <h2>{config.heading}</h2>

              <p>
                {config.description}
                {maskedEmail && hasEmail && (
                  <>
                    {' '}Sent to{' '}
                    <span className="auth-otp-email-pill">
                      {maskedEmail}
                    </span>
                  </>
                )}
              </p>
            </div>

            <div className="auth-form">
              {editingEmail ? (
                <form className="auth-field" onSubmit={saveEmail}>
                  <label htmlFor="otpEmail">Email address</label>

                  <div className="auth-input-wrapper">
                    <Icon name="mail" size={18} />

                    <input
                      id="otpEmail"
                      type="email"
                      autoComplete="email"
                      value={draftEmail}
                      onChange={(event) => {
                        setDraftEmail(event.target.value);
                        setError('');
                        setInfo('');
                      }}
                      placeholder="you@example.com"
                      autoFocus={!email}
                    />
                  </div>

                  <button
                    type="submit"
                    className="button button-primary auth-submit-button"
                  >
                    Continue
                    <Icon name="arrow_forward" size={18} />
                  </button>
                </form>
              ) : (
                <>
                  <div className="auth-resend-row">
                    <span className="auth-otp-email-pill">
                      <Icon name="mail" size={14} />
                      {maskedEmail}
                    </span>

                    <button
                      type="button"
                      className="auth-step-back"
                      onClick={() => {
                        setDraftEmail(email);
                        setEditingEmail(true);
                      }}
                    >
                      Use a different email
                    </button>
                  </div>

                  <OtpInput
                    length={OTP_CODE_LENGTH}
                    resetKey={otpResetKey}
                    disabled={submitting}
                    hasError={Boolean(error)}
                    onComplete={handleOtpCode}
                  />

                  <p className="auth-hint">
                    Didn&apos;t get it? Check spam and promotions,
                    wait a minute, then resend.
                  </p>
                </>
              )}

              {submitting && (
                <div className="auth-check-card">
                  <span className="auth-check-spinner" />
                  Verifying code...
                </div>
              )}

              {error && <div className="auth-error">{error}</div>}

              {info && !error && (
                <div className="auth-success">{info}</div>
              )}

              {!editingEmail && (
                <button
                  type="button"
                  className="button button-secondary auth-secondary-button"
                  disabled={resending || cooldown > 0}
                  onClick={handleResend}
                >
                  {cooldown > 0
                    ? `Resend in ${cooldown}s`
                    : resending
                      ? 'Sending...'
                      : 'Resend code'}
                </button>
              )}
            </div>

            <p className="auth-switch-copy">
              {type === 'recovery' ? (
                <>
                  Remembered it? <Link to="/login">Back to sign in</Link>
                </>
              ) : (
                <>
                  Code-only sign-in. <Link to="/login">Sign in with password</Link>
                  {' '}·{' '}
                  <Link to="/forgot-password">Reset password</Link>
                </>
              )}
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
