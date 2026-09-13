import {
  useCallback,
  useEffect,
  useState,
} from 'react';


import Icon from '../components/ui/Icon';
import {
  useSearchParams,
} from 'react-router-dom';

import Link from '../components/PortalLink';

import BrandLoader from '../components/BrandLoader';

import { usePaymentPoller } from '../components/ui/usePaymentPoller';

import {
  verifyPayment,
} from '../lib/payments';

import {
  formatMoney,
} from '../lib/orders';

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
    autoChecking,
    setAutoChecking,
  ] =
    useState(false);

  useEffect(() => {
    document.title =
      'Payment Verification | Posho Creative';
  }, []);

  const doCheck =
    useCallback(
      async () => {
        if (
          !paymentId
        ) {
          setStatus(
            'error',
          );

          setMessage(
            'Payment reference is missing.',
          );

          return;
        }

        try {
          setAutoChecking(
            true,
          );

          setStatus(
            'checking',
          );

          setMessage('');

          const result =
            await verifyPayment(
              paymentId,
            );

          if (
            result?.success &&
            result?.status ===
              'successful'
          ) {
            setPaymentResult(
              result,
            );

            setMessage(
              result.message ||
                'Flutterwave confirmed your payment.',
            );

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
            setPaymentResult(
              result,
            );

            setMessage(
              result.message ||
                'Flutterwave did not complete this payment.',
            );

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
              'Flutterwave has not confirmed the payment yet. We are checking automatically every 10 seconds.',
          );
        } catch {
          setStatus(
            'pending',
          );

          setMessage(
            'We are reconnecting to Flutterwave to confirm your payment.',
          );
        } finally {
          setAutoChecking(
            false,
          );
        }
      },
      [
        paymentId,
      ],
    );

  useEffect(
    () => {
      doCheck();
    },
    [
      doCheck,
    ],
  );

  usePaymentPoller({
    enabled:
      paymentId &&
      [
        'pending',
        'checking',
      ].includes(
        status,
      ),
    onStatusChange:
      ({
        confirmed,
        cancelled,
      }) => {
        for (
          const entry
          of confirmed
        ) {
          setPaymentResult(
            {
              orderReference:
                entry.orderReference,
              fullyPaid:
                entry.fullyPaid,
              remainingBalanceKobo:
                null,
            },
          );

          setMessage(
            entry.message ||
              'Flutterwave confirmed your payment.',
          );

          setStatus(
            'success',
          );

          return;
        }

        for (
          const entry
          of cancelled
        ) {
          if (
            entry.id ===
            paymentId
          ) {
            setMessage(
              entry.message ||
                'This payment was not confirmed within 5 minutes and has been automatically cancelled. No money was charged.',
            );

            setStatus(
              'cancelled',
            );

            return;
          }
        }
      },
  });

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
              <Icon name="check_circle" 
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
        ) : status ===
        'cancelled' ? (
          <>
            <div className="payment-return-icon">
              <Icon name="cancel" 
                size={36}
              />
            </div>

            <span className="workspace-kicker">
              PAYMENT CANCELLED
            </span>

            <h1>
              This payment was not confirmed.
            </h1>

            <p>
              {message}
            </p>

            <Link
              to="/dashboard/payments"
              className="button button-primary"
            >
              View payments
            </Link>
          </>
        ) : (
          <>
            <div
              className={`payment-return-icon ${status === 'pending' ? 'pending' : ''}`}
            >
              {status === 'pending' ? (
                <Icon name="autorenew"                   size={34}
                />
              ) : (
                <Icon name="error"                   size={36}
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
                  doCheck()
                }
                disabled={autoChecking}
              >
                <Icon name="autorenew" size={16} />
                {autoChecking
                  ? 'Checking…'
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
