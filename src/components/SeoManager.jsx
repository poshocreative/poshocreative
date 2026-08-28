import {
  useEffect,
} from 'react';

import {
  useLocation,
} from 'react-router-dom';

const SITE_URL =
  'https://poshocreative.com.ng';

const DEFAULT_TITLE =
  'Posho Creative | Website Development, Branding, Social Media & Business Services';

const DEFAULT_DESCRIPTION =
  'Posho Creative provides professional website development, graphic design, branding, social media management, advertising, business support and creative solutions in Nigeria.';

const publicPages = {
  '/': {
    title:
      DEFAULT_TITLE,

    description:
      DEFAULT_DESCRIPTION,
  },

  '/services': {
    title:
      'Creative & Digital Services | Posho Creative',

    description:
      'Explore Posho Creative services including website development, branding, graphic design, social media management, advertising and business support.',
  },

  '/services/website-development': {
    title:
      'Website Development in Nigeria | Posho Creative',

    description:
      'Professional business websites, landing pages, e-commerce websites, web platforms and website redesign services from Posho Creative.',
  },

  '/services/graphic-design': {
    title:
      'Graphic Design & Branding | Posho Creative',

    description:
      'Professional logo design, brand identity, flyers, business cards, social media graphics and marketing materials.',
  },

  '/services/social-media-management': {
    title:
      'Social Media Management & Growth | Posho Creative',

    description:
      'Professional social media management, content planning, profile optimisation, growth campaigns and promotion.',
  },

  '/services/advertising': {
    title:
      'Advertising & Business Promotion | Posho Creative',

    description:
      'Professional advertising, social media campaigns, product promotion, business promotion and brand awareness services.',
  },

  '/services/business-services': {
    title:
      'Business Support & CAC Registration | Posho Creative',

    description:
      'Business management support, CAC registration assistance, business branding, promotion and digital business setup.',
  },

  '/services/creative-solutions': {
    title:
      'Creative Solutions & Brand Launch Services | Posho Creative',

    description:
      'Custom creative solutions for brand launches, business launches, campaigns, digital products and multi-service projects.',
  },

  '/about': {
    title:
      'About Posho Creative | We See What You Imagine',

    description:
      'Learn about Posho Creative and our approach to professional creative, digital and business solutions.',
  },

  '/contact': {
    title:
      'Contact Posho Creative',

    description:
      'Contact Posho Creative to discuss website development, branding, social media, advertising, business support or a custom project.',
  },
};

const privatePrefixes = [
  '/login',
  '/signup',
  '/email-verified',
  '/order',
  '/404',
];

function ensureMeta(
  selector,
  attributes,
) {
  let element =
    document.head.querySelector(
      selector,
    );

  if (!element) {
    element =
      document.createElement(
        'meta',
      );

    Object.entries(
      attributes,
    ).forEach(
      ([
        key,
        value,
      ]) => {
        element.setAttribute(
          key,
          value,
        );
      },
    );

    document.head.appendChild(
      element,
    );
  }

  return element;
}

function ensureCanonical() {
  let canonical =
    document.head.querySelector(
      'link[rel="canonical"]',
    );

  if (!canonical) {
    canonical =
      document.createElement(
        'link',
      );

    canonical.setAttribute(
      'rel',
      'canonical',
    );

    document.head.appendChild(
      canonical,
    );
  }

  return canonical;
}

export default function SeoManager() {
  const {
    pathname,
  } = useLocation();

  useEffect(() => {
    const privatePage =
      /^\/[wm]\/[a-f0-9]{64}(?:\/|$)/
        .test(
          pathname,
        ) ||
      privatePrefixes.some(
        (prefix) =>
          pathname ===
            prefix ||
          pathname.startsWith(
            `${prefix}/`,
          ),
      );

    const page =
      publicPages[pathname];

    const title =
      page?.title ||
      'Page Not Found | Posho Creative';

    const description =
      page?.description ||
      DEFAULT_DESCRIPTION;

    document.title =
      title;

    const descriptionMeta =
      ensureMeta(
        'meta[name="description"]',
        {
          name:
            'description',
        },
      );

    descriptionMeta.setAttribute(
      'content',
      description,
    );

    const robots =
      ensureMeta(
        'meta[name="robots"]',
        {
          name:
            'robots',
        },
      );

    robots.setAttribute(
      'content',
      privatePage ||
        !page
        ? 'noindex, nofollow'
        : 'index, follow, max-image-preview:large',
    );

    const canonical =
      ensureCanonical();

    const sharePath =
      privatePage
        ? '/'
        : pathname === '/'
          ? '/'
          : pathname;

    canonical.setAttribute(
      'href',
      `${SITE_URL}${sharePath}`,
    );

    const ogTitle =
      ensureMeta(
        'meta[property="og:title"]',
        {
          property:
            'og:title',
        },
      );

    ogTitle.setAttribute(
      'content',
      title,
    );

    const ogDescription =
      ensureMeta(
        'meta[property="og:description"]',
        {
          property:
            'og:description',
        },
      );

    ogDescription.setAttribute(
      'content',
      description,
    );

    const ogUrl =
      ensureMeta(
        'meta[property="og:url"]',
        {
          property:
            'og:url',
        },
      );

    ogUrl.setAttribute(
      'content',
      `${SITE_URL}${sharePath}`,
    );
  }, [
    pathname,
  ]);

  return null;
}
