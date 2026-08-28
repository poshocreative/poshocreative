import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  BadgeCheck,
  BellRing,
  CalendarClock,
  ExternalLink,
  RefreshCw,
  XCircle,
} from 'lucide-react';

import Link from '../PortalLink';

import {
  useAuth,
} from '../../context/AuthContext';

import {
  formatMoney,
} from '../../lib/orders';

import {
  getAdminPartPaymentInbox,
  reviewProjectPartPayment,
} from '../../lib/projectFinance';

function dateFromNow(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function toEndOfDay(value) {
  return value
    ? new Date(`${value}T23:59:59`).toISOString()
    : null;
}

function formatDate(value) {
  return new Intl.DateTimeFormat('en-NG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export default function AdminPartPaymentInbox() {
  const {
    adminPath,
  } = useAuth();

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reviewing, setReviewing] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState({
    approvalExpiry: dateFromNow(7),
    balanceDue: dateFromNow(37),
    note: '',
    allowWorkToStart: false,
  });

  const load = useCallback(async ({ quiet = false } = {}) => {
    try {
      if (!quiet) {
        setRefreshing(true);
      }
      setError('');
      setRequests(await getAdminPartPaymentInbox());
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load({ quiet: true });

    const refresh = () => load({ quiet: true });
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
    };
  }, [load]);

  const openReview = (request) => {
    setReviewing(request);
    setForm({
      approvalExpiry: dateFromNow(7),
      balanceDue: dateFromNow(37),
      note: '',
      allowWorkToStart: false,
    });
    setError('');
    setSuccess('');
  };

  const decide = async (decision) => {
    if (!reviewing) {
      return;
    }

    if (
      decision === 'decline' &&
      form.note.trim().length < 5
    ) {
      setError('Add a clear reason before declining this request.');
      return;
    }

    if (
      decision === 'approve' &&
      new Date(form.balanceDue) < new Date(form.approvalExpiry)
    ) {
      setError('The remaining-balance date cannot be earlier than the approval expiry.');
      return;
    }

    try {
      setProcessing(true);
      setError('');
      setSuccess('');

      await reviewProjectPartPayment({
        requestId: reviewing.id,
        decision,
        approvedAmountKobo:
          decision === 'approve'
            ? Number(reviewing.requested_amount_kobo)
            : null,
        approvalExpiresAt:
          decision === 'approve'
            ? toEndOfDay(form.approvalExpiry)
            : null,
        balanceDueAt:
          decision === 'approve'
            ? toEndOfDay(form.balanceDue)
            : null,
        adminNote: form.note,
        allowWorkToStart: form.allowWorkToStart,
      });

      setSuccess(
        decision === 'approve'
          ? 'Installment approved. The customer has been notified and can now pay securely.'
          : 'Request declined. The customer has been notified with your reason.',
      );
      setReviewing(null);
      await load({ quiet: true });
      window.dispatchEvent(
        new CustomEvent('posho:admin-part-payments-changed'),
      );
    } catch (decisionError) {
      setError(decisionError.message);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <section className="admin-part-payment-inbox">
      <div className="admin-part-payment-inbox-heading">
        <div>
          <span>PART-PAYMENT INBOX</span>
          <h2>Customer requests</h2>
          <p>
            New requests appear here automatically. Review the requested amount and respond before payment is enabled.
          </p>
        </div>

        <div className="admin-part-payment-inbox-actions">
          <span className="admin-request-count">
            <BellRing size={17} />
            {requests.length} pending
          </span>

          <button
            type="button"
            onClick={() => load()}
            disabled={refreshing}
            aria-label="Refresh part-payment requests"
          >
            <RefreshCw size={17} />
          </button>
        </div>
      </div>

      {error && <div className="finance-error-message">{error}</div>}
      {success && <div className="finance-success-message">{success}</div>}

      {loading ? (
        <p className="finance-muted-message">Loading customer requests...</p>
      ) : requests.length === 0 ? (
        <div className="admin-part-payment-empty">
          <BadgeCheck size={22} />
          <div>
            <strong>No pending part-payment requests</strong>
            <p>New customer requests will be shown here and counted in the Management navigation.</p>
          </div>
        </div>
      ) : (
        <div className="admin-part-payment-list">
          {requests.map((request) => {
            const order = request.orders || {};
            const customer = order.customers || {};
            const outstanding = Math.max(
              Number(order.quoted_amount_kobo || 0) -
                Number(order.paid_amount_kobo || 0),
              0,
            );

            return (
              <article key={request.id} className="admin-part-payment-item">
                <div className="admin-part-payment-item-main">
                  <div className="admin-part-payment-item-topline">
                    <span>NEW REQUEST</span>
                    <time>{formatDate(request.created_at)}</time>
                  </div>

                  <h3>{order.project_title}</h3>
                  <p className="admin-part-payment-customer">
                    {customer.full_name || customer.email} · {order.reference}
                  </p>
                  <p className="admin-part-payment-reason">
                    {request.reason || 'No additional note was provided.'}
                  </p>

                  <Link
                    to={adminPath(`orders/${order.reference}`)}
                    className="admin-part-payment-project-link"
                  >
                    Open full project <ExternalLink size={14} />
                  </Link>
                </div>

                <div className="admin-part-payment-amounts">
                  <div>
                    <span>Requested now</span>
                    <strong>{formatMoney(request.requested_amount_kobo)}</strong>
                  </div>
                  <div>
                    <span>Outstanding</span>
                    <strong>{formatMoney(outstanding)}</strong>
                  </div>
                  <button
                    type="button"
                    className="button button-primary"
                    onClick={() => openReview(request)}
                  >
                    Review request
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {reviewing && (
        <div className="admin-part-payment-review" role="dialog" aria-modal="true">
          <div className="admin-part-payment-review-card">
            <div className="admin-part-payment-review-heading">
              <div>
                <span>MANAGEMENT RESPONSE</span>
                <h3>{reviewing.orders?.project_title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setReviewing(null)}
                aria-label="Close review"
              >
                <XCircle size={21} />
              </button>
            </div>

            <div className="finance-review-requested-amount">
              <span>Customer requested</span>
              <strong>{formatMoney(reviewing.requested_amount_kobo)}</strong>
              <small>Approval enables payment for this exact installment amount.</small>
            </div>

            <div className="finance-review-grid">
              <label>
                <span>Payment approval expires</span>
                <input
                  type="date"
                  value={form.approvalExpiry}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      approvalExpiry: event.target.value,
                    }))
                  }
                />
              </label>

              <label>
                <span>Remaining balance due</span>
                <input
                  type="date"
                  value={form.balanceDue}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      balanceDue: event.target.value,
                    }))
                  }
                />
              </label>
            </div>

            <label className="admin-part-payment-note">
              <span>Message to customer</span>
              <textarea
                value={form.note}
                maxLength="3000"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    note: event.target.value,
                  }))
                }
                placeholder="Explain the approved terms or give a clear reason for declining."
              />
            </label>

            <label className="finance-checkbox-row">
              <input
                type="checkbox"
                checked={form.allowWorkToStart}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    allowWorkToStart: event.target.checked,
                  }))
                }
              />
              <span>Work may begin after this installment is confirmed.</span>
            </label>

            <div className="finance-review-actions">
              <button
                type="button"
                className="button button-secondary"
                onClick={() => setReviewing(null)}
                disabled={processing}
              >
                Cancel
              </button>
              <button
                type="button"
                className="finance-decline-button"
                onClick={() => decide('decline')}
                disabled={processing}
              >
                <XCircle size={17} /> Decline
              </button>
              <button
                type="button"
                className="button button-primary"
                onClick={() => decide('approve')}
                disabled={processing}
              >
                <CalendarClock size={17} />
                {processing ? 'Saving...' : 'Approve installment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
