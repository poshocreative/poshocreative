import {
  useEffect,
  useState,
} from 'react';

import {
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
} from 'lucide-react';

import {
  Link,
  Navigate,
  useNavigate,
  useSearchParams,
} from 'react-router-dom';

import { useAuth } from '../context/AuthContext';

export default function Login() {
  const {
    signIn,
    isAuthenticated,
    loading,
  } = useAuth();

  const navigate = useNavigate();

  const [searchParams] =
    useSearchParams();

  const next =
    searchParams.get('next') ||
    '/dashboard';

  const [form, setForm] = useState({
    email: '',
    password: '',
  });

  const [showPassword, setShowPassword] =
    useState(false);

  const [submitting, setSubmitting] =
    useState(false);

  const [error, setError] =
    useState('');

  useEffect(() => {
    document.title =
      'Sign In | Posho Creative';
  }, []);

  if (!loading && isAuthenticated) {
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
      !form.email.trim() ||
      !form.password
    ) {
      setError(
        'Enter your email and password.',
      );

      return;
    }

    setSubmitting(true);
    setError('');

    const {
      error: signInError,
    } = await signIn(form);

    setSubmitting(false);

    if (signInError) {
      if (
        signInError.message
          .toLowerCase()
          .includes('invalid login')
      ) {
        setError(
          'The email or password you entered is incorrect.',
        );
      } else if (
        signInError.message
          .toLowerCase()
          .includes(
            'email not confirmed',
          )
      ) {
        setError(
          'Confirm your email address before signing in.',
        );
      } else {
        setError(
          signInError.message ||
            'We could not sign you in.',
        );
      }

      return;
    }

    navigate(next, {
      replace: true,
    });
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
                Continue managing your
                Posho Creative projects.
              </p>
            </div>

            <form
              className="auth-form"
              onSubmit={handleSubmit}
            >
              <div className="auth-field">
                <label htmlFor="email">
                  Email address
                </label>

                <div className="auth-input-wrapper">
                  <Mail size={18} />

                  <input
                    id="email"
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
                  <LockKeyhole size={18} />

                  <input
                    id="password"
                    type={
                      showPassword
                        ? 'text'
                        : 'password'
                    }
                    autoComplete="current-password"
                    value={form.password}
                    onChange={(event) =>
                      updateField(
                        'password',
                        event.target.value,
                      )
                    }
                    placeholder="Enter your password"
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
                    aria-label={
                      showPassword
                        ? 'Hide password'
                        : 'Show password'
                    }
                  >
                    {showPassword ? (
                      <EyeOff size={17} />
                    ) : (
                      <Eye size={17} />
                    )}
                  </button>
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
                disabled={submitting}
              >
                {submitting
                  ? 'Signing in...'
                  : 'Sign in'}

                {!submitting && (
                  <ArrowRight size={18} />
                )}
              </button>
            </form>

            <p className="auth-switch-copy">
              New to Posho Creative?{' '}
              <Link
                to={`/signup?next=${encodeURIComponent(next)}`}
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