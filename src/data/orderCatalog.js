import {
  BriefcaseBusiness,
  Globe2,
  Megaphone,
  Palette,
  Share2,
  Sparkles,
} from 'lucide-react';

export const orderCatalog = [
  {
    slug: 'website-development',
    title: 'Website Development',
    description:
      'Websites, landing pages, online platforms and digital experiences.',
    icon: Globe2,
    projectTypes: [
      {
        id: 'business-website',
        label: 'Business Website',
        description:
          'A professional website for a company, brand or organisation.',
      },
      {
        id: 'ecommerce-website',
        label: 'E-commerce Website',
        description:
          'An online store for selling products or services.',
      },
      {
        id: 'landing-page',
        label: 'Landing Page',
        description:
          'A focused page for campaigns, products, services or lead generation.',
      },
      {
        id: 'portfolio-website',
        label: 'Portfolio Website',
        description:
          'A professional website for showcasing work, skills or projects.',
      },
      {
        id: 'web-platform',
        label: 'Web Platform',
        description:
          'A more advanced web application, portal or service platform.',
      },
      {
        id: 'website-redesign',
        label: 'Website Redesign',
        description:
          'Improve or completely rebuild an existing website.',
      },
      {
        id: 'website-maintenance',
        label: 'Website Maintenance',
        description:
          'Updates, fixes, improvements and ongoing website support.',
      },
      {
        id: 'custom-web-project',
        label: 'Something Else',
        description:
          'A custom website or digital product with unique requirements.',
      },
    ],
  },

  {
    slug: 'graphic-design',
    title: 'Graphic Design & Branding',
    description:
      'Professional visual design for brands, campaigns and businesses.',
    icon: Palette,
    projectTypes: [
      {
        id: 'logo-design',
        label: 'Logo Design',
        description:
          'A professional logo designed around your identity.',
      },
      {
        id: 'brand-identity',
        label: 'Brand Identity',
        description:
          'A more complete visual identity for your business or organisation.',
      },
      {
        id: 'flyer-design',
        label: 'Flyer Design',
        description:
          'Professional promotional or informational flyer design.',
      },
      {
        id: 'business-card',
        label: 'Business Card',
        description:
          'Professional business card design for print or digital use.',
      },
      {
        id: 'banner-poster',
        label: 'Banner or Poster',
        description:
          'Large-format promotional, event or advertising artwork.',
      },
      {
        id: 'social-media-design',
        label: 'Social Media Graphics',
        description:
          'Branded graphics for social media posts and campaigns.',
      },
      {
        id: 'marketing-materials',
        label: 'Marketing Materials',
        description:
          'Promotional visual materials for your business or campaign.',
      },
      {
        id: 'custom-design',
        label: 'Something Else',
        description:
          'A different type of visual design project.',
      },
    ],
  },

  {
    slug: 'social-media-management',
    title: 'Social Media Management & Growth',
    description:
      'Management, content support and growth services for social platforms.',
    icon: Share2,
    projectTypes: [
      {
        id: 'account-management',
        label: 'Account Management',
        description:
          'Ongoing management of one or more social media accounts.',
      },
      {
        id: 'content-planning',
        label: 'Content Planning',
        description:
          'Strategy and planning for what your brand should publish.',
      },
      {
        id: 'profile-optimisation',
        label: 'Profile Optimisation',
        description:
          'Improve how your social media account is presented.',
      },
      {
        id: 'growth-campaign',
        label: 'Growth Campaign',
        description:
          'A campaign focused on improving visibility and audience growth.',
      },
      {
        id: 'engagement-campaign',
        label: 'Engagement Campaign',
        description:
          'Support for increasing engagement around your content.',
      },
      {
        id: 'social-promotion',
        label: 'Social Media Promotion',
        description:
          'Promotional support for a product, service, page or campaign.',
      },
      {
        id: 'social-consultation',
        label: 'Social Media Consultation',
        description:
          'Professional guidance for improving your social media strategy.',
      },
      {
        id: 'custom-social',
        label: 'Something Else',
        description:
          'Tell us exactly what you need for your social media presence.',
      },
    ],
  },

  {
    slug: 'advertising',
    title: 'Advertising & Promotion',
    description:
      'Digital campaigns and promotional services designed around your goals.',
    icon: Megaphone,
    projectTypes: [
      {
        id: 'social-media-ads',
        label: 'Social Media Advertising',
        description:
          'Advertising campaigns across relevant social media channels.',
      },
      {
        id: 'business-promotion',
        label: 'Business Promotion',
        description:
          'Promotional support designed to increase business visibility.',
      },
      {
        id: 'product-promotion',
        label: 'Product Promotion',
        description:
          'Campaigns built around promoting a specific product.',
      },
      {
        id: 'service-promotion',
        label: 'Service Promotion',
        description:
          'Campaigns designed to create awareness for a service.',
      },
      {
        id: 'brand-awareness',
        label: 'Brand Awareness Campaign',
        description:
          'Campaigns focused on making more people aware of your brand.',
      },
      {
        id: 'campaign-setup',
        label: 'Campaign Setup',
        description:
          'Professional setup and preparation of your advertising campaign.',
      },
      {
        id: 'promotion-strategy',
        label: 'Promotion Strategy',
        description:
          'A strategic promotional direction for your business or project.',
      },
      {
        id: 'custom-advertising',
        label: 'Something Else',
        description:
          'A custom advertising or promotional project.',
      },
    ],
  },

  {
    slug: 'business-services',
    title: 'Business Services',
    description:
      'Business support, management, registration assistance and promotion.',
    icon: BriefcaseBusiness,
    projectTypes: [
      {
        id: 'cac-registration',
        label: 'CAC Registration Assistance',
        description:
          'Support with preparing and processing a business registration request.',
      },
      {
        id: 'business-management',
        label: 'Business Management Support',
        description:
          'Practical support for organising and managing business activities.',
      },
      {
        id: 'business-branding',
        label: 'Business Branding',
        description:
          'Build a more professional and consistent identity for your business.',
      },
      {
        id: 'business-promotion',
        label: 'Business Promotion',
        description:
          'Promotional support designed around your business goals.',
      },
      {
        id: 'digital-business-setup',
        label: 'Digital Business Setup',
        description:
          'Build your website, social presence and other digital essentials.',
      },
      {
        id: 'business-profile',
        label: 'Business Profile',
        description:
          'Professional presentation material for your company or business.',
      },
      {
        id: 'business-consultation',
        label: 'Business Consultation',
        description:
          'Discuss your business needs and identify suitable next steps.',
      },
      {
        id: 'custom-business',
        label: 'Something Else',
        description:
          'A business requirement that does not fit the listed categories.',
      },
    ],
  },

  {
    slug: 'creative-solutions',
    title: 'Custom Creative Solutions',
    description:
      'For ideas that combine multiple services or require something different.',
    icon: Sparkles,
    projectTypes: [
      {
        id: 'brand-launch',
        label: 'Brand Launch',
        description:
          'Bring together branding, digital presence and promotion.',
      },
      {
        id: 'business-launch',
        label: 'Business Launch',
        description:
          'Creative and business support for launching something new.',
      },
      {
        id: 'multi-service-project',
        label: 'Multi-Service Project',
        description:
          'Combine several Posho Creative services under one project.',
      },
      {
        id: 'creative-campaign',
        label: 'Creative Campaign',
        description:
          'A campaign requiring multiple creative and promotional elements.',
      },
      {
        id: 'digital-product',
        label: 'Digital Product',
        description:
          'A custom digital experience, concept or online product.',
      },
      {
        id: 'creative-consultation',
        label: 'Creative Consultation',
        description:
          'Discuss an idea and determine the best way to execute it.',
      },
      {
        id: 'special-project',
        label: 'Special Project',
        description:
          'A unique project requiring a tailored approach.',
      },
      {
        id: 'custom-project',
        label: 'Something Else',
        description:
          'Tell us what you imagine and we will review the idea.',
      },
    ],
  },
];

export const budgetOptions = [
  {
    id: 'not-sure',
    label: 'Not sure yet',
    description:
      'I want Posho Creative to help me determine the right budget.',
  },
  {
    id: 'under-50k',
    label: 'Below ₦50,000',
    description:
      'For smaller creative tasks and focused service requests.',
  },
  {
    id: '50k-150k',
    label: '₦50,000 – ₦150,000',
    description:
      'Suitable for many standard creative and digital projects.',
  },
  {
    id: '150k-500k',
    label: '₦150,000 – ₦500,000',
    description:
      'For larger projects with broader requirements.',
  },
  {
    id: '500k-plus',
    label: 'Above ₦500,000',
    description:
      'For advanced, multi-service or more complex projects.',
  },
];

export const timelineOptions = [
  {
    id: 'flexible',
    label: 'Flexible',
    description:
      'There is no strict completion date yet.',
  },
  {
    id: 'one-week',
    label: 'Within 1 week',
    description:
      'The project is relatively urgent.',
  },
  {
    id: 'two-four-weeks',
    label: '2 – 4 weeks',
    description:
      'A normal project timeline with room for proper execution.',
  },
  {
    id: 'one-three-months',
    label: '1 – 3 months',
    description:
      'Suitable for larger or more advanced projects.',
  },
  {
    id: 'specific-date',
    label: 'I have a specific deadline',
    description:
      'I will provide the required completion date.',
  },
];

export const contactMethods = [
  {
    id: 'whatsapp',
    label: 'WhatsApp',
  },
  {
    id: 'email',
    label: 'Email',
  },
  {
    id: 'phone',
    label: 'Phone Call',
  },
];

export function getOrderService(slug) {
  return orderCatalog.find(
    (service) => service.slug === slug,
  );
}