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
    error,
    setError,
  ] =
    useState('');

  const load =
    async () => {
      try {
        setError('');

        setPayments(
          await getAdminPaymentAttempts(),
        );
      } catch (
        loadError
      ) {
        console.error(
          loadError,
        );

        setError(
          'Payment activity could not be loaded.',
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
          payment.amount_kobo ||
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

        await recheckAdminPayment(
          paymentId,
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
            Review every payment attempt, provider status, failure and verified transaction across Posho Creative.
          </p>
        </div>
      </div>

      {error && (
        <div className="admin-error">
          {error}
        </div>
      )}

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
            Confirmed value
          </span>

          <strong>
            {formatMoney(
              received,
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
        {visible.map(
          (
            payment,
          ) => {
            const diagnostic =
              payment
                .payment_attempt_diagnostics
                ?.[0];

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
                      Amount
                    </span>

                    <strong>
                      {formatMoney(
                        payment.amount_kobo,
                        payment.currency,
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
                </div>

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
                      ? 'Checking Flutterwave...'
                      : 'Recheck transaction'}
                  </button>
                )}
              </article>
            );
          },
        )}
      </div>
    </div>
  );
}