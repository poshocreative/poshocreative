import {
  ArrowUpRight,
  Mail,
  MessageCircle,
  Phone,
} from 'lucide-react';

import {
  Link,
} from 'react-router-dom';

export default function Footer() {
  const currentYear =
    new Date()
      .getFullYear();

  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div className="footer-brand">
          <Link
            to="/"
            className="footer-brand-link"
          >
            <img
              src="/brand/posho-creative-logo.png"
              alt="Posho Creative"
              className="footer-logo"
            />
          </Link>

          <p>
            Creative, digital and business solutions built to turn ideas into professional results.
          </p>

          <p className="footer-motto">
            We see what you imagine.
          </p>
        </div>

        <div className="footer-column">
          <h3>
            Company
          </h3>

          <div className="footer-links">
            <Link to="/about">
              About
            </Link>

            <Link to="/services">
              Services
            </Link>

            <Link to="/contact">
              Contact
            </Link>

            <Link to="/login">
              Client sign in
            </Link>
          </div>
        </div>

        <div className="footer-column">
          <h3>
            Services
          </h3>

          <div className="footer-links">
            <Link to="/services/website-development">
              Website Development
            </Link>

            <Link to="/services/graphic-design">
              Graphic Design & Branding
            </Link>

            <Link to="/services/social-media-management">
              Social Media
            </Link>

            <Link to="/services/advertising">
              Advertising
            </Link>

            <Link to="/services/business-services">
              Business Services
            </Link>
          </div>
        </div>

        <div className="footer-column">
          <h3>
            Contact
          </h3>

          <div className="footer-contact-links">
            <a href="mailto:poshocreative@gmail.com">
              <Mail
                size={15}
              />

              poshocreative@gmail.com
            </a>

            <a href="tel:+2347060833927">
              <Phone
                size={15}
              />

              +234 706 083 3927
            </a>

            <a
              href="https://wa.me/2347060833927"
              target="_blank"
              rel="noreferrer"
            >
              <MessageCircle
                size={15}
              />

              WhatsApp
            </a>
          </div>

          <Link
            to="/order"
            className="footer-project-link"
          >
            Start a project

            <ArrowUpRight
              size={18}
            />
          </Link>
        </div>
      </div>

      <div className="container footer-bottom">
        <p>
          © {currentYear} Posho Creative. All rights reserved.
        </p>

        <p>
          We see what you imagine.
        </p>
      </div>
    </footer>
  );
}