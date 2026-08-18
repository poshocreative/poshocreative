import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <main className="simple-page not-found-page">
      <div className="container">
        <span className="section-kicker">404</span>

        <h1>This page doesn't exist.</h1>

        <p>The page you are looking for may have moved or been removed.</p>

        <Link to="/" className="button button-dark">
          Return home
        </Link>
      </div>
    </main>
  );
}