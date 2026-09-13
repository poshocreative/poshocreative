import Icon from './ui/Icon';
import {
  socialPlatforms,
  socialPlatformLogoUrl,
  LINKEDIN_PATH,
} from '../data/socialPlatforms';

export function SocialPlatformLogo({ platform }) {
  if (platform.id === 'other') {
    return (
      <Icon
        name="add"
        size={20}
        color="#6C2BD9"
        aria-hidden="true"
      />
    );
  }

  if (platform.id === 'linkedin') {
    return (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="#0A66C2" aria-hidden="true">
        <path d={LINKEDIN_PATH} />
      </svg>
    );
  }

  return (
    <img
      src={socialPlatformLogoUrl(platform)}
      alt={platform.name}
    />
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
