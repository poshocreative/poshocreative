/**
 * Full-color, multi-layer brand logos for supported social platforms.
 * Each logo is rendered on a branded background circle/rounded shape
 * so it stays visible on both light tiles and dark sections.
 */

function RoundedContainer({ color, children }) {
  return (
    <svg viewBox="0 0 36 36" width="22" height="22" aria-hidden="true" focusable="false">
      <rect x="0" y="0" width="36" height="36" rx="10" fill={color} />
      {children}
    </svg>
  );
}

export function InstagramLogo() {
  return (
    <svg viewBox="0 0 36 36" width="22" height="22" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="ig-bg" x1="0" y1="36" x2="36" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#feda75" />
          <stop offset="25%" stopColor="#fa7e1e" />
          <stop offset="50%" stopColor="#d62976" />
          <stop offset="75%" stopColor="#962fbf" />
          <stop offset="100%" stopColor="#4f5bd5" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="36" height="36" rx="10" fill="url(#ig-bg)" />
      <circle cx="18" cy="18" r="7.5" fill="none" stroke="#fff" strokeWidth="2.2" />
      <circle cx="25.2" cy="10.8" r="1.8" fill="#fff" />
    </svg>
  );
}

export function FacebookLogo() {
  return (
    <RoundedContainer color="#1877F2">
      <path
        d="M22.6 18.7l.8-5.2h-5v-3.4c0-1.4.7-2.8 2.9-2.8h2.3V2.6s-2.1-.4-4.1-.4c-4.2 0-6.9 2.5-6.9 7.1v4H11v5.2h3.5v12.6h4.2V18.7h2.9z"
        fill="#fff"
      />
    </RoundedContainer>
  );
}

export function TikTokLogo() {
  return (
    <RoundedContainer color="#000">
      {/* cyan shadow layer */}
      <path
        d="M24.1 8.8c-1.3-.8-2.2-2.2-2.4-3.8h-3.2v15.3c0 2-1.6 3.5-3.5 3.5s-3.5-1.6-3.5-3.5 1.6-3.5 3.5-3.5c.3 0 .7 0 1 .1V14c-.3 0-.7-.1-1-.1-3.9 0-7 3.1-7 7s3.1 7 7 7 7-3.1 7-7v-7.9c1.5 1.1 3.3 1.7 5.2 1.7v-3.2c-1.1 0-2.1-.3-3-1.2z"
        fill="#25F4EE"
        opacity="0.6"
        transform="translate(-0.8, -0.6)"
      />
      {/* magenta shadow layer */}
      <path
        d="M24.1 8.8c-1.3-.8-2.2-2.2-2.4-3.8h-3.2v15.3c0 2-1.6 3.5-3.5 3.5s-3.5-1.6-3.5-3.5 1.6-3.5 3.5-3.5c.3 0 .7 0 1 .1V14c-.3 0-.7-.1-1-.1-3.9 0-7 3.1-7 7s3.1 7 7 7 7-3.1 7-7v-7.9c1.5 1.1 3.3 1.7 5.2 1.7v-3.2c-1.1 0-2.1-.3-3-1.2z"
        fill="#FE2C55"
        opacity="0.6"
        transform="translate(0.8, 0.6)"
      />
      {/* main white glyph */}
      <path
        d="M24.1 8.8c-1.3-.8-2.2-2.2-2.4-3.8h-3.2v15.3c0 2-1.6 3.5-3.5 3.5s-3.5-1.6-3.5-3.5 1.6-3.5 3.5-3.5c.3 0 .7 0 1 .1V14c-.3 0-.7-.1-1-.1-3.9 0-7 3.1-7 7s3.1 7 7 7 7-3.1 7-7v-7.9c1.5 1.1 3.3 1.7 5.2 1.7v-3.2c-1.1 0-2.1-.3-3-1.2z"
        fill="#fff"
      />
    </RoundedContainer>
  );
}

export function YouTubeLogo() {
  return (
    <RoundedContainer color="#FF0000">
      <polygon points="14,10 24,18 14,26" fill="#fff" />
    </RoundedContainer>
  );
}

export function XLogo() {
  return (
    <RoundedContainer color="#000">
      <path
        d="M19.7 11.4l4.6-5.3h-1.1l-4 4.6L14.3 6.1h-3.7l4.8 7-4.8 7h1.1l4.2-4.9 3.4 4.9h3.7l-4.9-7.3 4.5-5.4zm-1.9 2.2l-.5-.7L12 7.2h1.7l3.4 4.9.5.7 4.4 6.3h-1.7l-3.5-5z"
        fill="#fff"
      />
    </RoundedContainer>
  );
}

export function LinkedInLogo() {
  return (
    <RoundedContainer color="#0A66C2">
      <path
        d="M13.5 15v5.5h-3V15h3zm-1.5-2.2a1.7 1.7 0 110-3.4 1.7 1.7 0 010 3.4zM15 15h2.9v3c0 .7-.1 1.4-.5 2-.4.5-.9.7-1.7.7-1.5 0-2.3-.9-2.3-2.7v-3H11v3.2c0 2.3 1.3 3.5 3.2 3.5 1 0 1.7-.3 2.2-.7v.7H20V15h-2.9v-.7c-.6.5-1.3.7-2.1.7-1.3 0-2.3-.9-2.3-2.3v-.7z"
        fill="#fff"
      />
    </RoundedContainer>
  );
}

export function SnapchatLogo() {
  return (
    <RoundedContainer color="#FFFC00">
      <path
        d="M18 9c-1 0-2.2.7-2.6 1.8-.1.3-.1.6-.1.9 0 .2-.2.3-.4.4-.3.1-.4.2-.4.3v.3c0 .1.1.2.2.2.4.1.8.2 1 .3.2.2.2.5.1.9-.1.3-.2.7-.4.9-.1.1-.1.4.1.4.4 0 .8-.1 1.2.2.2.2.5.6 1 .6s.8-.4 1-.6c.4-.3.8-.2 1.2-.2.2 0 .3-.3.1-.4-.2-.2-.3-.6-.4-.9-.1-.4-.1-.7.1-.9.2-.2.6-.2 1-.3.1 0 .2-.1.2-.2v-.3c0-.1-.1-.2-.4-.3-.2-.1-.3-.3-.4-.4 0-.3 0-.6-.1-.9C20.8 9.7 19.6 9 18 9z"
        fill="#000"
      />
    </RoundedContainer>
  );
}

export function TelegramLogo() {
  return (
    <RoundedContainer color="#26A5E4">
      <path
        d="M12.6 21.2l.9-3.2 11-7.3c.5-.3.9.1.7.5l-9.6 8.7-1.7-5.5 6.2-3.8c.5-.3.5-.3.1.1l-5 4.5 1.9 1z"
        fill="#fff"
      />
    </RoundedContainer>
  );
}

export function WhatsAppLogo() {
  return (
    <RoundedContainer color="#25D366">
      <path
        d="M21.8 17.7c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.7.1-.2.3-.8.9-.9 1.1-.2.2-.3.2-.6.1-.3-.1-1.2-.4-2.3-1.4-.8-.7-1.4-1.6-1.6-1.9-.2-.3 0-.5.1-.6.1-.1.3-.3.4-.5.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5-.1-.1-.7-1.6-.9-2.2-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.3-.3.3-1 1-1 2.4s1.1 2.8 1.2 3c.2.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.7-.7 2-1.4.3-.7.3-1.3.2-1.4-.1-.1-.3-.2-.6-.3z"
        fill="#fff"
      />
    </RoundedContainer>
  );
}

export function SpotifyLogo() {
  return (
    <RoundedContainer color="#1ED760">
      <path
        d="M20.5 14.5c-2.7-1.6-7.1-1.7-9.7-.9-.4.1-.9-.1-1-.6-.1-.4.1-.9.6-1 3-1 7.8-.8 10.9 1 .4.2.5.7.3 1.1-.2.3-.7.4-1.1.4z"
        fill="#000"
      />
      <path
        d="M19.5 17c-2.3-1.4-5.8-1.8-8.5-1-.3.1-.7-.1-.8-.5-.1-.3.1-.7.5-.8 3.1-1 6.9-.5 9.5 1.1.3.2.4.7.2 1-.2.3-.7.4-1 .2z"
        fill="#000"
      />
      <path
        d="M18.6 19.4c-1.9-1.1-4.2-1.4-6.9-.8-.3.1-.5-.1-.6-.4-.1-.3.1-.5.4-.6 3-.7 5.6-.3 7.7.9.2.1.3.5.1.7-.1.3-.5.4-.7.2z"
        fill="#000"
      />
    </RoundedContainer>
  );
}

export function SoundCloudLogo() {
  return (
    <RoundedContainer color="#FF5500">
      <path
        d="M12 22v-4.5c0-.3.2-.5.5-.5s.5.2.5.5V22c0 .3-.2.5-.5.5s-.5-.2-.5-.5zm2 0v-6c0-.3.2-.5.5-.5s.5.2.5.5v6c0 .3-.2.5-.5.5s-.5-.2-.5-.5zm2 0v-7.5c0-.3.2-.5.5-.5s.5.2.5.5V22c0 .3-.2.5-.5.5s-.5-.2-.5-.5zm2 0v-9c0-.3.2-.5.5-.5s.5.2.5.5v9c0 .3-.2.5-.5.5s-.5-.2-.5-.5zm2 .5c1.1 0 2-.9 2-2v-2c0-.3.2-.5.5-.5s.5.2.5.5v2c0 1.9-1.6 3.5-3.5 3.5H14c-.3 0-.5-.2-.5-.5s.2-.5.5-.5h6z"
        fill="#fff"
      />
    </RoundedContainer>
  );
}

export function TwitchLogo() {
  return (
    <RoundedContainer color="#9146FF">
      <path
        d="M14.5 16l2-2v-3h-2v5h2zm4 0l2-2v-3h-2v5h2zM11 12h10v8l-2.5 2.5H11V12z"
        fill="#fff"
      />
    </RoundedContainer>
  );
}

export const LOGO_COMPONENTS = {
  instagram: InstagramLogo,
  facebook: FacebookLogo,
  tiktok: TikTokLogo,
  youtube: YouTubeLogo,
  x: XLogo,
  linkedin: LinkedInLogo,
  snapchat: SnapchatLogo,
  telegram: TelegramLogo,
  whatsapp: WhatsAppLogo,
  spotify: SpotifyLogo,
  soundcloud: SoundCloudLogo,
  twitch: TwitchLogo,
};
