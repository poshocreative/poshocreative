import Icon from './ui/Icon';

import { LOGO_COMPONENTS } from '../data/socialLogos';
import { socialPlatforms } from '../data/socialPlatforms';

export function SocialPlatformLogo({ platform }) {
  if (platform.id === 'other') {
    return <Icon name="add" size={22} color="#6C2BD9" aria-hidden="true" />;
  }

  const LogoComponent = LOGO_COMPONENTS[platform.id];

  if (!LogoComponent) {
    return (
      <span className="social-platform-logo-fallback" aria-hidden="true">
        {platform.name.slice(0, 1)}
      </span>
    );
  }

  return <LogoComponent />;
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
