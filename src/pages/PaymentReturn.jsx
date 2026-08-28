import {
  useEffect,
  useState,
} from 'react';

import {
  CheckCircle2,
  CircleAlert,
  RefreshCw,
} from 'lucide-react';

import {
  useSearchParams,
} from 'react-router-dom';

import Link from '../components/PortalLink';

import BrandLoader from '../components/BrandLoader';

import {
  verifyPayment,
} from '../lib/payments';

import {
  formatMoney,
} from '../lib/orders';

const MAX_VERIFICATION_ATTEMPTS = 10;
const VERIFICATION_INTERVAL_MS = 3500;

export default function PaymentReturn() {
  const [
    searchParams,
  ] =
    useSearchParams();

  const paymentId =
    searchParams.get(
      'payment',
    );

  const [
    status,
    setStatus,
  ] =
    useState(
      'checking',
    );

  const [
    message,
    setMessage,
  ] =
    useState('');

  const [
    paymentResult,
    setPaymentResult,
  ] =
    useState(null);

  const [
    retryKey,
    setRetryKey,
  ] =
    useState(0);

  const [
    autoChecking,
    setAutoChecking,
  ] =
    useState(false);

  useEffect(() => {
    document.title =
      'Payment Verification | Posho Creative';

    let active =
      true;

    let timer =
      null;

    const wait =
      () =>
        new Promise(
          (resolve) => {
            timer =
              window.setTimeout(
                resolve,
                VERIFICATION_INTERVAL_MS,
              );
          },
        );

    const verify =
      async () => {
        if (!paymentId) {
          setStatus(
            'error',
          );

          setMessage(
            'Payment reference is missing.',
          );

          return;
        }

        setStatus(
          'checking',
        );

        setMessage('');
        setAutoChecking(true);

        for (
          let attempt = 1;
          attempt <= MAX_VERIFICATION_ATTEMPTS;
          attempt += 1
        ) {
          try {
            const result =
              await verifyPayment(
                paymentId,
              );

            if (!active) {
              return;
            }

            setPaymentResult(
              result,
            );

            if (
              result?.success &&
              result?.status ===
                'successful'
            ) {
              setMessage(
                result.message ||
                  'Flutterwave confirmed your payment.',
              );

              setAutoChecking(false);

              setStatus(
                'success',
              );

              return;
            }

            if (
              [
                'failed',
                'cancelled',
              ].includes(
                result?.status,
              )
            ) {
              setMessage(
                result.message ||
                  'Flutterwave did not complete this payment.',
              );

              setAutoChecking(false);

              setStatus(
                'error',
              );

              return;
            }

            setStatus(
              'pending',
            );

            setMessage(
              result?.message ||
                'Flutterwave has not confirmed the payment yet.',
            );
          } catch (
            error
          ) {
            if (!active) {
              return;
            }

            if (
              attempt ===
              MAX_VERIFICATION_ATTEMPTS
            ) {
              setStatus(
                'error',
              );

              setMessage(
                error.message ||
                  'Payment verification could not be completed.',
              );

              setAutoChecking(false);

              return;
            }

            setStatus(
              'pending',
            );

            setMessage(
              'We are reconnecting to Flutterwave to confirm your payment.',
            );
          }

          if (
            attempt <
            MAX_VERIFICATION_ATTEMPTS
          ) {
            await wait();

            if (!active) {
              return;
            }
          }
        }

        setAutoChecking(false);
      };

    verify();

    return () => {
      active =
        false;

      if (timer) {
        window.clearTimeout(
          timer,
        );
      }
    };
  }, [
    paymentId,
    retryKey,
  ]);

  if (
    status ===
    'checking'
  ) {
    return (
      <main className="payment-return-page">
        <BrandLoader
          fullscreen
          label="Verifying your Flutterwave payment..."
        />
      </main>
    );
  }

  return (
    <main className="payment-return-page">
      <div className="payment-return-card">
        {status ===
        'success' ? (
          <>
            <div className="payment-return-icon success">
              <CheckCircle2
                size={36}
              />
            </div>

            <span className="workspace-kicker">
              PAYMENT CONFIRMED
            </span>

            <h1>
              Payment received.
            </h1>

            <p>
              {message}
            </p>

            {paymentResult?.remainingBalanceKobo > 0 && (
              <div className="payment-return-balance">
                <span>Remaining project balance</span>
                <strong>
                  {formatMoney(paymentResult.remainingBalanceKobo)}
                </strong>
              </div>
            )}

            <Link
              to={
                paymentResult?.orderReference
                  ? `/dashboard/orders/${paymentResult.orderReference}`
                  : '/dashboard'
              }
              className="button button-primary"
            >
              View updated project
            </Link>
          </>
        ) : (
          <>
            <div
              className={`payment-return-icon ${status === 'pending' ? 'pending' : ''}`}
            >
              {status === 'pending' ? (
                <RefreshCw
                  size={34}
                />
              ) : (
                <CircleAlert
                  size={36}
                />
              )}
            </div>

            <span className="workspace-kicker">
              {status === 'pending'
                ? 'CONFIRMING PAYMENT'
                : 'VERIFICATION NEEDS ATTENTION'}
            </span>

            <h1>
              {status === 'pending'
                ? "We're still checking."
                : 'Confirmation is taking longer.'}
            </h1>

            <p>
              {message}
            </p>

            <div className="payment-return-actions">
              <button
                type="button"
                className="button button-primary"
                onClick={() =>
                  setRetryKey((current) => current + 1)
                }
                disabled={autoChecking}
              >
                <RefreshCw size={16} />
                {autoChecking
                  ? 'Checking automatically…'
                  : 'Check again now'}
              </button>

              <Link
                to="/dashboard/payments"
                className="button button-secondary"
              >
                View payments
              </Link>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
