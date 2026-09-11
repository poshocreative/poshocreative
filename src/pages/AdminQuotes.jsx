import {
  useEffect,
  useState,
} from 'react';

import BrandLoader from '../components/BrandLoader';
import Link from '../components/PortalLink';
import { EmptyState, ErrorBlock } from '../components/ui/StateBlocks';

import {
  getAdminQuotes,
} from '../lib/admin';

import {
  formatMoney,
  formatOrderStatus,
} from '../lib/orders';

export default function AdminQuotes() {
  const [
    quotes,
    setQuotes,
  ] =
    useState([]);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    error,
    setError,
  ] =
    useState('');

  const load = async () => {
    try {
      setError('');
      setLoading(true);
      setQuotes(await getAdminQuotes());
    } catch {
      setError('Quotes could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    document.title =
      'Quotes | Posho Creative Management';

    load();
     
  }, []);

  if (loading) {
    return (
      <BrandLoader label="Loading quotes..." />
    );
  }

  return (
    <div className="admin-view page-reveal">
      <div className="admin-view-heading">
        <div>
          <span>
            QUOTES
          </span>

          <h1>
            Commercial proposals.
          </h1>
        </div>
      </div>

      {error && (
        <div style={{ marginBottom: 12 }}>
          <ErrorBlock message={error} onRetry={load} />
        </div>
      )}

      {quotes.length === 0 ? (
        <EmptyState
          title="No quotes issued yet"
          body="Quotes appear here after Management prices a project. Open a project to send its first quote."
          action={
            <Link to="/admin/orders" className="button button-secondary">
              Open projects
            </Link>
          }
        />
      ) : (
      <div className="admin-data-card">
        {quotes.map(
          (
            quote,
          ) => (
            <article
              key={
                quote.id
              }
              className="admin-data-row"
            >
              <div>
                <small>
                  {quote
                    .orders
                    ?.reference}
                </small>

                <strong>
                  {quote
                    .orders
                    ?.project_title}
                </strong>

                <span>
                  {quote
                    .orders
                    ?.customers
                    ?.full_name}
                </span>
              </div>

              <strong>
                {formatMoney(
                  quote
                    .amount_kobo,
                  quote.currency,
                )}
              </strong>

              <span className="workspace-status">
                {formatOrderStatus(
                  quote.status,
                )}
              </span>
            </article>
          ),
        )}
      </div>
      )}
    </div>
  );
}