import {
  useEffect,
  useState,
} from 'react';

import {
  ArrowLeft,
  Building2,
  Check,
  Copy,
  ExternalLink,
  Smartphone,
} from 'lucide-react';

import {
  Link,
  useParams,
} from 'react-router-dom';

import BrandLoader from '../components/BrandLoader';

import {
  formatMoney,
  getOrderByReference,
} from '../lib/orders';

import {
  createPaymentSession,
  verifyPayment,
} from '../lib/payments';

export default function DashboardPay() {
  const {
    reference,
  } = useParams();

  const [
    order,
    setOrder,
  ] =
    useState(null);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    method,
    setMethod,
  ] =
    useState(
      'bank_transfer',
    );

  const [
    payment,
    setPayment,
  ] =
    useState(null);

  const [
    submitting,
    setSubmitting,
  ] =
    useState(false);

  const [
    checking,
    setChecking,
  ] =
    useState(false);

  const [
    copied,
    setCopied,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState('');

  useEffect(() => {
    document.title =
      'Pay for Project | Posho Creative';

    getOrderByReference(
      reference,
    )
      .then(setOrder)
      .catch(
        console.error,
      )
      .finally(() =>
        setLoading(false),
      );
  }, [
    reference,
  ]);

  const startPayment =
    async () => {
      if (!order) {
        return;
      }

      try {
        setSubmitting(true);
        setError('');

        const result =
          await createPaymentSession({
            orderId:
              order.id,

            method,
          });

        if (
          result.method ===
          'opay' &&
          result.redirectUrl
        ) {
          window.location.assign(
            result.redirectUrl,
          );

          return;
        }

        setPayment(
          result,
        );
      } catch (
        paymentError
      ) {
        setError(
          paymentError.message,
        );
      } finally {
        setSubmitting(
          false,
        );
      }
    };

  const checkPayment =
    async () => {
      if (!payment?.id) {
        return;
      }

      try {
        setChecking(true);
        setError('');

        const result =
          await verifyPayment(
            payment.id,
          );

        if (
          result?.success
        ) {
          window.location.assign(
            `/dashboard/orders/${reference}`,
          );

          return;
        }

        setError(
          result?.message ||
            'Payment has not been confirmed yet. Please try again shortly.',
        );
      } catch (
        verifyError
      ) {
        setError(
          verifyError.message,
        );
      } finally {
        setChecking(
          false,
        );
      }
    };

  const copyAccount =
    async () => {
      const number =
        payment
          ?.account
          ?.accountNumber;

      if (!number) {
        return;
      }

      await navigator
        .clipboard
        .writeText(
          number,
        );

      setCopied(true);

      window.setTimeout(
        () =>
          setCopied(
            false,
          ),
        1800,
      );
    };

  if (loading) {
    return (
      <BrandLoader
        label="Preparing payment..."
      />
    );
  }

  if (!order) {
    return (
      <div className="commerce-empty">
        Project not found.
      </div>
    );
  }

  const outstanding =
    Math.max(
      Number(
        order
          .quoted_amount_kobo ||
          0,
      ) -
        Number(
          order
            .paid_amount_kobo ||
            0,
        ),
      0,
    );

  return (
    <div className="commerce-page page-reveal">
      <Link
        to={`/dashboard/orders/${reference}`}
        className="workspace-back-link"
      >
        <ArrowLeft
          size={17}
        />

        Back to project
      </Link>

      <div className="payment-layout">
        <section className="payment-main-card">
          <span className="workspace-kicker">
            SECURE PAYMENT
          </span>

          <h2>
            Complete your project payment.
          </h2>

          <p className="payment-project-reference">
            {order.reference}
            {' · '}
            {order.project_title}
          </p>

          <div className="payment-amount">
            <span>
              Amount due
            </span>

            <strong>
              {formatMoney(
                outstanding,
              )}
            </strong>
          </div>

          {!payment && (
            <>
              <div className="payment-method-grid">
                <button
                  type="button"
                  className={
                    method ===
                    'bank_transfer'
                      ? 'payment-method selected'
                      : 'payment-method'
                  }
                  onClick={() =>
                    setMethod(
                      'bank_transfer',
                    )
                  }
                >
                  <Building2
                    size={23}
                  />

                  <strong>
                    Bank transfer
                  </strong>

                  <span>
                    Receive a secure Flutterwave account for this payment.
                  </span>
                </button>

                <button
                  type="button"
                  className={
                    method ===
                    'opay'
                      ? 'payment-method selected'
                      : 'payment-method'
                  }
                  onClick={() =>
                    setMethod(
                      'opay',
                    )
                  }
                >
                  <Smartphone
                    size={23}
                  />

                  <strong>
                    OPay
                  </strong>

                  <span>
                    Continue to Flutterwave and authorise with OPay.
                  </span>
                </button>
              </div>

              <button
                type="button"
                className="button button-primary payment-continue-button"
                onClick={
                  startPayment
                }
                disabled={
                  submitting
                }
              >
                {submitting
                  ? 'Creating secure payment...'
                  : 'Continue securely'}

                {!submitting && (
                  <ExternalLink
                    size={17}
                  />
                )}
              </button>
            </>
          )}

          {payment
            ?.method ===
            'bank_transfer' && (
            <div className="bank-transfer-panel">
              <div className="bank-transfer-heading">
                <Check
                  size={18}
                />

                Transfer the exact amount below
              </div>

              <div className="bank-account-detail">
                <span>
                  Bank
                </span>

                <strong>
                  {
                    payment
                      .account
                      .bankName
                  }
                </strong>
              </div>

              <div className="bank-account-detail">
                <span>
                  Account number
                </span>

                <div>
                  <strong>
                    {
                      payment
                        .account
                        .accountNumber
                    }
                  </strong>

                  <button
                    type="button"
                    onClick={
                      copyAccount
                    }
                  >
                    <Copy
                      size={15}
                    />

                    {copied
                      ? 'Copied'
                      : 'Copy'}
                  </button>
                </div>
              </div>

              <div className="bank-account-detail">
                <span>
                  Amount
                </span>

                <strong>
                  {formatMoney(
                    payment
                      .amountKobo,
                  )}
                </strong>
              </div>

              <p>
                Transfer exactly the displayed amount. Flutterwave will notify Posho Creative after the payment is received.
              </p>

              <button
                type="button"
                className="button button-primary"
                onClick={
                  checkPayment
                }
                disabled={
                  checking
                }
              >
                {checking
                  ? 'Checking payment...'
                  : 'I have made the transfer'}
              </button>
            </div>
          )}

          {error && (
            <div className="workspace-alert">
              {error}
            </div>
          )}
        </section>

        <aside className="payment-security-card">
          <span>
            PAYMENT SECURITY
          </span>

          <h3>
            Payment verification happens on our server.
          </h3>

          <p>
            Posho Creative does not mark a project as paid from a browser response alone. Flutterwave must confirm the transaction before access or project status is updated.
          </p>
        </aside>
      </div>
    </div>
  );
}