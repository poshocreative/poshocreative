import { Link } from 'react-router-dom';

import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
} from 'lucide-react';

import { services } from '../data/services';

export default function Home() {
  return (
    <main className="home-page">
      <section className="hero-section">
        <div className="hero-decoration hero-decoration-one" />
        <div className="hero-decoration hero-decoration-two" />

        <div className="container hero-grid">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="eyebrow-dot" />
              Creative & Business Solutions
            </div>

            <h1>
              We see what
              <span> you imagine.</span>
            </h1>

            <p className="hero-description">
              Websites. Branding. Social media. Advertising.
              Business solutions. Posho Creative brings the
              services you need together to transform ideas into
              meaningful results.
            </p>

            <div className="hero-buttons">
              <Link
                to="/order"
                className="button button-primary"
              >
                Start a project
                <ArrowRight size={18} />
              </Link>

              <Link
                to="/services"
                className="button button-secondary"
              >
                Explore our services
              </Link>
            </div>

            <div className="hero-trust">
              <div>
                <BadgeCheck size={20} />
                Professional service
              </div>

              <div>
                <BadgeCheck size={20} />
                Built around your goals
              </div>
            </div>
          </div>

          <div className="hero-visual">
            <div className="hero-visual-card">
              <div className="hero-card-top">
                <span>
                  POSHO CREATIVE
                </span>

                <ArrowUpRight size={20} />
              </div>

              <div className="hero-card-message">
                <span>
                  Imagine it.
                </span>

                <strong>
                  Let's create it.
                </strong>
              </div>

              <div className="hero-service-tags">
                <span>Websites</span>
                <span>Branding</span>
                <span>Social Media</span>
                <span>Advertising</span>
                <span>Business</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="intro-strip">
        <div className="container intro-strip-inner">
          <span>STRATEGY</span>
          <span className="strip-dot" />

          <span>DESIGN</span>
          <span className="strip-dot" />

          <span>TECHNOLOGY</span>
          <span className="strip-dot" />

          <span>BUSINESS</span>
          <span className="strip-dot" />

          <span>GROWTH</span>
        </div>
      </section>

      <section className="section services-preview">
        <div className="container">
          <div className="section-heading">
            <div>
              <span className="section-kicker">
                What we do
              </span>

              <h2>
                Everything your idea needs
                <br />
                to move forward.
              </h2>
            </div>

            <div className="section-heading-side">
              <p>
                Posho Creative brings creative, digital and
                business services together in one place.
              </p>

              <Link
                to="/services"
                className="text-link"
              >
                View all services
                <ArrowUpRight size={18} />
              </Link>
            </div>
          </div>

          <div className="services-grid">
            {services.map((service) => {
              const Icon = service.icon;

              return (
                <article
                  className="service-card"
                  key={service.slug}
                >
                  <div className="service-card-top">
                    <div className="service-icon">
                      <Icon size={24} />
                    </div>

                    <span>
                      {service.number}
                    </span>
                  </div>

                  <h3>
                    {service.title}
                  </h3>

                  <p>
                    {service.description}
                  </p>

                  <Link
                    to={`/services/${service.slug}`}
                    aria-label={`Explore ${service.title}`}
                  >
                    Learn more
                    <ArrowUpRight size={17} />
                  </Link>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="section why-section">
        <div className="container why-grid">
          <div className="why-copy">
            <span className="section-kicker">
              Why Posho Creative
            </span>

            <h2>
              One creative partner.
              <br />
              Many possibilities.
            </h2>

            <p>
              Building a strong business presence can require
              design, technology, marketing and business support.
              We bring those capabilities together.
            </p>

            <p>
              That means your ideas can move from concept to
              execution through one connected creative partner.
            </p>

            <Link
              to="/about"
              className="button button-dark"
            >
              Discover Posho Creative
              <ArrowUpRight size={18} />
            </Link>
          </div>

          <div className="why-cards">
            <article className="why-card why-card-large">
              <span>
                01
              </span>

              <div>
                <h3>
                  Idea first.
                </h3>

                <p>
                  We start by understanding the result you want
                  your project to achieve.
                </p>
              </div>
            </article>

            <article className="why-card">
              <span>
                02
              </span>

              <div>
                <h3>
                  Built around you.
                </h3>

                <p>
                  Your project is shaped around your requirements,
                  goals and identity.
                </p>
              </div>
            </article>

            <article className="why-card">
              <span>
                03
              </span>

              <div>
                <h3>
                  Results matter.
                </h3>

                <p>
                  Creative work should be attractive, useful and
                  purposeful.
                </p>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="section process-section">
        <div className="container">
          <div className="section-heading">
            <div>
              <span className="section-kicker">
                How it works
              </span>

              <h2>
                From idea to execution.
              </h2>
            </div>
          </div>

          <div className="process-grid">
            <article className="process-item">
              <strong>
                01
              </strong>

              <h3>
                Choose a service
              </h3>

              <p>
                Select the creative, digital or business service
                that matches your project.
              </p>
            </article>

            <article className="process-item">
              <strong>
                02
              </strong>

              <h3>
                Tell us your idea
              </h3>

              <p>
                Share your goals, requirements and useful
                references.
              </p>
            </article>

            <article className="process-item">
              <strong>
                03
              </strong>

              <h3>
                We build
              </h3>

              <p>
                Your project moves through the appropriate
                creative or business workflow.
              </p>
            </article>

            <article className="process-item">
              <strong>
                04
              </strong>

              <h3>
                Receive the result
              </h3>

              <p>
                We complete and deliver the agreed work according
                to your project requirements.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="section final-cta-section">
        <div className="container">
          <div className="final-cta">
            <div>
              <span>
                HAVE SOMETHING IN MIND?
              </span>

              <h2>
                Your next idea deserves
                <br />
                more than imagination.
              </h2>
            </div>

            <Link
              to="/order"
              className="cta-circle"
            >
              <span>
                Start a project
              </span>

              <ArrowUpRight size={24} />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}