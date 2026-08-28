import {
  useAuth,
} from '../context/AuthContext';

export default function SignOutTransition() {
  const {
    signingOut,
  } =
    useAuth();

  if (!signingOut) {
    return null;
  }

  return (
    <div
      className="signout-transition"
      role="status"
      aria-live="assertive"
      aria-atomic="true"
    >
      <div className="signout-transition__card">
        <div className="signout-transition__brand">
          <img
            src="/brand/posho-creative-icon.png"
            alt=""
          />

          <span>
            POSHO CREATIVE
          </span>
        </div>

        <div
          className="signout-transition__spinner"
          aria-hidden="true"
        >
          <span />
        </div>

        <h2>
          Signing you out
        </h2>

        <p>
          Closing your secure workspace…
        </p>
      </div>
    </div>
  );
}
