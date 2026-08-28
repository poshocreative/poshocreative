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
  return `https://cdn.simpleicons.org/${platform.icon}/${platform.color}`;
}
