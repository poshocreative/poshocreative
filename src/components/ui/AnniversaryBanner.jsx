import Icon from './Icon';

/**
 * Celebrating one year of Posho Creative.
 * Landscape banner — short breadth, full width.
 */
export default function AnniversaryBanner({ variant = 'public' }) {
  return (
    <div className={`anniversary-banner anniversary-banner-${variant}`} role="status" aria-label="Posho Creative celebrating one year">
      <div className="anniversary-banner-inner">
        <span className="anniversary-banner-badge">
          <Icon name="star" size={14} />
          1 YEAR
        </span>

        <span className="anniversary-banner-text">
          Celebrating one year of turning imagination into results.
        </span>

        <span className="anniversary-banner-motto">
          We see what you imagine.
        </span>
      </div>
    </div>
  );
}
