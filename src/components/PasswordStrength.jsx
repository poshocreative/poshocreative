import {
  PASSWORD_STRENGTH_LABELS,
  scorePassword,
} from '../lib/authEmail';

export default function PasswordStrength({
  password,
}) {
  if (!password) {
    return null;
  }

  const score = scorePassword(
    password,
  );

  return (
    <div
      className="password-meter"
      aria-live="polite"
    >
      <div
        className={`password-meter-track password-meter-${score}`}
      >
        {[0, 1, 2, 3].map(
          (segment) => (
            <span
              key={segment}
              className="password-meter-segment"
            />
          ),
        )}
      </div>

      <span className="password-meter-label">
        Password strength:{' '}
        {
          PASSWORD_STRENGTH_LABELS[
            score
          ]
        }
      </span>
    </div>
  );
}
