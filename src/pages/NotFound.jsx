import {
  useEffect,
} from 'react';

import {
  ArrowUpRight,
  Compass,
  Home,
} from 'lucide-react';

import {
  Link,
  useLocation,
} from 'react-router-dom';

export default function NotFound() {
  const location =
    useLocation();

  useEffect(() => {
    document.title =
      'Page Not Found | Posho Creative';
  }, []);

  return (
    <main className="system-page not-found-system-page">
      <div className="system-page-orb system-page-orb-one" />
      <div className="system-page-orb system-page-orb-two" />

      <div className="not-found-orbit not-found-orbit-one">
        <span />
      </div>

      <div className="not-found-orbit not-found-orbit-two">
        <span />
      </div>

      <div className="container not-found-container">
        <section className="not-found-copy page-reveal">
          <div className="not-found-code">
            <span>
              4
            </span>

            <div className="not-found-zero">
              <img
                src="/brand/posho-creative-icon.png"
                alt=""
              />
            </div>

            <span>
              4
            </span>
          </div>

          <span className="system-kicker">
            LOST IN THE IMAGINATION
          </span>

          <h1>
            This page hasn't
            <br />
            been created yet.
          </h1>

          <p>
            The address{' '}
            <strong>
              {location.pathname}
            </strong>{' '}
            doesn't lead to an existing
            Posho Creative page. The idea
            may have moved, changed or
            simply never existed.
          </p>

          <div className="not-found-actions">
            <Link
              to="/"
              className="button button-primary"
            >
              <Home
                size={17}
              />

              Return home
            </Link>

            <Link
              to="/services"
              className="button button-secondary"
            >
              <Compass
                size={17}
              />

              Explore services

              <ArrowUpRight
                size={16}
              />
            </Link>
          </div>
        </section>

        <aside className="not-found-visual page-reveal">
          <div className="not-found-visual-grid">
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>

          <div className="not-found-visual-center">
            <img
              src="/brand/posho-creative-icon.png"
              alt="Posho Creative"
            />

            <span>
              WE SEE
            </span>

            <strong>
              what you
              <br />
              imagine.
            </strong>
          </div>

          <div className="not-found-floating-label not-found-floating-label-one">
            CREATE
          </div>

          <div className="not-found-floating-label not-found-floating-label-two">
            DESIGN
          </div>

          <div className="not-found-floating-label not-found-floating-label-three">
            BUILD
          </div>
        </aside>
      </div>
    </main>
  );
}