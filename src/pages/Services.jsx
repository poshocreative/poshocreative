import { Link } from 'react-router-dom';

import {
  ArrowRight,
  ArrowUpRight,
  Layers3,
} from 'lucide-react';

import { services } from '../data/services';
import SocialPlatformGrid from '../components/SocialPlatformGrid';

export default function Services() {
  return (
    <main className="services-page">
      <section className="services-hero">
        <div className="container services-hero-grid">
          <div>
            <div className="eyebrow">
              <span className="eyebrow-dot" />
              Our services
            </div>

            <h1>
              Ideas need more than
              <span> imagination.</span>
            </h1>
          </div>

          <div className="services-hero-side">
            <p>
              Posho Creative brings creative, digital,
              promotional and business services together so that
              ideas can move from concept to execution.
            </p>

            <Link
              to="/order"
              className="button button-primary"
            >
              Start a project
              <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      <section className="services-directory">
        <div className="container">
          <div className="services-directory-heading">
            <div>
              <span className="section-kicker">
                Explore our capabilities
              </span>

              <h2>
                Choose what you
                <br />
                want to create.
              </h2>
            </div>

            <div className="directory-count">
              <Layers3 size={20} />

              <span>
                {services.length} core service categories
              </span>
            </div>
          </div>

          <div className="service-directory-list">
            {services.map((service) => {
              const Icon = service.icon;

              return (
                <Link
                  key={service.slug}
                  to={`/services/${service.slug}`}
                  className="service-directory-item"
                >
                  <div className="directory-number">
                    {service.number}
                  </div>

                  <div className="directory-icon">
                    <Icon size={24} />
                  </div>

                  <div className="directory-copy">
                    <h3>
                      {service.title}
                    </h3>

                    <p>
                      {service.description}
                    </p>
                  </div>

                  <div className="directory-arrow">
                    <ArrowUpRight size={22} />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="social-commerce-showcase">
        <div className="container social-commerce-showcase-inner">
          <div className="social-commerce-copy">
            <span className="section-kicker">SOCIAL & ENTERTAINMENT GROWTH</span>
            <h2>
              Campaigns for the platforms your audience already uses.
            </h2>
            <p>
              Request followers, page followers, likes, comments, subscribers,
              views and promotional campaigns. Every request is reviewed by
              Management before a secure payment is enabled.
            </p>

            <div className="social-commerce-actions">
              <Link
                to="/order?service=social-media-management"
                className="button button-primary"
              >
                Order social growth
                <ArrowRight size={18} />
              </Link>

              <Link
                to="/order?service=advertising"
                className="button button-secondary"
              >
                Plan an ad campaign
              </Link>
            </div>
          </div>

          <div className="social-commerce-platforms">
            <span>SUPPORTED PLATFORMS</span>
            <SocialPlatformGrid
              interactive={false}
              compact
            />
          </div>
        </div>
      </section>

      <section className="services-cross-section">
        <div className="container services-cross-grid">
          <article className="services-cross-card services-cross-main">
            <span>
              ONE PARTNER
            </span>

            <h2>
              Creative.
              <br />
              Digital.
              <br />
              Business.
            </h2>
          </article>

          <article className="services-cross-card">
            <span>
              CONNECTED SERVICES
            </span>

            <h3>
              One project can need more than one skill.
            </h3>

            <p>
              A new business might need a logo, website, social
              media presence, advertising and business support.
              Posho Creative can bring those services together
              under one project.
            </p>
          </article>
        </div>
      </section>

      <section className="section service-page-cta-section">
        <div className="container">
          <div className="service-page-cta">
            <div>
              <span className="section-kicker">
                Have something in mind?
              </span>

              <h2>
                Tell us what
                <br />
                you imagine.
              </h2>

              <p>
                Choose one of our services or tell us about
                something completely different.
              </p>
            </div>

            <Link
              to="/order"
              className="button button-primary"
            >
              Start your project
              <ArrowUpRight size={18} />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
