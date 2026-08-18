import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div className="footer-brand">
          <Link to="/" className="footer-brand-link">
            <img
              src="/brand/posho-creative-logo.png"
              alt="Posho Creative"
              className="footer-logo"
            />
          </Link>

          <p>
            Creative, digital and business solutions built to turn
            ideas into meaningful results.
          </p>

          <p className="footer-motto">
            We see what you imagine.
          </p>
        </div>

        <div className="footer-column">
          <h3>Company</h3>

          <div className="footer-links">
            <Link to="/about">
              About us
            </Link>

            <Link to="/services">
              Services
            </Link>

            <Link to="/contact">
              Contact
            </Link>

            <Link to="/order">
              Start a project
            </Link>
          </div>
        </div>

        <div className="footer-column">
          <h3>Services</h3>

          <div className="footer-links">
            <Link to="/services/website-development">
              Website Development
            </Link>

            <Link to="/services/graphic-design">
              Graphic Design
            </Link>

            <Link to="/services/social-media-management">
              Social Media
            </Link>

            <Link to="/services/business-services">
              Business Services
            </Link>

            <Link to="/services/advertising">
              Advertising
            </Link>
          </div>
        </div>

        <div className="footer-column">
          <h3>Get started</h3>

          <p className="footer-small">
            Have an idea, business or project you want Posho Creative
            to work on?
          </p>

          <Link
            to="/order"
            className="footer-project-link"
          >
            Start your project
            <ArrowUpRight size={18} />
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