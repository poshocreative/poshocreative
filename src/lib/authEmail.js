import { supabase } from './supabase';

// Public display sender for all auth mail. The mailbox that *logs in* to
// Gmail SMTP stays workspace-admin (dashboard > Auth > SMTP > Username),
// but the address users *see* (dashboard > Auth > SMTP > Sender email)
// must be this no-reply address, with Sender name "Posho Creative".
// It must also exist as a verified "Send mail as" alias inside the
// workspace-admin Gmail settings, otherwise Gmail rewrites the From back.
export const NO_REPLY_EMAIL =
  'no-reply@poshocreative.com.ng';

export const AUTH_RESEND_COOLDOWN_SECONDS = 60;

export function getAppOrigin() {
  if (
    typeof window !== 'undefined' &&
    window.location?.origin
  ) {
    return window.location.origin;
  }

  return (
    import.meta.env.VITE_SITE_URL ||
    'https://poshocreative.com.ng'
  );
}

export function emailRedirectTo(path) {
  const cleanPath = String(path || '').startsWith('/')
    ? String(path || '')
    : `/${String(path || '')}`;

  return `${getAppOrigin()}${cleanPath}`;
}

export function normalizeEmail(email) {
  return String(email || '')
    .trim()
    .toLowerCase();
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    normalizeEmail(email),
  );
}

export const PASSWORD_STRENGTH_LABELS = [
  'Too short',
  'Weak',
  'Fair',
  'Good',
  'Strong',
];

export function scorePassword(password) {
  const value = String(
    password || '',
  );

  if (!value) {
    return 0;
  }

  let score = 0;

  if (value.length >= 8) {
    score += 1;
  }

  if (
    /[a-z]/.test(value) &&
    /[A-Z]/.test(value)
  ) {
    score += 1;
  }

  if (/\d/.test(value)) {
    score += 1;
  }

  if (
    /[^A-Za-z0-9]/.test(value) ||
    value.length >= 12
  ) {
    score += 1;
  }

  return Math.min(
    4,
    Math.max(1, score),
  );
}

export function mapAuthErrorToMessage(error) {
  const raw =
    error?.message || 'We could not complete that request.';

  const message = raw.toLowerCase();

  if (
    message.includes('invalid login') ||
    message.includes('invalid_credentials')
  ) {
    return 'The email or password you entered is incorrect.';
  }

  if (
    message.includes('email not confirmed') ||
    message.includes('email_not_confirmed')
  ) {
    return 'Confirm your email address before signing in. Check your inbox for the verification email.';
  }

  if (
    message.includes('user already registered') ||
    message.includes('already registered') ||
    message.includes('already exists')
  ) {
    return 'An account already exists with this email. Try signing in or resetting your password instead.';
  }

  if (
    message.includes('password should be') ||
    message.includes('weak password')
  ) {
    return 'Your password is too weak. Use at least 8 characters with a mix of letters and numbers.';
  }

  if (
    message.includes('rate limit') ||
    message.includes('too many') ||
    message.includes('email rate limit exceeded')
  ) {
    return 'Too many email requests. Wait about a minute, check your inbox and spam folder, then try again.';
  }

  if (
    message.includes('expired') ||
    message.includes('invalid') ||
    message.includes('token')
  ) {
    return 'That link or code has expired or was already used. Request a fresh email and try again.';
  }

  if (
    message.includes('otp') &&
    message.includes('expired')
  ) {
    return 'That code has expired. Request a new code and try again.';
  }

  return raw;
}

export async function requestSignupConfirmation(email) {
  const normalized = normalizeEmail(email);

  return supabase.auth.resend({
    type: 'signup',
    email: normalized,
    options: {
      emailRedirectTo: emailRedirectTo('/email-verified'),
    },
  });
}

export async function requestPasswordResetEmail(email) {
  const normalized = normalizeEmail(email);

  return supabase.auth.resetPasswordForEmail(normalized, {
    redirectTo: emailRedirectTo('/reset-password'),
  });
}

export async function requestSignInOtp(email) {
  const normalized = normalizeEmail(email);

  return supabase.auth.signInWithOtp({
    email: normalized,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: emailRedirectTo('/email-verified'),
    },
  });
}

export async function verifyEmailOtp({
  email,
  token,
  type,
}) {
  return supabase.auth.verifyOtp({
    email: normalizeEmail(email),
    token: String(token || '')
      .trim()
      .replace(/\s+/g, ''),
    type,
  });
}
