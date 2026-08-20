import {
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  Mail,
  MessageCircle,
  Phone,
  Sparkles,
} from 'lucide-react';

import {
  Link,
} from 'react-router-dom';

const contactOptions = [
  {
    icon: Mail,
    label: 'Email',
    value: 'poshocreative@gmail.com',
    description:
      'Best for detailed enquiries, partnerships and formal communication.',
    href:
      'mailto:poshocreative@gmail.com',
    action:
      'Send an email',
  },
  {
    icon:
      MessageCircle,
    label:
      'WhatsApp',
    value:
      '+234 706 083 3927',
    description:
      'Useful for quick enquiries and initial project conversations.',
    href:
      'https://wa.me/2347060833927',
    action:
      'Open WhatsApp',
  },
  {
    icon: Phone,
    label:
      'Phone',
    value:
      '+234 706 083 3927',
    description:
      'Call when a direct conversation is the best way to explain your enquiry.',
    href:
      'tel:+2347060833927',
    action:
      'Call Posho Creative',
  },
];

const preparation = [
  'What you want created, improved, launched or promoted',
  'Your preferred timeline or deadline',
  'Any useful references, existing materials or links',
  'The outcome you want the project to achieve',
];

export default function Contact() {
  return (
    <main className="company-page contact-page">
      <section className="contact-hero">
        <div className="container contact-hero-grid">
          <div>
            <div className="eyebrow">
              <span className="eyebrow-dot" />
              Contact Posho Creative
            </div>

            <h1>
              A good project starts with
              <span>
                {' '}
                a clear conversation.
              </span>
            </h1>

            <p>
              Whether you already know exactly what you need or only have an idea that needs direction, choose the most suitable way to reach us.
            </p>
          </div>

          <aside className="contact-hero-aside">
            <Sparkles
              size={24}
            />

            <span>
              FOR PROJECT WORK
            </span>

            <h2>
              The client workspace is the best place to begin.
            </h2>

            <p>
              Starting a project creates a tracked request where review decisions, quotes, payments, updates and project information can remain organised.
            </p>

            <Link
              to="/order"
              className="button button-primary"
            >
              Start a project

              <ArrowRight
                size={17}
              />
            </Link>
          </aside>
        </div>
      </section>

      <section className="contact-options-section">
        <div className="container">
          <div className="company-section-heading">
            <div>
              <span className="section-kicker">
                CONTACT CHANNELS
              </span>

              <h2>
                Reach us directly.
              </h2>
            </div>

            <p>
              Use the channel that best fits the type of conversation you want to have.
            </p>
          </div>

          <div className="contact-option-grid">
            {contactOptions.map(
              ({
                icon:
                  Icon,
                label,
                value,
                description,
                href,
                action,
              }) => (
                <a
                  key={
                    label
                  }
                  href={
                    href
                  }
                  className="contact-option-card"
                  target={
                    label ===
                    'WhatsApp'
                      ? '_blank'
                      : undefined
                  }
                  rel={
                    label ===
                    'WhatsApp'
                      ? 'noreferrer'
                      : undefined
                  }
                >
                  <div className="contact-option-icon">
                    <Icon
                      size={22}
                    />
                  </div>

                  <span>
                    {label}
                  </span>

                  <h3>
                    {value}
                  </h3>

                  <p>
                    {description}
                  </p>

                  <strong>
                    {action}

                    <ArrowRight
                      size={16}
                    />
                  </strong>
                </a>
              ),
            )}
          </div>
        </div>
      </section>

      <section className="contact-project-section">
        <div className="container contact-project-grid">
          <div>
            <BriefcaseBusiness
              size={24}
            />

            <span className="section-kicker">
              BEFORE YOU REACH OUT
            </span>

            <h2>
              A little context helps us understand your project faster.
            </h2>

            <p>
              You do not need a complete specification. A clear description of what you are trying to achieve is enough to begin.
            </p>
          </div>

          <div className="contact-preparation-list">
            {preparation.map(
              (
                item,
                index,
              ) => (
                <div
                  key={
                    item
                  }
                >
                  <span>
                    0{index + 1}
                  </span>

                  <p>
                    {item}
                  </p>
                </div>
              ),
            )}
          </div>
        </div>
      </section>

      <section className="contact-flow-section">
        <div className="container">
          <div className="company-section-heading">
            <div>
              <span className="section-kicker">
                PROJECT REQUESTS
              </span>

              <h2>
                What happens after you submit.
              </h2>
            </div>
          </div>

          <div className="contact-flow-grid">
            <article>
              <span>
                01
              </span>

              <h3>
                Request received
              </h3>

              <p>
                Your project request and references are placed in your client workspace.
              </p>
            </article>

            <article>
              <span>
                02
              </span>

              <h3>
                Management review
              </h3>

              <p>
                We review the service, scope, timing and requirements before accepting the engagement.
              </p>
            </article>

            <article>
              <span>
                03
              </span>

              <h3>
                Decision
              </h3>

              <p>
                Approved requests move forward. If we cannot take on a request, the reason is communicated clearly.
              </p>
            </article>

            <article>
              <span>
                04
              </span>

              <h3>
                Quote & execution
              </h3>

              <p>
                Where applicable, the final quote and payment step are issued before production begins.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="contact-assurance-section">
        <div className="container contact-assurance-card">
          <CheckCircle2
            size={24}
          />

          <div>
            <span>
              POSHO CREATIVE
            </span>

            <h2>
              Professional communication. Clear project records.
            </h2>

            <p>
              Email: poshocreative@gmail.com · Phone & WhatsApp: +234 706 083 3927
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}