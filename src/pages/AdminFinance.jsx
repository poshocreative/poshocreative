import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  ArrowRight,
} from 'lucide-react';

import Link from '../components/PortalLink';

import BrandLoader from '../components/BrandLoader';
import PageHeader from '../components/ui/PageHeader';
import MetricCard from '../components/ui/MetricCard';
import StatusBadge from '../components/ui/StatusBadge';
import Tabs from '../components/ui/Tabs';
import {
  EmptyState,
  ErrorBlock,
} from '../components/ui/StateBlocks';

import {
  useToast,
} from '../components/ui/Toast';

import {
  getAdminOrders,
  getAdminPayments,
} from '../lib/admin';

import {
  agingBucket,
  formatNaira,
  toCsv,
} from '../lib/reports';

function dueInfo(order, nowMs) {
  const outstanding = Math.max(
    Number(order.quoted_amount_kobo || 0) -
      Number(order.paid_amount_kobo || 0),
    0,
  );

  if (outstanding <= 0) {
    return { outstanding, dueDate: null, daysOverdue: 0 };
  }

  const dueDate =
    order.payment_due_at || order.deadline || null;

  let daysOverdue = 0;

  if (dueDate) {
    daysOverdue = Math.ceil(
      (nowMs - new Date(dueDate).getTime()) / 86400000,
    );
  }

  return {
    outstanding,
    dueDate,
    daysOverdue: daysOverdue > 0 ? daysOverdue : 0,
  };
}

export default function AdminFinance() {
  const toast = useToast();

  const [tab, setTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [orders, setOrders] = useState([]);
  const [payments, setPayments] = useState([]);
  const [now] = useState(() => Date.now());

  const load = useCallback(async () => {
    try {
      setError('');
      setLoading(true);

      const [orderRows, paymentRows] = await Promise.all([
        getAdminOrders(),
        getAdminPayments(),
      ]);

      setOrders(orderRows);
      setPayments(paymentRows);
    } catch (loadError) {
      setError(
        loadError.message || 'Finance data could not be loaded.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    document.title = 'Finance | Posho Creative Management';
    load();
  }, [load]);

  const computed = useMemo(() => {
    const approved = orders.filter(
      (order) =>
        order.review_decision === 'approved' && !order.archived_at,
    );

    const successful = payments.filter(
      (payment) => payment.status === 'successful',
    );

    const collected = successful.reduce(
      (sum, payment) =>
        sum + Number(payment.amount_kobo || 0),
      0,
    );

    const manual = successful.filter(
      (payment) =>
        payment.provider === 'manual' ||
        payment.payment_method === 'manual',
    ).length;

    const failed = payments.filter((payment) =>
      ['failed', 'cancelled'].includes(payment.status),
    ).length;

    const pendingProvider = payments.filter((payment) =>
      ['pending', 'processing'].includes(payment.status),
    );

    const receivables = approved
      .map((order) => ({
        order,
        ...dueInfo(order, now),
      }))
      .filter((row) => row.outstanding > 0);

    const overdue = receivables.filter(
      (row) => row.daysOverdue > 0,
    );

    const buckets = new Map();

    for (const row of receivables) {
      const bucket = row.dueDate
        ? agingBucket(row.daysOverdue)
        : 'No due date';

      if (!buckets.has(bucket)) {
        buckets.set(bucket, { bucket, amount: 0, rows: [] });
      }

      const entry = buckets.get(bucket);
      entry.amount += row.outstanding;
      entry.rows.push(row);
    }

    const today = new Date(now).toISOString().slice(0, 10);
    const horizon = (days) =>
      new Date(now + days * 86400000)
        .toISOString()
        .slice(0, 10);

    const expected = (days) =>
      receivables
        .filter(
          (row) =>
            row.dueDate &&
            row.dueDate >= today &&
            row.dueDate <= horizon(days),
        )
        .reduce((sum, row) => sum + row.outstanding, 0);

    const unscheduled = receivables
      .filter((row) => !row.dueDate)
      .reduce((sum, row) => sum + row.outstanding, 0);

    const outstanding = receivables.reduce(
      (sum, row) => sum + row.outstanding,
      0,
    );

    return {
      collected,
      manual,
      failed,
      pendingProvider,
      receivables,
      overdue,
      overdueKobo: overdue.reduce(
        (sum, row) => sum + row.outstanding,
        0,
      ),
      outstanding,
      buckets: [...buckets.values()],
      expected7: expected(7),
      expected30: expected(30),
      expected60: expected(60),
      unscheduled,
    };
  }, [orders, payments, now]);

  const exportAging = () => {
    const rows = computed.receivables.map((row) => ({
      project: row.order.reference,
      title: row.order.project_title,
      client:
        row.order.customers?.full_name ||
        row.order.customers?.email ||
        '',
      outstanding_ngn: (row.outstanding / 100).toFixed(2),
      due_date: row.dueDate || '',
      days_overdue: row.daysOverdue,
      bucket: row.dueDate
        ? agingBucket(row.daysOverdue)
        : 'No due date',
    }));

    if (!toCsv('receivables-aging.csv', rows)) {
      toast.info('No receivables to export.');
      return;
    }

    toast.success('Receivables exported as CSV.');
  };

  if (loading) {
    return <BrandLoader label="Loading finance…" />;
  }

  return (
    <div className="admin-view page-reveal">
      <PageHeader
        kicker="Finance"
        title="Cash command center"
        description="Collected is collected. Pending is not revenue. Dated balances drive the forecast."
        actions={
          <>
            <Link
              to="/admin/payments"
              className="button button-secondary"
            >
              Transactions <ArrowRight size={15} />
            </Link>

            <Link
              to="/admin/quotes"
              className="button button-secondary"
            >
              Quotes <ArrowRight size={15} />
            </Link>

            <Link
              to="/admin/pricing"
              className="button button-secondary"
            >
              Pricing <ArrowRight size={15} />
            </Link>
          </>
        }
      />

      {error && <ErrorBlock message={error} onRetry={load} />}

      <div className="admin-dashboard-stat-grid">
        <MetricCard
          label="Collected"
          value={formatNaira(computed.collected)}
          detail="Successful transactions only"
          tone="green"
        />

        <MetricCard
          label="Outstanding"
          value={formatNaira(computed.outstanding)}
          detail="Approved unpaid balances"
          tone="amber"
        />

        <MetricCard
          label="Overdue"
          value={formatNaira(computed.overdueKobo)}
          detail={`${computed.overdue.length} overdue balance${computed.overdue.length === 1 ? '' : 's'}`}
          tone={computed.overdueKobo > 0 ? 'red' : 'neutral'}
        />

        <MetricCard
          label="Expected · 30 days"
          value={formatNaira(computed.expected30)}
          detail="Dated balances only"
          tone="purple"
        />
      </div>

      <Tabs
        tabs={[
          { key: 'overview', label: 'Overview' },
          {
            key: 'aging',
            label: 'Aging',
            count: computed.overdue.length,
          },
          { key: 'forecast', label: 'Forecast' },
          {
            key: 'provider',
            label: 'Provider queue',
            count: computed.pendingProvider.length,
          },
        ]}
        active={tab}
        onChange={setTab}
        label="Finance sections"
      />

      {tab === 'overview' && (
        <div className="admin-data-card">
          <article className="admin-data-row">
            <div>
              <strong>Manual payments recorded</strong>
              <span>
                Bank, cash and offline entries in the ledger
              </span>
            </div>

            <strong>{computed.manual}</strong>
          </article>

          <article className="admin-data-row">
            <div>
              <strong>Failed provider payments</strong>
              <span>Never counted as revenue</span>
            </div>

            <strong>{computed.failed}</strong>
          </article>

          <article className="admin-data-row">
            <div>
              <strong>Unscheduled outstanding</strong>
              <span>Balances with no known due date</span>
            </div>

            <strong>{formatNaira(computed.unscheduled)}</strong>
          </article>
        </div>
      )}

      {tab === 'aging' && (
        <>
          <div className="finance-review-actions">
            <button
              type="button"
              className="button button-secondary"
              onClick={exportAging}
            >
              Export CSV
            </button>
          </div>

          {computed.buckets.length === 0 ? (
            <EmptyState
              title="No outstanding balances"
              body="Every approved project is fully collected."
            />
          ) : (
            computed.buckets.map((bucket) => (
              <section
                key={bucket.bucket}
                className="admin-control-card"
              >
                <div className="finance-request-heading">
                  <div>
                    <span>AGING</span>
                    <h3>{bucket.bucket}</h3>
                  </div>

                  <strong>{formatNaira(bucket.amount)}</strong>
                </div>

                <div className="posho-report-list">
                  {bucket.rows.map((row) => (
                    <div
                      key={row.order.id}
                      className="posho-report-row"
                    >
                      <header>
                        <Link
                          to={`/admin/orders/${row.order.reference}`}
                          className="posho-long-value"
                        >
                          {row.order.reference} ·{' '}
                          {row.order.project_title}
                        </Link>

                        <strong>
                          {formatNaira(row.outstanding)}
                        </strong>
                      </header>

                      <small>
                        {row.order.customers?.full_name ||
                          row.order.customers?.email ||
                          ''}
                        {row.dueDate
                          ? ` · Due ${row.dueDate}`
                          : ' · No due date'}
                        {row.daysOverdue > 0 &&
                          ` · ${row.daysOverdue}d overdue`}
                      </small>
                    </div>
                  ))}
                </div>
              </section>
            ))
          )}
        </>
      )}

      {tab === 'forecast' && (
        <section className="admin-control-card">
          <div className="finance-request-heading">
            <div>
              <span>COLLECTION FORECAST</span>
              <h3>What is expected</h3>

              <p className="admin-card-description">
                Expected balances have known due dates. Everything else is
                unscheduled — chased, not forecast.
              </p>
            </div>
          </div>

          <div className="posho-report-list">
            {[
              {
                label: 'Next 7 days · expected',
                amount: computed.expected7,
              },
              {
                label: 'Next 30 days · expected',
                amount: computed.expected30,
              },
              {
                label: 'Next 60 days · expected',
                amount: computed.expected60,
              },
              {
                label: 'Unscheduled outstanding',
                amount: computed.unscheduled,
              },
            ].map((row) => (
              <div key={row.label} className="posho-report-row">
                <header>
                  <span>{row.label}</span>
                  <strong>{formatNaira(row.amount)}</strong>
                </header>

                <div className="posho-report-bar">
                  <span
                    style={{
                      width: `${computed.outstanding > 0 ? Math.min(100, Math.round((row.amount / computed.outstanding) * 100)) : 0}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === 'provider' && (
        <>
          {computed.pendingProvider.length === 0 ? (
            <EmptyState
              title="Provider queue clear"
              body="No pending or processing provider payments."
            />
          ) : (
            <div className="admin-data-card">
              {computed.pendingProvider.map((payment) => (
                <article
                  key={payment.id}
                  className="admin-data-row"
                >
                  <div>
                    <small className="posho-long-value">
                      {payment.provider_reference}
                    </small>

                    <strong>
                      {formatNaira(payment.amount_kobo)}
                    </strong>

                    <span>
                      {payment.orders?.reference || ''} ·{' '}
                      {payment.orders?.project_title || ''}
                    </span>
                  </div>

                  <div>
                    <StatusBadge value={payment.status} />
                  </div>

                  <div>
                    <Link
                      to="/admin/payments"
                      className="button button-secondary"
                    >
                      Review
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
