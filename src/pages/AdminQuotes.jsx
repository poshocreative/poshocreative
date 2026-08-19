import {
  useEffect,
  useState,
} from 'react';

import BrandLoader from '../components/BrandLoader';

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

  useEffect(() => {
    document.title =
      'Quotes | Posho Creative Admin';

    getAdminQuotes()
      .then(setQuotes)
      .catch(
        console.error,
      )
      .finally(() =>
        setLoading(false),
      );
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
    </div>
  );
}