import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  Clock3,
  RefreshCw,
  Search,
  Settings2,
  Smartphone,
  XCircle,
} from 'lucide-react';

import {
  getAdminPaymentAttempts,
  getPaymentMethodSettings,
  recheckAdminPayment,
  updatePaymentMethodEnabled,
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
  value,
) {
  if (
    value ===
    'bank_transfer'
  ) {
    return 'Bank transfer';
  }

  if (
    value ===
    'opay'
  ) {
    return 'OPay';
  }

  return formatOrderStatus(
    value ||
      'unknown',
  );
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

export default function AdminPayments() {
  const [
    payments,
    setPayments,
  ] =
    useState([]);

  const [
    methods,
    setMethods,
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
    busy,
    setBusy,
  ] =
    useState('');

  const [
    methodBusy,
    setMethodBusy,
  ] =
    useState('');

  const [
    error,
    setError,
  ] =
    useState('');

  const [
    success,
    setSuccess,
  ] =
    useState('');

  const load =
    async () => {
      try {
        setError('');

        const [
          paymentRows,
          methodRows,
        ] =
          await Promise.all([
            getAdminPaymentAttempts(),
            getPaymentMethodSettings(),
          ]);

        setPayments(
          paymentRows,
        );

        setMethods(
          methodRows,
        );
      } catch (
        loadError
      ) {
        console.error(
          loadError,
        );

        setError(
          'Payment operations could not be loaded.',
        );
      } finally {
        setLoading(
          false,
        );
      }
    };

  useEffect(() => {
    document.title =
      'Payment Operations | Posho Creative Management';

    load();
  }, []);

  const visible =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      return payments.filter(
        (payment) => {
          const searchable =
            [
              payment
                .provider_reference,

              payment
                .provider_transaction_id,

              payment
                .orders
                ?.reference,

              payment
                .orders
                ?.project_title,

              payment
                .orders
                ?.customers
                ?.full_name,

              payment
                .orders
                ?.customers
                ?.email,

              payment
                .payment_method,
            ]
              .filter(Boolean)
              .join(' ')
              .toLowerCase();

          const matchesSearch =
            !query ||
            searchable.includes(
              query,
            );

          const matchesFilter =
            filter ===
              'all' ||
            payment.status ===
              filter;

          return (
            matchesSearch &&
            matchesFilter
          );
        },
      );
    }, [
      payments,
      search,
      filter,
    ]);

  const successful =
    payments.filter(
      (payment) =>
        payment.status ===
        'successful',
    );

  const failed =
    payments.filter(
      (payment) =>
        payment.status ===
        'failed',
    );

  const open =
    payments.filter(
      (payment) =>
        [
          'pending',
          'processing',
        ].includes(
          payment.status,
        ),
    );

  const received =
    successful.reduce(
      (
        total,
        payment,
      ) =>
        total +
        Number(
          payment
            .base_amount_kobo ??
            payment
              .amount_kobo ??
            0,
        ),
      0,
    );

  const providerFees =
    successful.reduce(
      (
        total,
        payment,
      ) =>
        total +
        Number(
          payment
            .actual_provider_fee_kobo ||
            0,
        ),
      0,
    );

  const recheck =
    async (
      paymentId,
    ) => {
      try {
        setBusy(
          paymentId,
        );

        setError('');
        setSuccess('');

        await recheckAdminPayment(
          paymentId,
        );

        setSuccess(
          'Transaction status refreshed successfully.',
        );

        await load();
      } catch (
        actionError
      ) {
        setError(
          actionError.message,
        );
      } finally {
        setBusy('');
      }
    };

  const toggleMethod =
    async (
      setting,
    ) => {
      if (
        setting
          .method_key ===
          'opay' &&
        !setting.enabled
      ) {
        const confirmed =
          window.confirm(
            'Only enable OPay after Flutterwave has enabled OPay collections for this merchant account. Continue?',
          );

        if (
          !confirmed
        ) {
          return;
        }
      }

      try {
        setMethodBusy(
          setting
            .method_key,
        );

        setError('');
        setSuccess('');

        await updatePaymentMethodEnabled({
          methodKey:
            setting
              .method_key,

          enabled:
            !setting
              .enabled,
        });

        setSuccess(
          `${setting.display_name} has been ${setting.enabled ? 'paused' : 'enabled'}.`,
        );

        await load();
      } catch (
        actionError
      ) {
        setError(
          actionError.message,
        );
      } finally {
        setMethodBusy('');
      }
    };

  if (loading) {
    return (
      <div className="admin-clean-state">
        Loading payment operations...
      </div>
    );
  }

  return (
    <div className="admin-view page-reveal">
      <div className="admin-view-heading">
        <div>
          <span>
            PAYMENT OPERATIONS
          </span>

          <h1>
            Transactions.
          </h1>

          <p>
            Manage payment availability, transaction attempts, provider fees and verified customer payments.
          </p>
        </div>
      </div>

      {error && (
        <div className="admin-error">
          {error}
        </div>
      )}

      {success && (
        <div className="workspace-success-message">
          {success}
        </div>
      )}

      <section className="admin-payment-method-settings">
        <div className="admin-payment-method-settings-heading">
          <div>
            <Settings2
              size={20}
            />

            <div>
              <span>
                CHECKOUT CONTROL
              </span>

              <h2>
                Payment methods
              </h2>
            </div>
          </div>

          <p>
            Only enable methods that are available on the active Flutterwave merchant account.
          </p>
        </div>

        <div className="admin-payment-method-control-grid">
          {methods.map(
            (
              setting,
            ) => (
              <article
                key={
                  setting
                    .method_key
                }
                className={
                  setting.enabled
                    ? 'admin-payment-method-control enabled'
                    : 'admin-payment-method-control paused'
                }
              >
                <div>
                  {setting
                    .method_key ===
                  'opay' ? (
                    <Smartphone
                      size={20}
                    />
                  ) : (
                    <Banknote
                      size={20}
                    />
                  )}

                  <div>
                    <strong>
                      {setting
                        .display_name}
                    </strong>

                    <span>
                      {setting.enabled
                        ? 'Available to customers'
                        : 'Paused'}
                    </span>
                  </div>
                </div>

                <p>
                  {setting
                    .description}
                </p>

                <button
                  type="button"
                  disabled={
                    methodBusy ===
                    setting
                      .method_key
                  }
                  onClick={() =>
                    toggleMethod(
                      setting,
                    )
                  }
                >
                  {methodBusy ===
                  setting
                    .method_key
                    ? 'Saving...'
                    : setting.enabled
                      ? 'Pause method'
                      : 'Enable method'}
                </button>
              </article>
            ),
          )}
        </div>
      </section>

      <div className="admin-payment-overview">
        <article>
          <Clock3
            size={18}
          />

          <span>
            Open
          </span>

          <strong>
            {open.length}
          </strong>
        </article>

        <article>
          <CheckCircle2
            size={18}
          />

          <span>
            Successful
          </span>

          <strong>
            {successful.length}
          </strong>
        </article>

        <article>
          <XCircle
            size={18}
          />

          <span>
            Failed
          </span>

          <strong>
            {failed.length}
          </strong>
        </article>

        <article>
          <Banknote
            size={18}
          />

          <span>
            Confirmed project value
          </span>

          <strong>
            {formatMoney(
              received,
            )}
          </strong>
        </article>

        <article>
          <ReceiptTextFallback />

          <span>
            Provider fees recorded
          </span>

          <strong>
            {formatMoney(
              providerFees,
            )}
          </strong>
        </article>
      </div>

      <div className="admin-payment-toolbar">
        <div className="admin-search">
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
            placeholder="Search project, customer or transaction..."
          />
        </div>

        <div className="admin-filter-tabs">
          {[
            'all',
            'pending',
            'processing',
            'successful',
            'failed',
            'cancelled',
          ].map(
            (
              value,
            ) => (
              <button
                type="button"
                key={
                  value
                }
                className={
                  filter ===
                  value
                    ? 'active'
                    : ''
                }
                onClick={() =>
                  setFilter(
                    value,
                  )
                }
              >
                {formatOrderStatus(
                  value,
                )}
              </button>
            ),
          )}
        </div>
      </div>

      <div className="admin-global-payment-list">
        {visible.length ===
        0 ? (
          <div className="admin-clean-state">
            No transactions match this view.
          </div>
        ) : (
          visible.map(
            (
              payment,
            ) => {
              const diagnostic =
                payment
                  .payment_attempt_diagnostics
                  ?.[0];

              const amounts =
                paymentAmounts(
                  payment,
                );

              return (
                <article
                  key={
                    payment.id
                  }
                  className="admin-global-payment-card"
                >
                  <div className="admin-global-payment-heading">
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
                            .orders
                            ?.customers
                            ?.full_name ||
                            payment
                              .orders
                              ?.customers
                              ?.email}
                        </span>
                      </div>
                    </div>

                    <span
                      className={`admin-payment-status admin-payment-status-${payment.status}`}
                    >
                      {formatOrderStatus(
                        payment.status,
                      )}
                    </span>
                  </div>

                  <div className="admin-payment-money-grid">
                    <div>
                      <span>
                        Project amount
                      </span>

                      <strong>
                        {formatMoney(
                          amounts.base,
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
                          amounts.fee,
                          payment.currency,
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Customer total
                      </span>

                      <strong>
                        {formatMoney(
                          amounts.total,
                          payment.currency,
                        )}
                      </strong>
                    </div>
                  </div>

                  <div className="admin-global-payment-core">
                    <div>
                      <span>
                        Method
                      </span>

                      <strong>
                        {methodName(
                          payment.payment_method,
                        )}
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
                  </div>

                  <div className="admin-payment-reference-panel">
                    <div>
                      <span>
                        Provider reference
                      </span>

                      <strong>
                        {payment.provider_reference ||
                          '—'}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Charge ID
                      </span>

                      <strong>
                        {payment.provider_transaction_id ||
                          '—'}
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
                        Last checked
                      </span>

                      <strong>
                        {formatDate(
                          payment.last_checked_at,
                        )}
                      </strong>
                    </div>
                  </div>

                  {payment.failure_code && (
                    <div className="admin-payment-failure-code">
                      <AlertTriangle
                        size={16}
                      />

                      <span>
                        {payment.failure_code}
                      </span>
                    </div>
                  )}

                  {payment.customer_message && (
                    <div className="admin-payment-customer-message">
                      <span>
                        CUSTOMER STATUS
                      </span>

                      <p>
                        {payment.customer_message}
                      </p>
                    </div>
                  )}

                  {diagnostic?.internal_message && (
                    <div className="admin-payment-internal-message">
                      <AlertTriangle
                        size={16}
                      />

                      <div>
                        <span>
                          LATEST INTERNAL EVENT
                        </span>

                        <p>
                          {diagnostic.internal_message}
                        </p>
                      </div>
                    </div>
                  )}

                  {![
                    'successful',
                    'cancelled',
                  ].includes(
                    payment.status,
                  ) && (
                    <button
                      type="button"
                      className="admin-payment-recheck"
                      onClick={() =>
                        recheck(
                          payment.id,
                        )
                      }
                      disabled={
                        busy ===
                        payment.id
                      }
                    >
                      <RefreshCw
                        size={16}
                      />

                      {busy ===
                      payment.id
                        ? 'Checking transaction...'
                        : 'Recheck transaction'}
                    </button>
                  )}
                </article>
              );
            },
          )
        )}
      </div>
    </div>
  );
}

function ReceiptTextFallback() {
  return (
    <Banknote
      size={18}
    />
  );
}