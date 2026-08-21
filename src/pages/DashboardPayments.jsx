import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  AlertCircle,
  ArrowRight,
  Banknote,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Copy,
  FileCheck2,
  ReceiptText,
  RefreshCw,
  Search,
  ShieldCheck,
  Smartphone,
  XCircle,
} from 'lucide-react';

import {
  Link,
} from 'react-router-dom';

import BrandLoader from '../components/BrandLoader';

import {
  formatMoney,
} from '../lib/orders';

import {
  getMyPaymentAttempts,
  verifyPayment,
} from '../lib/payments';

const filters = [
  {
    id:
      'all',

    label:
      'All',
  },
  {
    id:
      'successful',

    label:
      'Confirmed',
  },
  {
    id:
      'open',

    label:
      'Pending',
  },
  {
    id:
      'failed',

    label:
      'Unsuccessful',
  },
];

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

function paymentMethodName(
  method,
) {
  if (
    method ===
    'opay'
  ) {
    return 'OPay';
  }

  if (
    method ===
    'bank_transfer'
  ) {
    return 'Bank transfer';
  }

  return 'Payment';
}

function paymentAmounts(
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

function getCustomerPaymentState(
  payment,
) {
  if (
    payment.status ===
    'successful'
  ) {
    return {
      key:
        'successful',

      label:
        'Confirmed',

      description:
        'This payment has been securely confirmed.',
    };
  }

  if (
    payment.status ===
    'failed'
  ) {
    return {
      key:
        'failed',

      label:
        'Unsuccessful',

      description:
        'This payment attempt was not completed.',
    };
  }

  if (
    payment.status ===
      'cancelled' ||
    payment.status ===
      'voided'
  ) {
    return {
      key:
        'cancelled',

      label:
        'Cancelled',

      description:
        'This payment attempt was cancelled.',
    };
  }

  if (
    payment
      .attempt_stage ===
    'awaiting_transfer'
  ) {
    return {
      key:
        'pending',

      label:
        'Awaiting transfer',

      description:
        'Payment confirmation is still pending.',
    };
  }

  if (
    payment
      .attempt_stage ===
    'verifying'
  ) {
    return {
      key:
        'pending',

      label:
        'Confirming',

      description:
        'This payment is currently being checked.',
    };
  }

  return {
    key:
      'pending',

    label:
      'Pending',

    description:
      'Payment confirmation has not been completed yet.',
  };
}

function paymentMatchesFilter(
  payment,
  filter,
) {
  if (
    filter ===
    'all'
  ) {
    return true;
  }

  if (
    filter ===
    'successful'
  ) {
    return (
      payment.status ===
      'successful'
    );
  }

  if (
    filter ===
    'open'
  ) {
    return [
      'pending',
      'processing',
    ].includes(
      payment.status,
    );
  }

  if (
    filter ===
    'failed'
  ) {
    return [
      'failed',
      'cancelled',
      'voided',
    ].includes(
      payment.status,
    );
  }

  return true;
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

  const [
    search,
    setSearch,
  ] =
    useState('');

  const [
    filter,
    setFilter,
  ] =
    useState('all');

  const [
    checkingId,
    setCheckingId,
  ] =
    useState('');

  const [
    copiedId,
    setCopiedId,
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

  const loadPayments =
    async () => {
      try {
        setError('');

        const rows =
          await getMyPaymentAttempts();

        setPayments(
          rows,
        );
      } catch (
        loadError
      ) {
        console.error(
          loadError,
        );

        setError(
          'Your payment history could not be loaded.',
        );
      } finally {
        setLoading(
          false,
        );
      }
    };

  useEffect(() => {
    document.title =
      'Payments | Posho Creative';

    loadPayments();
  }, []);

  const metrics =
    useMemo(() => {
      const successful =
        payments.filter(
          (
            payment,
          ) =>
            payment.status ===
            'successful',
        );

      const open =
        payments.filter(
          (
            payment,
          ) =>
            [
              'pending',
              'processing',
            ].includes(
              payment.status,
            ),
        );

      const projectValue =
        successful.reduce(
          (
            total,
            payment,
          ) =>
            total +
            paymentAmounts(
              payment,
            ).base,
          0,
        );

      const fees =
        successful.reduce(
          (
            total,
            payment,
          ) =>
            total +
            paymentAmounts(
              payment,
            ).fee,
          0,
        );

      const customerTotal =
        successful.reduce(
          (
            total,
            payment,
          ) =>
            total +
            paymentAmounts(
              payment,
            ).total,
          0,
        );

      return {
        successful:
          successful.length,

        open:
          open.length,

        projectValue,

        fees,

        customerTotal,
      };
    }, [
      payments,
    ]);

  const visiblePayments =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      return payments.filter(
        (
          payment,
        ) => {
          const searchable =
            [
              payment
                .provider_reference,

              payment
                .payment_method,

              payment
                .orders
                ?.reference,

              payment
                .orders
                ?.project_title,

              payment
                .orders
                ?.service_slug,
            ]
              .filter(
                Boolean,
              )
              .join(' ')
              .toLowerCase();

          const matchesSearch =
            !query ||
            searchable.includes(
              query,
            );

          return (
            matchesSearch &&
            paymentMatchesFilter(
              payment,
              filter,
            )
          );
        },
      );
    }, [
      payments,
      search,
      filter,
    ]);

  const checkPayment =
    async (
      payment,
    ) => {
      try {
        setCheckingId(
          payment.id,
        );

        setError('');
        setMessage('');

        const result =
          await verifyPayment(
            payment.id,
          );

        if (
          result?.success
        ) {
          setMessage(
            'Payment confirmed successfully.',
          );
        } else {
          setMessage(
            result?.message ||
              'Payment has not been confirmed yet.',
          );
        }

        await loadPayments();
      } catch (
        verifyError
      ) {
        console.error(
          verifyError,
        );

        setError(
          verifyError.message ||
            'Payment status could not be checked.',
        );
      } finally {
        setCheckingId('');
      }
    };

  const copyReference =
    async (
      payment,
    ) => {
      try {
        await navigator
          .clipboard
          .writeText(
            payment
              .provider_reference,
          );

        setCopiedId(
          payment.id,
        );

        window.setTimeout(
          () =>
            setCopiedId(
              '',
            ),
          1600,
        );
      } catch {
        setError(
          'The payment reference could not be copied.',
        );
      }
    };

  if (loading) {
    return (
      <div className="workspace-loading-panel">
        <BrandLoader
          label="Loading payments..."
        />
      </div>
    );
  }

  const metricCards = [
    {
      label:
        'Confirmed project value',

      value:
        formatMoney(
          metrics.projectValue,
        ),

      detail:
        `${metrics.successful} confirmed ${metrics.successful === 1 ? 'payment' : 'payments'}`,

      icon:
        FileCheck2,

      type:
        'value',
    },
    {
      label:
        'Recorded processing fees',

      value:
        formatMoney(
          metrics.fees,
        ),

      detail:
        'Confirmed transaction fees',

      icon:
        ReceiptText,

      type:
        'fees',
    },
    {
      label:
        'Total paid',

      value:
        formatMoney(
          metrics.customerTotal,
        ),

      detail:
        'Including recorded fees',

      icon:
        CircleDollarSign,

      type:
        'paid',
    },
    {
      label:
        'Open attempts',

      value:
        metrics.open,

      detail:
        'Awaiting confirmation',

      icon:
        Clock3,

      type:
        'open',
    },
  ];

  return (
    <div className="workspace-view workspace-payments-v3 page-reveal">
      <div className="workspace-view-heading workspace-view-heading-v3 workspace-payments-heading">
        <div>
          <span className="workspace-kicker">
            PAYMENTS
          </span>

          <h2>
            Payments, clearly accounted for.
          </h2>

          <p>
            Review confirmed payments, processing fees and transaction attempts across your projects.
          </p>
        </div>

        <div className="workspace-payment-secure-badge">
          <ShieldCheck
            size={16}
          />

          Verified payments
        </div>
      </div>

      <div className="workspace-payment-metrics">
        {metricCards.map(
          (
            metric,
          ) => {
            const Icon =
              metric.icon;

            return (
              <article
                key={
                  metric.label
                }
                className={`workspace-payment-metric workspace-payment-metric-${metric.type}`}
              >
                <div>
                  <Icon
                    size={18}
                  />
                </div>

                <span>
                  {metric.label}
                </span>

                <strong>
                  {metric.value}
                </strong>

                <small>
                  {metric.detail}
                </small>
              </article>
            );
          },
        )}
      </div>

      <section className="workspace-payment-security-note">
        <ShieldCheck
          size={19}
        />

        <div>
          <strong>
            Secure payment confirmation
          </strong>

          <p>
            A transaction appears as confirmed only after its payment details have been successfully verified.
          </p>
        </div>
      </section>

      <div className="workspace-payment-controls">
        <div className="workspace-payment-search">
          <Search
            size={17}
          />

          <input
            type="search"
            value={
              search
            }
            onChange={(
              event,
            ) =>
              setSearch(
                event
                  .target
                  .value,
              )
            }
            placeholder="Search project or payment reference..."
          />
        </div>

        <div className="workspace-payment-filters">
          {filters.map(
            (
              item,
            ) => (
              <button
                type="button"
                key={
                  item.id
                }
                className={
                  filter ===
                  item.id
                    ? 'active'
                    : ''
                }
                onClick={() =>
                  setFilter(
                    item.id,
                  )
                }
              >
                {item.label}
              </button>
            ),
          )}
        </div>
      </div>

      {error && (
        <div className="workspace-alert">
          {error}
        </div>
      )}

      {message && (
        <div className="workspace-success-message">
          <CheckCircle2
            size={17}
          />

          {message}
        </div>
      )}

      {visiblePayments.length ===
      0 ? (
        <section className="workspace-panel workspace-payment-empty">
          <div>
            <ReceiptText
              size={25}
            />
          </div>

          <h3>
            {payments.length ===
            0
              ? 'No payment activity yet.'
              : 'No transactions match this view.'}
          </h3>

          <p>
            {payments.length ===
            0
              ? 'Your payment attempts and confirmed transactions will appear here.'
              : 'Try another search or payment status.'}
          </p>

          {payments.length ===
            0 && (
            <Link
              to="/dashboard/orders"
              className="button button-primary"
            >
              View projects

              <ArrowRight
                size={16}
              />
            </Link>
          )}
        </section>
      ) : (
        <div className="workspace-payment-list">
          {visiblePayments.map(
            (
              payment,
              index,
            ) => {
              const money =
                paymentAmounts(
                  payment,
                );

              const state =
                getCustomerPaymentState(
                  payment,
                );

              const MethodIcon =
                payment
                  .payment_method ===
                'opay'
                  ? Smartphone
                  : Banknote;

              const canCheck =
                [
                  'pending',
                  'processing',
                ].includes(
                  payment.status,
                );

              const confirmedDate =
                payment.verified_at ||
                payment.completed_at;

              return (
                <article
                  key={
                    payment.id
                  }
                  className={`workspace-payment-card workspace-payment-card-${state.key} stagger-item`}
                  style={{
                    '--stagger-index':
                      index,
                  }}
                >
                  <div className="workspace-payment-card-heading">
                    <div className="workspace-payment-project">
                      <div className="workspace-payment-method-icon">
                        <MethodIcon
                          size={20}
                        />
                      </div>

                      <div>
                        <small>
                          {payment
                            .orders
                            ?.reference ||
                            'PROJECT'}
                        </small>

                        <h3>
                          {payment
                            .orders
                            ?.project_title ||
                            'Posho Creative project'}
                        </h3>

                        <span>
                          {paymentMethodName(
                            payment.payment_method,
                          )}
                        </span>
                      </div>
                    </div>

                    <span
                      className={`workspace-payment-state workspace-payment-state-${state.key}`}
                    >
                      {state.key ===
                      'successful' ? (
                        <CheckCircle2
                          size={14}
                        />
                      ) : state.key ===
                        'failed' ||
                        state.key ===
                          'cancelled' ? (
                        <XCircle
                          size={14}
                        />
                      ) : (
                        <Clock3
                          size={14}
                        />
                      )}

                      {state.label}
                    </span>
                  </div>

                  <div className="workspace-payment-total-panel">
                    <div>
                      <span>
                        {state.key ===
                        'successful'
                          ? 'TOTAL PAID'
                          : 'TRANSACTION TOTAL'}
                      </span>

                      <strong>
                        {formatMoney(
                          money.total,
                          payment.currency,
                        )}
                      </strong>
                    </div>

                    <div className="workspace-payment-total-breakdown">
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
                    </div>
                  </div>

                  <div className="workspace-payment-details-grid">
                    <div>
                      <span>
                        Payment method
                      </span>

                      <strong>
                        {paymentMethodName(
                          payment.payment_method,
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
                        Confirmed
                      </span>

                      <strong>
                        {confirmedDate
                          ? formatDate(
                              confirmedDate,
                            )
                          : 'Not yet'}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Last checked
                      </span>

                      <strong>
                        {payment.last_checked_at
                          ? formatDate(
                              payment.last_checked_at,
                            )
                          : 'Not yet'}
                      </strong>
                    </div>
                  </div>

                  <div
                    className={`workspace-payment-status-message workspace-payment-status-message-${state.key}`}
                  >
                    {state.key ===
                    'successful' ? (
                      <CheckCircle2
                        size={17}
                      />
                    ) : state.key ===
                      'failed' ||
                      state.key ===
                        'cancelled' ? (
                      <AlertCircle
                        size={17}
                      />
                    ) : (
                      <Clock3
                        size={17}
                      />
                    )}

                    <p>
                      {payment.customer_message ||
                        state.description}
                    </p>
                  </div>

                  <div className="workspace-payment-reference-bar">
                    <div>
                      <span>
                        PAYMENT REFERENCE
                      </span>

                      <strong>
                        {payment.provider_reference}
                      </strong>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        copyReference(
                          payment,
                        )
                      }
                    >
                      <Copy
                        size={14}
                      />

                      {copiedId ===
                      payment.id
                        ? 'Copied'
                        : 'Copy'}
                    </button>
                  </div>

                  {state.key ===
                    'successful' && (
                    <details className="workspace-payment-receipt">
                      <summary>
                        <ReceiptText
                          size={15}
                        />

                        Receipt details

                        <ArrowRight
                          size={14}
                        />
                      </summary>

                      <div className="workspace-payment-receipt-body">
                        <div className="workspace-payment-receipt-brand">
                          <div>
                            <span>
                              POSHO CREATIVE
                            </span>

                            <strong>
                              Payment receipt
                            </strong>
                          </div>

                          <CheckCircle2
                            size={22}
                          />
                        </div>

                        <div className="workspace-payment-receipt-grid">
                          <div>
                            <span>
                              Project
                            </span>

                            <strong>
                              {payment
                                .orders
                                ?.project_title}
                            </strong>
                          </div>

                          <div>
                            <span>
                              Project reference
                            </span>

                            <strong>
                              {payment
                                .orders
                                ?.reference}
                            </strong>
                          </div>

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
                              Total paid
                            </span>

                            <strong>
                              {formatMoney(
                                money.total,
                                payment.currency,
                              )}
                            </strong>
                          </div>

                          <div>
                            <span>
                              Method
                            </span>

                            <strong>
                              {paymentMethodName(
                                payment.payment_method,
                              )}
                            </strong>
                          </div>

                          <div>
                            <span>
                              Payment reference
                            </span>

                            <strong>
                              {payment.provider_reference}
                            </strong>
                          </div>

                          <div>
                            <span>
                              Confirmed
                            </span>

                            <strong>
                              {formatDate(
                                confirmedDate,
                              )}
                            </strong>
                          </div>
                        </div>

                        <div className="workspace-payment-receipt-confirmation">
                          <ShieldCheck
                            size={16}
                          />

                          Payment confirmed
                        </div>
                      </div>
                    </details>
                  )}

                  <div className="workspace-payment-card-actions">
                    {canCheck && (
                      <button
                        type="button"
                        className="workspace-payment-check-button"
                        onClick={() =>
                          checkPayment(
                            payment,
                          )
                        }
                        disabled={
                          checkingId ===
                          payment.id
                        }
                      >
                        <RefreshCw
                          size={15}
                        />

                        {checkingId ===
                        payment.id
                          ? 'Checking payment...'
                          : 'Check payment status'}
                      </button>
                    )}

                    {payment
                      .orders
                      ?.reference && (
                      <Link
                        to={`/dashboard/orders/${payment.orders.reference}`}
                      >
                        Open project

                        <ArrowRight
                          size={15}
                        />
                      </Link>
                    )}
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