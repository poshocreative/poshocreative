import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  Clock3,
  RefreshCw,
  Smartphone,
  XCircle,
} from 'lucide-react';

import {
  getAdminPaymentAttempts,
  recheckAdminPayment,
} from '../lib/adminPayments';

import {
  formatMoney,
  formatOrderStatus,
} from '../lib/orders';

function formatDate(
  value,
) {
  if (!value) {
    return 'Not yet';
  }

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

function methodName(
  method,
) {
  if (
    method ===
    'bank_transfer'
  ) {
    return 'Bank transfer';
  }

  if (
    method ===
    'opay'
  ) {
    return 'OPay';
  }

  return formatOrderStatus(
    method ||
      'unknown',
  );
}

function statusIcon(
  status,
) {
  if (
    status ===
    'successful'
  ) {
    return (
      <CheckCircle2
        size={18}
      />
    );
  }

  if (
    status ===
    'failed'
  ) {
    return (
      <XCircle
        size={18}
      />
    );
  }

  if (
    status ===
    'cancelled'
  ) {
    return (
      <AlertTriangle
        size={18}
      />
    );
  }

  return (
    <Clock3
      size={18}
    />
  );
}

export default function AdminPaymentAttempts({
  orderId,
}) {
  const [
    attempts,
    setAttempts,
  ] =
    useState([]);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    busyId,
    setBusyId,
  ] =
    useState('');

  const [
    error,
    setError,
  ] =
    useState('');

  const [
    message,
    setMessage,
  ] =
    useState('');

  const load =
    useCallback(
      async () => {
        try {
          setError('');

          const result =
            await getAdminPaymentAttempts(
              orderId,
            );

          setAttempts(
            result,
          );
        } catch (
          loadError
        ) {
          console.error(
            loadError,
          );

          setError(
            'Payment attempts could not be loaded.',
          );
        } finally {
          setLoading(
            false,
          );
        }
      },
      [
        orderId,
      ],
    );

  useEffect(() => {
    load();
  }, [
    load,
  ]);

  const recheck =
    async (
      paymentId,
    ) => {
      try {
        setBusyId(
          paymentId,
        );

        setError('');
        setMessage('');

        const result =
          await recheckAdminPayment(
            paymentId,
          );

        setMessage(
          result.message ||
            'Payment status refreshed.',
        );

        await load();
      } catch (
        actionError
      ) {
        setError(
          actionError.message,
        );
      } finally {
        setBusyId('');
      }
    };

  if (loading) {
    return (
      <section className="admin-control-card admin-payment-operations">
        <span>
          PAYMENT OPERATIONS
        </span>

        <h2>
          Loading payment attempts...
        </h2>
      </section>
    );
  }

  return (
    <section className="admin-control-card admin-payment-operations">
      <div className="admin-payment-section-heading">
        <div>
          <span>
            PAYMENT OPERATIONS
          </span>

          <h2>
            Transaction attempts
          </h2>

          <p>
            Every payment initiation, provider state and verification attempt for this project.
          </p>
        </div>

        <strong>
          {attempts.length}
          {' '}
          {attempts.length ===
          1
            ? 'attempt'
            : 'attempts'}
        </strong>
      </div>

      {error && (
        <div className="admin-error">
          {error}
        </div>
      )}

      {message && (
        <div className="workspace-success-message">
          {message}
        </div>
      )}

      {attempts.length ===
      0 ? (
        <div className="admin-payment-empty">
          <Banknote
            size={22}
          />

          <strong>
            No payment attempts
          </strong>

          <span>
            The customer has not started a payment for this project.
          </span>
        </div>
      ) : (
        <div className="admin-payment-attempt-list">
          {attempts.map(
            (
              payment,
              index,
            ) => {
              const latestDiagnostic =
                payment
                  .payment_attempt_diagnostics
                  ?.[0];

              const canRecheck =
                payment.status !==
                  'successful' &&
                payment.status !==
                  'cancelled';

              return (
                <article
                  key={
                    payment.id
                  }
                  className={`admin-payment-attempt admin-payment-attempt-${payment.status}`}
                >
                  <div className="admin-payment-attempt-top">
                    <div className="admin-payment-attempt-method">
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
                      </div>

                      <div>
                        <small>
                          ATTEMPT
                          {' '}
                          {attempts.length -
                            index}
                        </small>

                        <strong>
                          {methodName(
                            payment.payment_method,
                          )}
                        </strong>
                      </div>
                    </div>

                    <span
                      className={`admin-payment-status admin-payment-status-${payment.status}`}
                    >
                      {statusIcon(
                        payment.status,
                      )}

                      {formatOrderStatus(
                        payment.status,
                      )}
                    </span>
                  </div>

                  <div className="admin-payment-amount">
                    <span>
                      Amount
                    </span>

                    <strong>
                      {formatMoney(
                        payment.amount_kobo,
                        payment.currency,
                      )}
                    </strong>
                  </div>

                  <div className="admin-payment-detail-grid">
                    <div>
                      <span>
                        Provider reference
                      </span>

                      <strong>
                        {payment.provider_reference ||
                          'Not assigned'}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Charge / transaction ID
                      </span>

                      <strong>
                        {payment.provider_transaction_id ||
                          'Not assigned'}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Provider customer
                      </span>

                      <strong>
                        {payment.provider_customer_id ||
                          'Not assigned'}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Provider status
                      </span>

                      <strong>
                        {payment.provider_status
                          ? formatOrderStatus(
                              payment.provider_status,
                            )
                          : 'Not reported'}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Response code
                      </span>

                      <strong>
                        {payment.provider_response_code ||
                          '—'}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Current stage
                      </span>

                      <strong>
                        {formatOrderStatus(
                          payment.attempt_stage,
                        )}
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

                    <div>
                      <span>
                        Last checked
                      </span>

                      <strong>
                        {formatDate(
                          payment.last_checked_at,
                        )}
                      </strong>
                    </div>
                  </div>

                  {payment.customer_message && (
                    <div className="admin-payment-customer-message">
                      <span>
                        CUSTOMER-FACING STATUS
                      </span>

                      <p>
                        {payment.customer_message}
                      </p>
                    </div>
                  )}

                  {latestDiagnostic?.internal_message && (
                    <div className="admin-payment-internal-message">
                      <span>
                        LATEST INTERNAL EVENT
                      </span>

                      <p>
                        {latestDiagnostic.internal_message}
                      </p>
                    </div>
                  )}

                  <div className="admin-payment-attempt-actions">
                    {canRecheck && (
                      <button
                        type="button"
                        onClick={() =>
                          recheck(
                            payment.id,
                          )
                        }
                        disabled={
                          busyId ===
                          payment.id
                        }
                      >
                        <RefreshCw
                          size={16}
                        />

                        {busyId ===
                        payment.id
                          ? 'Checking...'
                          : 'Recheck Flutterwave'}
                      </button>
                    )}

                    {payment
                      .payment_attempt_diagnostics
                      ?.length >
                      0 && (
                      <details className="admin-payment-events">
                        <summary>
                          View event trail
                        </summary>

                        <div>
                          {payment
                            .payment_attempt_diagnostics
                            .map(
                              (
                                event,
                              ) => (
                                <article
                                  key={
                                    event.id
                                  }
                                >
                                  <span>
                                    {formatDate(
                                      event.created_at,
                                    )}
                                  </span>

                                  <strong>
                                    {formatOrderStatus(
                                      event.event_type,
                                    )}
                                  </strong>

                                  {event.internal_message && (
                                    <p>
                                      {event.internal_message}
                                    </p>
                                  )}
                                </article>
                              ),
                            )}
                        </div>
                      </details>
                    )}
                  </div>
                </article>
              );
            },
          )}
        </div>
      )}
    </section>
  );
}