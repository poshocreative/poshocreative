import {
  useEffect,
  useState,
} from 'react';

import {
  CheckCircle2,
  CircleAlert,
} from 'lucide-react';

import {
  Link,
  useSearchParams,
} from 'react-router-dom';

import BrandLoader from '../components/BrandLoader';

import {
  verifyPayment,
} from '../lib/payments';

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

  useEffect(() => {
    document.title =
      'Payment Verification | Posho Creative';

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

        try {
          const result =
            await verifyPayment(
              paymentId,
            );

          if (
            result?.success
          ) {
            setStatus(
              'success',
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
          setStatus(
            'error',
          );

          setMessage(
            error.message,
          );
        }
      };

    verify();
  }, [
    paymentId,
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
              Flutterwave confirmed your payment and your Posho Creative workspace has been updated.
            </p>

            <Link
              to="/dashboard"
              className="button button-primary"
            >
              Return to dashboard
            </Link>
          </>
        ) : (
          <>
            <div className="payment-return-icon">
              <CircleAlert
                size={36}
              />
            </div>

            <span className="workspace-kicker">
              PAYMENT PENDING
            </span>

            <h1>
              We're still checking.
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
        )}
      </div>
    </main>
  );
}