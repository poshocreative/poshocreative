import {
  useEffect,
  useState,
} from 'react';

import BrandLoader from '../components/BrandLoader';

import {
  getAdminPayments,
} from '../lib/admin';

import {
  formatMoney,
  formatOrderStatus,
} from '../lib/orders';

export default function AdminPayments() {
  const [
    payments,
    setPayments,
  ] =
    useState([]);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  useEffect(() => {
    document.title =
      'Payments | Posho Creative Admin';

    getAdminPayments()
      .then(
        setPayments,
      )
      .catch(
        console.error,
      )
      .finally(() =>
        setLoading(false),
      );
  }, []);

  if (loading) {
    return (
      <BrandLoader label="Loading payments..." />
    );
  }

  return (
    <div className="admin-view page-reveal">
      <div className="admin-view-heading">
        <div>
          <span>
            PAYMENTS
          </span>

          <h1>
            Transaction center.
          </h1>
        </div>
      </div>

      <div className="admin-data-card">
        {payments.map(
          (
            payment,
          ) => (
            <article
              key={
                payment.id
              }
              className="admin-data-row"
            >
              <div>
                <small>
                  {payment
                    .orders
                    ?.reference}
                </small>

                <strong>
                  {payment
                    .orders
                    ?.project_title}
                </strong>

                <span>
                  {payment
                    .provider_reference}
                </span>
              </div>

              <strong>
                {formatMoney(
                  payment
                    .amount_kobo,
                  payment.currency,
                )}
              </strong>

              <span>
                {payment.payment_method
                  ?.replaceAll(
                    '_',
                    ' ',
                  )}
              </span>

              <span className={`workspace-status workspace-payment-${payment.status}`}>
                {formatOrderStatus(
                  payment.status,
                )}
              </span>
            </article>
          ),
        )}
      </div>
    </div>
  );
}