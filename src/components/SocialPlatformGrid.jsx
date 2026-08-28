import {
  socialPlatformLogoUrl,
  socialPlatforms,
} from '../data/socialPlatforms';

import {
  Plus,
} from 'lucide-react';

export function SocialPlatformLogo({
  platform,
}) {
  if (platform.id === 'linkedin') {
    return (
      <svg
        viewBox="0 0 24 24"
        width="21"
        height="21"
        fill="#0A66C2"
        aria-hidden="true"
      >
        <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12ZM7.12 20.45H3.56V9h3.56v11.45ZM22.23 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.23 0Z" />
      </svg>
    );
  }

  if (platform.id === 'other') {
    return (
      <Plus
        size={22}
        color="#6C2BD9"
        aria-hidden="true"
      />
    );
  }

  return (
    <>
      <span className="social-platform-logo-fallback" aria-hidden="true">
        {platform.name.slice(0, 1)}
      </span>
      <img
        src={socialPlatformLogoUrl(platform)}
        alt=""
        loading="lazy"
        onError={(event) => {
          event.currentTarget.style.display = 'none';
        }}
      />
    </>
  );
}

export default function SocialPlatformGrid({
  value = '',
  onChange,
  interactive = true,
  compact = false,
}) {
  return (
    <div
      className={`social-platform-grid ${compact ? 'social-platform-grid-compact' : ''}`}
      aria-label="Supported social and entertainment platforms"
    >
      {socialPlatforms.map((platform) => {
        const selected = value === platform.id;
        const Component = interactive ? 'button' : 'div';

        return (
          <Component
            key={platform.id}
            {...(interactive
              ? {
                  type: 'button',
                  onClick: () => onChange?.(platform.id),
                  'aria-pressed': selected,
                }
              : {})}
            className={`social-platform-option ${selected ? 'selected' : ''}`}
          >
            <span className="social-platform-logo">
              <SocialPlatformLogo platform={platform} />
            </span>
            <strong>{platform.name}</strong>
          </Component>
        );
      })}
    </div>
  );
}
