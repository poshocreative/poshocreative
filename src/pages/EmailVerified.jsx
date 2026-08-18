import {
  useEffect,
  useState,
} from 'react';

import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  LoaderCircle,
  ShieldCheck,
} from 'lucide-react';

import {
  Link,
} from 'react-router-dom';

import {
  useAuth,
} from '../context/AuthContext';

import {
  supabase,
} from '../lib/supabase';

function getRedirectError() {
  const searchParams =
    new URLSearchParams(
      window.location.search,
    );

  const hashParams =
    new URLSearchParams(
      window.location.hash
        .replace(/^#/, ''),
    );

  const errorDescription =
    searchParams.get(
      'error_description',
    ) ||
    hashParams.get(
      'error_description',
    );

  const errorCode =
    searchParams.get(
      'error_code',
    ) ||
    hashParams.get(
      'error_code',
    );

  if (!errorDescription) {
    return null;
  }

  return {
    code: errorCode,
    message:
      decodeURIComponent(
        errorDescription,
      ),
  };
}

export default function EmailVerified() {
  const {
    user,
    loading,
  } = useAuth();

  const [status, setStatus] =
    useState('checking');

  const [message, setMessage] =
    useState('');

  useEffect(() => {
    document.title =
      'Email Verified | Posho Creative';
  }, []);

  useEffect(() => {
    let active = true;

    const checkVerification =
      async () => {
        const redirectError =
          getRedirectError();

        if (redirectError) {
          if (!active) {
            return;
          }

          setStatus('error');

          setMessage(
            redirectError.message ||
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
          const {
            data,
            error,
          } =
            await supabase.auth
              .getSession();

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
            data?.session?.user;

          if (
            confirmedUser
              ?.email_confirmed_at
          ) {
            setStatus('success');

            return;
          }

          setStatus('error');

          setMessage(
            'This verification link could not be confirmed. It may have expired or already been used.',
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
                  <LoaderCircle
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
                  <CheckCircle2
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
                <ShieldCheck
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

                  <ArrowRight
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
                  <CircleAlert
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

              <div className="verification-actions">
                <Link
                  to="/login"
                  className="button button-primary"
                >
                  Try signing in

                  <ArrowRight
                    size={18}
                  />
                </Link>

                <Link
                  to="/signup"
                  className="button button-secondary"
                >
                  Create account
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