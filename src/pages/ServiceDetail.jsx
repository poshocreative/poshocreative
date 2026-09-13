import { Link, useParams } from 'react-router-dom';

import Icon from '../components/ui/Icon';
import { getServiceBySlug, services } from '../data/services';

export default function ServiceDetail() {
  const { slug } = useParams();
  const service = getServiceBySlug(slug);

  if (!service) {
    return (
      <main className="service-detail-page">
        <div className="container service-detail-not-found">
          <Icon name="error" size={40} />
          <h1>Service not found</h1>
          <p>The service you are looking for does not exist or has been moved.</p>
          <Link to="/services" className="button button-primary">
            <Icon name="arrow_back" size={18} />
            Back to services
          </Link>
        </div>
      </main>
    );
  }

  const otherServices = services.filter((s) => s.slug !== service.slug).slice(0, 3);

  return (
    <main className="service-detail-page">
      <section className="service-detail-hero">
        <div className="container service-detail-hero-grid">
          <div className="service-detail-hero-copy">
            <div className="service-detail-breadcrumb">
              <Link to="/services">Services</Link>
              <Icon name="arrow_forward" size={14} />
              <span>{service.shortTitle}</span>
            </div>

            <div className="service-detail-icon">
              <Icon name={service.icon} size={32} />
            </div>

            <span className="section-kicker">{service.number}</span>

            <h1>{service.title}</h1>

            <p className="service-detail-tagline">{service.tagline}</p>

            <p className="service-detail-hero-description">{service.heroDescription}</p>

            <div className="service-detail-hero-actions">
              <Link to="/order" className="button button-primary">
                Start a project
                <Icon name="arrow_forward" size={18} />
              </Link>
              <Link to="/contact" className="button button-secondary">
                Ask a question
              </Link>
            </div>
          </div>

          <div className="service-detail-hero-visual">
            <div className="service-detail-hero-card">
              <div className="service-detail-hero-card-icon">
                <Icon name={service.icon} size={48} />
              </div>
              <span>{service.title}</span>
              <strong>Posho Creative</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="service-detail-services">
        <div className="container">
          <div className="section-heading">
            <div>
              <span className="section-kicker">What we offer</span>
              <h2>Services included</h2>
            </div>
          </div>

          <div className="service-detail-services-grid">
            {service.services.map((item) => (
              <div key={item} className="service-detail-service-item">
                <Icon name="check_circle" size={20} />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="service-detail-outcomes">
        <div className="container">
          <div className="section-heading">
            <div>
              <span className="section-kicker">Expected outcomes</span>
              <h2>What you get</h2>
            </div>
          </div>

          <div className="service-detail-outcomes-grid">
            {service.outcomes.map((outcome) => (
              <article key={outcome.title} className="service-detail-outcome-card">
                <Icon name="verified" size={24} />
                <h3>{outcome.title}</h3>
                <p>{outcome.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="service-detail-process">
        <div className="container">
          <div className="section-heading">
            <div>
              <span className="section-kicker">How it works</span>
              <h2>Our process</h2>
            </div>
          </div>

          <div className="service-detail-process-grid">
            {service.process.map((step, index) => (
              <div key={step} className="service-detail-process-step">
                <strong>{String(index + 1).padStart(2, '0')}</strong>
                <p>{step}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="service-detail-cta">
        <div className="container">
          <div className="service-detail-cta-card">
            <div>
              <span className="section-kicker">Ready to start?</span>
              <h2>Let&apos;s bring your {service.shortTitle.toLowerCase()} to life.</h2>
              <p>Tell us what you need and we will put together the right approach for your project.</p>
            </div>
            <Link to="/order" className="button button-primary">
              Start your project
              <Icon name="arrow_forward" size={18} />
            </Link>
          </div>
        </div>
      </section>

      {otherServices.length > 0 && (
        <section className="service-detail-related">
          <div className="container">
            <div className="section-heading">
              <div>
                <span className="section-kicker">Explore more</span>
                <h2>Other services</h2>
              </div>
              <Link to="/services" className="text-link">
                View all services
                <Icon name="north_east" size={18} />
              </Link>
            </div>

            <div className="service-detail-related-grid">
              {otherServices.map((other) => (
                <Link key={other.slug} to={`/services/${other.slug}`} className="service-detail-related-card">
                  <div className="service-detail-related-icon">
                    <Icon name={other.icon} size={24} />
                  </div>
                  <h3>{other.title}</h3>
                  <p>{other.description}</p>
                  <span>
                    Learn more
                    <Icon name="north_east" size={16} />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
