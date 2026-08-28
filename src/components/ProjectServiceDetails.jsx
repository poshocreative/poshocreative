import {
  CalendarDays,
  ExternalLink,
  Target,
  UsersRound,
  WalletCards,
} from 'lucide-react';

import {
  getSocialPlatform,
} from '../data/socialPlatforms';

import {
  SocialPlatformLogo,
} from './SocialPlatformGrid';

import {
  formatMoney,
} from '../lib/orders';

export default function ProjectServiceDetails({
  details,
}) {
  if (
    !details ||
    typeof details !== 'object' ||
    Object.keys(details).length === 0
  ) {
    return null;
  }

  const platform =
    getSocialPlatform(
      details.platform,
    );

  const targetUrl =
    details.profile_url ||
    details.destination_url;

  return (
    <section className="project-service-details">
      <div className="project-service-details-heading">
        <div>
          <span>SERVICE SPECIFICATION</span>
          <h3>Campaign details</h3>
        </div>

        {platform && (
          <div className="project-service-platform">
            <span className="social-platform-logo">
              <SocialPlatformLogo platform={platform} />
            </span>
            <strong>{platform.name}</strong>
          </div>
        )}
      </div>

      <div className="project-service-detail-grid">
        {details.quantity > 0 && (
          <div>
            <UsersRound size={17} />
            <span>Requested quantity</span>
            <strong>
              {Number(details.quantity).toLocaleString('en-NG')}
            </strong>
          </div>
        )}

        {details.duration_days > 0 && (
          <div>
            <CalendarDays size={17} />
            <span>Campaign duration</span>
            <strong>{details.duration_days} days</strong>
          </div>
        )}

        {details.media_budget_kobo > 0 && (
          <div>
            <WalletCards size={17} />
            <span>Requested media budget</span>
            <strong>{formatMoney(details.media_budget_kobo)}</strong>
          </div>
        )}

        {details.target_audience && (
          <div>
            <Target size={17} />
            <span>Target audience</span>
            <strong>{details.target_audience}</strong>
          </div>
        )}
      </div>

      {targetUrl && (
        <a
          href={targetUrl}
          target="_blank"
          rel="noreferrer"
          className="project-service-link"
        >
          <ExternalLink size={16} />
          Open campaign destination
        </a>
      )}

      {details.instructions && (
        <div className="project-service-instructions">
          <span>Campaign instructions</span>
          <p>{details.instructions}</p>
        </div>
      )}
    </section>
  );
}
