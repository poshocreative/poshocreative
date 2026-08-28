import {
  useEffect,
  useState,
} from 'react';

import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  Phone,
  UserRound,
} from 'lucide-react';

import {
  Navigate,
  useSearchParams,
} from 'react-router-dom';

import Link from '../components/PortalLink';

import { useAuth } from '../context/AuthContext';

export default function Signup() {
  const {
    signUp,
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

  useEffect(() => {
    document.title =
      'Create Account | Posho Creative';
  }, []);

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
        signUpError.message ||
          'We could not create your account.',
      );

      return;
    }

    if (data?.session) {
      window.location.assign(next);
      return;
    }

    setConfirmationSent(true);
  };

  if (confirmationSent) {
    return (
      <main className="auth-page auth-confirmation-page">
        <div className="container auth-confirmation-container">
          <div className="auth-confirmation-card">
            <div className="auth-confirmation-icon">
              <CheckCircle2 size={34} />
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
              We sent a confirmation
              link to{' '}
              <strong>
                {form.email}
              </strong>
              . Open the email and
              confirm your account before
              signing in.
            </p>

            <Link
              to={`/login?next=${encodeURIComponent(next)}`}
              className="button button-primary"
            >
              Go to sign in
              <ArrowRight size={18} />
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
                    <UserRound size={18} />

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
                    <Phone size={18} />

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
                  <Mail size={18} />

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
                    <LockKeyhole size={18} />

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
                        <EyeOff size={17} />
                      ) : (
                        <Eye size={17} />
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
                  <ArrowRight size={18} />
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
