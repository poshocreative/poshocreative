import {
  useEffect,
  useState,
} from 'react';

import {
  ReceiptText,
} from 'lucide-react';

import BrandLoader from '../components/BrandLoader';

import {
  formatMoney,
  formatOrderStatus,
  getMyPayments,
} from '../lib/orders';

export default function DashboardPayments() {
  const [payments, setPayments] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    document.title =
      'Payments | Posho Creative';

    getMyPayments()
      .then(setPayments)
      .catch(console.error)
      .finally(() =>
        setLoading(false),
      );
  }, []);

  if (loading) {
    return (
      <div className="workspace-loading-panel">
        <BrandLoader label="Loading payments..." />
      </div>
    );
  }

  return (
    <div className="workspace-view page-reveal">
      <div className="workspace-view-heading">
        <div>
          <span className="workspace-kicker">
            PAYMENTS
          </span>

          <h2>
            Your payment history.
          </h2>
        </div>
      </div>

      {payments.length === 0 ? (
        <div className="workspace-empty workspace-panel">
          <div className="workspace-empty-icon">
            <ReceiptText size={27} />
          </div>

          <h3>
            No payments yet.
          </h3>

          <p>
            Quotes and verified project payments will appear here.
          </p>
        </div>
      ) : (
        <div className="workspace-payment-list">
          {payments.map(
            (payment) => (
              <article
                key={payment.id}
                className="workspace-payment-row"
              >
                <div>
                  <small>
                    {payment.orders?.reference}
                  </small>

                  <strong>
                    {payment.orders?.project_title}
                  </strong>
                </div>

                <strong>
                  {formatMoney(
                    payment.amount_kobo,
                    payment.currency,
                  )}
                </strong>

                <span
                  className={`workspace-status workspace-payment-${payment.status}`}
                >
                  {formatOrderStatus(
                    payment.status,
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