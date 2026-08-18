import {
  useEffect,
} from 'react';

import {
  useLocation,
} from 'react-router-dom';

const revealSelectors = [
  '.hero-copy',
  '.hero-visual',
  '.section-heading',
  '.service-card',
  '.why-copy',
  '.why-card',
  '.process-item',
  '.final-cta',

  '.services-hero-grid > *',
  '.services-directory-heading',
  '.service-directory-item',
  '.services-cross-card',
  '.service-page-cta',

  '.service-detail-hero-copy',
  '.service-detail-hero-visual',
  '.capability-item',
  '.outcome-card',
  '.service-process-item',
  '.service-order-banner',
  '.other-service-card',

  '.simple-page .container',

  '.auth-brand-panel',
  '.auth-form-card',

  '.workspace-view-heading',
  '.workspace-stat-card',
  '.workspace-panel',
  '.workspace-highlight-card',
  '.workspace-file-card',
  '.workspace-payment-row',
  '.workspace-notification',

  '.order-header-copy',
  '.order-progress',
  '.order-main-card',
  '.order-summary-card',
];

export default function GlobalMotion() {
  const {
    pathname,
  } = useLocation();

  useEffect(() => {
    const prefersReducedMotion =
      window.matchMedia(
        '(prefers-reduced-motion: reduce)',
      ).matches;

    const elements =
      document.querySelectorAll(
        revealSelectors.join(','),
      );

    if (prefersReducedMotion) {
      elements.forEach(
        (element) => {
          element.classList.add(
            'motion-visible',
          );
        },
      );

      return undefined;
    }

    elements.forEach(
      (element, index) => {
        element.classList.add(
          'motion-reveal',
        );

        element.style.setProperty(
          '--motion-index',
          String(index % 6),
        );
      },
    );

    const observer =
      new IntersectionObserver(
        (entries) => {
          entries.forEach(
            (entry) => {
              if (
                entry.isIntersecting
              ) {
                entry.target.classList.add(
                  'motion-visible',
                );

                observer.unobserve(
                  entry.target,
                );
              }
            },
          );
        },
        {
          threshold: 0.12,

          rootMargin:
            '0px 0px -55px 0px',
        },
      );

    elements.forEach(
      (element) => {
        observer.observe(
          element,
        );
      },
    );

    return () => {
      observer.disconnect();
    };
  }, [pathname]);

  return null;
}