export default function BrandLoader({
  label = 'Preparing your workspace...',
  fullscreen = false,
}) {
  return (
    <div
      className={
        fullscreen
          ? 'brand-loader brand-loader-fullscreen'
          : 'brand-loader'
      }
      role="status"
      aria-live="polite"
    >
      <div className="brand-loader-mark">
        <span className="brand-loader-ring brand-loader-ring-one" />
        <span className="brand-loader-ring brand-loader-ring-two" />

        <div className="brand-loader-icon">
          <img
            src="/brand/posho-creative-icon.png"
            alt=""
          />
        </div>
      </div>

      <div className="brand-loader-copy">
        <strong>
          Posho Creative
        </strong>

        <span>
          {label}
        </span>
      </div>

      <div className="brand-loader-progress">
        <span />
      </div>
    </div>
  );
}