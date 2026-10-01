import {
  useEffect,
  useState,
} from 'react';

import {
  useNavigate,
} from 'react-router-dom';

import Icon from '../components/ui/Icon';
import Link from '../components/PortalLink';
import PasswordStrength from '../components/PasswordStrength';

import { useAuth } from '../context/AuthContext';

import { supabase } from '../lib/supabase';

import {
  mapAuthErrorToMessage,
} from '../lib/authEmail';

function getCodeFromUrl() {
  const searchParams =
    new URLSearchParams(
      window.location.search,
    );

  return (
    searchParams.get('code') ||
    ''
  );
}

export default function ResetPassword() {
  const {
    updateAccountPassword,
  } = useAuth();

  const navigate = useNavigate();

  const [ready, setReady] =
    useState(false);

  const [linkValid, setLinkValid] =
    useState(false);

  const [checking, setChecking] =
    useState(true);

  const [password, setPassword] =
    useState('');

  const [confirmPassword, setConfirmPassword] =
    useState('');

  const [showPassword, setShowPassword] =
    useState(false);

  const [submitting, setSubmitting] =
    useState(false);

  const [error, setError] =
    useState('');

  const [done, setDone] =
    useState(false);

  useEffect(() => {
    document.title =
      'Set New Password | Posho Creative';
  }, []);

  useEffect(() => {
    let active = true;

    async function acceptRecoverySession() {
      try {
        const code =
          getCodeFromUrl();

        if (code) {
          const {
            error,
          } =
            await supabase.auth.exchangeCodeForSession(
              code,
            );

          if (!active) {
            return;
          }

          if (error) {
            setLinkValid(false);
            setError(
              mapAuthErrorToMessage(
                error,
              ),
            );
            setReady(true);
            setChecking(false);

            return;
          }

          setLinkValid(true);
          setReady(true);
          setChecking(false);

          return;
        }

        const {
          data,
        } =
          await supabase.auth.getSession();

        if (!active) {
          return;
        }

        if (data?.session) {
          setLinkValid(true);
        } else {
          setLinkValid(false);

          setError(
            'This reset link is invalid or has expired. Request a fresh link and open it within a few minutes.',
          );
        }
      } catch (caught) {
        if (!active) {
          return;
        }

        setLinkValid(false);

        setError(
          mapAuthErrorToMessage(
            caught,
          ),
        );
      } finally {
        if (active) {
          setReady(true);
          setChecking(false);
        }
      }
    }

    acceptRecoverySession();

    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (
    event,
  ) => {
    event.preventDefault();

    if (
      password.length < 8
    ) {
      setError(
        'Your new password must contain at least 8 characters.',
      );

      return;
    }

    if (
      password !==
      confirmPassword
    ) {
      setError(
        'Your passwords do not match.',
      );

      return;
    }

    setSubmitting(true);
    setError('');

    const { error: updateError } =
      await updateAccountPassword(
        password,
      );

    setSubmitting(false);

    if (updateError) {
      setError(
        mapAuthErrorToMessage(
          updateError,
        ),
      );

      return;
    }

    setDone(true);

    window.setTimeout(() => {
      navigate('/login', {
        replace: true,
      });
    }, 2600);
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
              SECURE RESET
            </span>

            <h1>
              Choose a<br />
              new password.
            </h1>

            <p>
              Use at least 8
              characters. After
              saving, sign in with
              your new password.
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
                New password
              </span>

              <h2>
                {done
                  ? 'Password updated.'
                  : checking
                    ? 'Checking reset link...'
                    : linkValid
                      ? 'Set your password.'
                      : 'Reset link issue.'}
              </h2>

              <p>
                {done
                  ? 'Taking you to sign in now.'
                  : checking
                    ? 'Validating your secure recovery session.'
                    : linkValid
                      ? 'Enter and confirm your new password.'
                      : 'That recovery link could not be confirmed.'}
              </p>
            </div>

            {checking ||
            !ready ? (
              <div className="auth-check-card">
                <span className="auth-check-spinner" />
                Validating reset link...
              </div>
            ) : done ? (
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
                Your password was
                changed successfully.
                Redirecting to sign
                in...
              </div>
            ) : linkValid ? (
              <form
                className="auth-form"
                onSubmit={
                  handleSubmit
                }
              >
                <div className="auth-field">
                  <label htmlFor="newPassword">
                    New password
                  </label>

                  <div className="auth-input-wrapper">
                    <Icon
                      name="lock"
                      size={18}
                    />

                    <input
                      id="newPassword"
                      type={
                        showPassword
                          ? 'text'
                          : 'password'
                      }
                      autoComplete="new-password"
                      value={password}
                      onChange={(
                        event,
                      ) => {
                        setPassword(
                          event
                            .target
                            .value,
                        );

                        setError('');
                      }}
                      placeholder="Minimum 8 characters"
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
                      <Icon
                        name={
                          showPassword
                            ? 'visibility_off'
                            : 'visibility'
                        }
                        size={17}
                      />
                    </button>
                  </div>
                </div>

                <div className="auth-field">
                  <label htmlFor="confirmNewPassword">
                    Confirm new password
                  </label>

                  <input
                    id="confirmNewPassword"
                    type={
                      showPassword
                        ? 'text'
                        : 'password'
                    }
                    autoComplete="new-password"
                    value={
                      confirmPassword
                    }
                    onChange={(
                      event,
                    ) => {
                      setConfirmPassword(
                        event
                          .target
                          .value,
                      );

                      setError('');
                    }}
                    placeholder="Repeat new password"
                  />
                </div>

                <PasswordStrength
                  password={
                    password
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
                  disabled={
                    submitting
                  }
                >
                  {submitting
                    ? 'Saving...'
                    : 'Save new password'}
                </button>
              </form>
            ) : (
              <>
                {error && (
                  <div className="auth-error">
                    {error}
                  </div>
                )}

                <Link
                  to="/forgot-password"
                  className="button button-primary auth-submit-button"
                >
                  Request fresh link
                  <Icon
                    name="arrow_forward"
                    size={18}
                  />
                </Link>
              </>
            )}

            <p className="auth-switch-copy">
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
