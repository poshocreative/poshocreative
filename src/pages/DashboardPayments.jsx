import {
  useEffect,
  useState,
} from 'react';

import {
  Banknote,
  Clock3,
  ReceiptText,
  Smartphone,
} from 'lucide-react';

import BrandLoader from '../components/BrandLoader';

import {
  formatMoney,
  formatOrderStatus,
} from '../lib/orders';

import {
  getMyPaymentAttempts,
} from '../lib/payments';

function formatDate(
  value,
) {
  return new Intl.DateTimeFormat(
    'en-NG',
    {
      dateStyle:
        'medium',

      timeStyle:
        'short',
    },
  ).format(
    new Date(value),
  );
}

function amounts(
  payment,
) {
  const base =
    Number(
      payment
        .base_amount_kobo ??
        payment
          .amount_kobo ??
        0,
    );

  const fee =
    Number(
      payment
        .actual_provider_fee_kobo ??
        payment
          .estimated_fee_kobo ??
        0,
    );

  const total =
    Number(
      payment
        .actual_customer_total_kobo ??
        payment
          .estimated_customer_total_kobo ??
        base +
          fee,
    );

  return {
    base,
    fee,
    total,
  };
}

export default function DashboardPayments() {
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
      'Payments | Posho Creative';

    getMyPaymentAttempts()
      .then(
        setPayments,
      )
      .catch(
        console.error,
      )
      .finally(() =>
        setLoading(
          false,
        ),
      );
  }, []);

  if (loading) {
    return (
      <div className="workspace-loading-panel">
        <BrandLoader
          label="Loading payments..."
        />
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
            Payment history.
          </h2>

          <p>
            Review payment attempts, fees and confirmed transactions for your projects.
          </p>
        </div>
      </div>

      {payments.length ===
      0 ? (
        <div className="workspace-empty workspace-panel">
          <div className="workspace-empty-icon">
            <ReceiptText
              size={27}
            />
          </div>

          <h3>
            No payment activity yet.
          </h3>

          <p>
            Your project payment attempts will appear here.
          </p>
        </div>
      ) : (
        <div className="customer-payment-attempts">
          {payments.map(
            (
              payment,
            ) => {
              const money =
                amounts(
                  payment,
                );

              return (
                <article
                  key={
                    payment.id
                  }
                  className={`customer-payment-attempt customer-payment-attempt-${payment.status}`}
                >
                  <div className="customer-payment-attempt-heading">
                    <div>
                      {payment.payment_method ===
                      'opay' ? (
                        <Smartphone
                          size={19}
                        />
                      ) : (
                        <Banknote
                          size={19}
                        />
                      )}

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
                      </div>
                    </div>

                    <span
                      className={`workspace-status workspace-payment-${payment.status}`}
                    >
                      {formatOrderStatus(
                        payment.status,
                      )}
                    </span>
                  </div>

                  <div className="customer-payment-money-grid">
                    <div>
                      <span>
                        Project amount
                      </span>

                      <strong>
                        {formatMoney(
                          money.base,
                          payment.currency,
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Processing fee
                      </span>

                      <strong>
                        {formatMoney(
                          money.fee,
                          payment.currency,
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Total
                      </span>

                      <strong>
                        {formatMoney(
                          money.total,
                          payment.currency,
                        )}
                      </strong>
                    </div>
                  </div>

                  <div className="customer-payment-attempt-info">
                    <div>
                      <span>
                        Method
                      </span>

                      <strong>
                        {payment.payment_method ===
                        'opay'
                          ? 'OPay'
                          : 'Bank transfer'}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Started
                      </span>

                      <strong>
                        {formatDate(
                          payment.created_at,
                        )}
                      </strong>
                    </div>
                  </div>

                  {payment.customer_message && (
                    <div className="customer-payment-message">
                      <Clock3
                        size={17}
                      />

                      <p>
                        {payment.customer_message}
                      </p>
                    </div>
                  )}

                  <div className="customer-payment-reference">
                    <span>
                      Payment reference
                    </span>

                    <strong>
                      {payment.provider_reference}
                    </strong>
                  </div>
                </article>
              );
            },
          )}
        </div>
      )}
    </div>
  );
}