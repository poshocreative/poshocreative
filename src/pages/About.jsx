import {
  ArrowRight,
  CheckCircle2,
  Layers3,
  Lightbulb,
  MonitorSmartphone,
  MoveUpRight,
  ShieldCheck,
  Sparkles,
  Target,
} from 'lucide-react';

import {
  Link,
} from 'react-router-dom';

const principles = [
  {
    icon: Target,
    title: 'Clarity before complexity',
    text: 'Every project begins with understanding the real objective, audience and outcome before execution starts.',
  },
  {
    icon: Sparkles,
    title: 'Creativity with purpose',
    text: 'Strong creative work should do more than look impressive. It should communicate, position and perform.',
  },
  {
    icon: Layers3,
    title: 'Connected solutions',
    text: 'Branding, technology, promotion and business support work better when they are treated as one connected system.',
  },
  {
    icon: ShieldCheck,
    title: 'Professional accountability',
    text: 'Projects are organised through clear requests, review, quoting, payments, updates and deliverables.',
  },
];

const capabilities = [
  'Website & Web Platform Development',
  'Brand Identity & Graphic Design',
  'Social Media Management & Growth',
  'Advertising & Promotion',
  'Business Support & Digital Setup',
  'Custom Creative Solutions',
];

export default function About() {
  return (
    <main className="company-page">
      <section className="company-hero">
        <div className="company-orbit company-orbit-one" />
        <div className="company-orbit company-orbit-two" />

        <div className="container company-hero-grid">
          <div className="company-hero-copy">
            <div className="eyebrow">
              <span className="eyebrow-dot" />
              About Posho Creative
            </div>

            <h1>
              Ideas deserve
              <span>
                {' '}
                serious execution.
              </span>
            </h1>

            <p>
              Posho Creative brings together creativity, technology, digital growth and practical business support to help ideas move from imagination to something clear, professional and usable.
            </p>

            <div className="company-hero-actions">
              <Link
                to="/services"
                className="button button-primary"
              >
                Explore our services

                <ArrowRight
                  size={17}
                />
              </Link>

              <Link
                to="/contact"
                className="button button-secondary"
              >
                Talk to us
              </Link>
            </div>
          </div>

          <aside className="company-hero-card">
            <div className="company-hero-card-mark">
              <img
                src="/brand/posho-creative-icon.png"
                alt=""
              />
            </div>

            <div>
              <span>
                OUR POSITION
              </span>

              <h2>
                More than a design studio.
              </h2>

              <p>
                We approach projects as business problems to solve — combining strategy, creative direction and digital execution where the work requires it.
              </p>
            </div>

            <div className="company-capability-tags">
              <span>
                Strategy
              </span>

              <span>
                Design
              </span>

              <span>
                Technology
              </span>

              <span>
                Growth
              </span>
            </div>
          </aside>
        </div>
      </section>

      <section className="company-intro-section">
        <div className="container company-intro-grid">
          <div>
            <span className="section-kicker">
              WHY WE EXIST
            </span>

            <h2>
              The gap between an idea and a professional result is execution.
            </h2>
          </div>

          <div className="company-intro-copy">
            <p>
              A business may need a website, a brand may need stronger visual direction, a campaign may need promotion, or an entrepreneur may simply need the right combination of services to launch properly.
            </p>

            <p>
              Posho Creative exists to make that process more organised. Instead of treating every requirement as an isolated task, we look at the wider objective and structure the work around what the project actually needs.
            </p>
          </div>
        </div>
      </section>

      <section className="company-principles-section">
        <div className="container">
          <div className="company-section-heading">
            <div>
              <span className="section-kicker">
                HOW WE THINK
              </span>

              <h2>
                Standards behind the work.
              </h2>
            </div>

            <p>
              The same principles guide a logo, website, campaign or larger multi-service project.
            </p>
          </div>

          <div className="company-principles-grid">
            {principles.map(
              ({
                icon:
                  Icon,
                title,
                text,
              }) => (
                <article
                  key={
                    title
                  }
                  className="company-principle-card"
                >
                  <div>
                    <Icon
                      size={21}
                    />
                  </div>

                  <h3>
                    {title}
                  </h3>

                  <p>
                    {text}
                  </p>
                </article>
              ),
            )}
          </div>
        </div>
      </section>

      <section className="company-process-section">
        <div className="container company-process-grid">
          <div className="company-process-visual">
            <div>
              <Lightbulb
                size={22}
              />

              <span>
                IDEA
              </span>
            </div>

            <MoveUpRight
              size={22}
            />

            <div>
              <MonitorSmartphone
                size={22}
              />

              <span>
                EXECUTION
              </span>
            </div>

            <MoveUpRight
              size={22}
            />

            <div>
              <CheckCircle2
                size={22}
              />

              <span>
                RESULT
              </span>
            </div>
          </div>

          <div className="company-process-copy">
            <span className="section-kicker">
              OUR APPROACH
            </span>

            <h2>
              Structured from request to delivery.
            </h2>

            <div className="company-process-list">
              <div>
                <strong>
                  01
                </strong>

                <p>
                  Understand the request, goals, requirements and constraints.
                </p>
              </div>

              <div>
                <strong>
                  02
                </strong>

                <p>
                  Review the project and confirm whether it is a suitable engagement.
                </p>
              </div>

              <div>
                <strong>
                  03
                </strong>

                <p>
                  Define pricing, timeline and the next commercial step.
                </p>
              </div>

              <div>
                <strong>
                  04
                </strong>

                <p>
                  Execute, communicate progress and deliver through an organised client workspace.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="company-capabilities-section">
        <div className="container company-capabilities-grid">
          <div>
            <span className="section-kicker">
              WHAT WE DO
            </span>

            <h2>
              One creative partner. Multiple capabilities.
            </h2>

            <p>
              Some projects need one focused service. Others require several disciplines working together. Posho Creative is structured for both.
            </p>
          </div>

          <div className="company-capabilities-list">
            {capabilities.map(
              (
                capability,
              ) => (
                <div
                  key={
                    capability
                  }
                >
                  <CheckCircle2
                    size={17}
                  />

                  <span>
                    {capability}
                  </span>
                </div>
              ),
            )}
          </div>
        </div>
      </section>

      <section className="company-final-cta">
        <div className="container">
          <div className="company-final-card">
            <div>
              <span>
                HAVE SOMETHING IN MIND?
              </span>

              <h2>
                We see what you imagine.
              </h2>

              <p>
                Tell us what you want to build, improve, launch or promote.
              </p>
            </div>

            <Link
              to="/order"
              className="button button-primary"
            >
              Start a project

              <ArrowRight
                size={17}
              />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}