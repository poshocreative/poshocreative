export const socialPlatforms = [
  {
    id: 'instagram',
    name: 'Instagram',
    color: 'E4405F',
    icon: 'instagram',
  },
  {
    id: 'facebook',
    name: 'Facebook',
    color: '0866FF',
    icon: 'facebook',
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    color: '000000',
    icon: 'tiktok',
  },
  {
    id: 'youtube',
    name: 'YouTube',
    color: 'FF0000',
    icon: 'youtube',
  },
  {
    id: 'x',
    name: 'X',
    color: '000000',
    icon: 'x',
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    color: '0A66C2',
    icon: 'linkedin',
  },
  {
    id: 'snapchat',
    name: 'Snapchat',
    color: '111111',
    icon: 'snapchat',
  },
  {
    id: 'telegram',
    name: 'Telegram',
    color: '26A5E4',
    icon: 'telegram',
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    color: '25D366',
    icon: 'whatsapp',
  },
  {
    id: 'spotify',
    name: 'Spotify',
    color: '1ED760',
    icon: 'spotify',
  },
  {
    id: 'soundcloud',
    name: 'SoundCloud',
    color: 'FF5500',
    icon: 'soundcloud',
  },
  {
    id: 'twitch',
    name: 'Twitch',
    color: '9146FF',
    icon: 'twitch',
  },
  {
    id: 'other',
    name: 'Other platform',
    color: '6C2BD9',
    icon: 'addthis',
  },
];

export function getSocialPlatform(platformId) {
  return socialPlatforms.find((platform) => platform.id === platformId);
}

export function socialPlatformLogoUrl(platform) {
  if (platform.id === 'linkedin') return null;
  return `https://cdn.simpleicons.org/${platform.icon}`;
}

export const LINKEDIN_PATH = 'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z';
