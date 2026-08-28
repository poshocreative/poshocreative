import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  BadgeCheck,
  CalendarClock,
  HandCoins,
  XCircle,
} from 'lucide-react';

import {
  formatMoney,
  formatOrderStatus,
} from '../../lib/orders';

import {
  getPartPaymentState,
  reviewProjectPartPayment,
} from '../../lib/projectFinance';

function toIsoDate(value) {
  return value ? new Date(`${value}T23:59:59`).toISOString() : null;
}
function formatDate(value) {
  if (!value) {
    return 'Not specified';
  }

  return new Intl.DateTimeFormat('en-NG', {
    dateStyle: 'medium',
  }).format(new Date(value));
}

function dateInputFromNow(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export default function AdminPaymentRequestManager({
  orderId,
  outstandingKobo,
  onUpdated,
}) {
  const [requests, setRequests] = useState([]);
  const [available, setAvailable] = useState(true);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [form, setForm] = useState({
    amount: '',
    approvalExpiry: '',
    balanceDue: '',
    note: '',
    allowWorkToStart: false,
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    if (!orderId) {
      setRequests([]);
      setAvailable(true);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError('');
      const state = await getPartPaymentState(orderId);
      setRequests(state.requests);
      setAvailable(state.available);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    load();
  }, [load]);

  const openReview = (request) => {
    setSelectedRequest(request);
    setForm({
      amount:
        request.requested_amount_kobo > 0
          ? String(request.requested_amount_kobo / 100)
          : '',
      approvalExpiry: dateInputFromNow(7),
      balanceDue: dateInputFromNow(37),
      note: '',
      allowWorkToStart: false,
    });
    setError('');
    setSuccess('');
  };

  const saveDecision = async (decision) => {
    if (!selectedRequest) {
      return;
    }

    const requestedAmountKobo = Number(
      selectedRequest.requested_amount_kobo || 0,
    );
    const amountKobo = requestedAmountKobo > 0
      ? requestedAmountKobo
      : Math.round(Number(form.amount) * 100);

    if (
      decision === 'approve' &&
      (!Number.isFinite(amountKobo) ||
        amountKobo <= 0 ||
        amountKobo >= outstandingKobo)
    ) {
      setError(
        'Enter an installment greater than zero and lower than the full outstanding balance.',
      );
      return;
    }

    if (decision === 'decline' && form.note.trim().length < 5) {
      setError('Add a clear reason before declining the request.');
      return;
    }

    if (
      decision === 'approve' &&
      form.approvalExpiry &&
      form.balanceDue &&
      new Date(form.balanceDue) < new Date(form.approvalExpiry)
    ) {
      setError(
        'The remaining-balance due date cannot be earlier than the installment expiry date.',
      );
      return;
    }

    try {
      setProcessing(true);
      setError('');
      setSuccess('');

      await reviewProjectPartPayment({
        requestId: selectedRequest.id,
        decision,
        approvedAmountKobo: decision === 'approve' ? amountKobo : null,
        approvalExpiresAt:
          decision === 'approve' ? toIsoDate(form.approvalExpiry) : null,
        balanceDueAt:
          decision === 'approve' ? toIsoDate(form.balanceDue) : null,
        adminNote: form.note,
        allowWorkToStart: form.allowWorkToStart,
      });

      setSuccess(
        decision === 'approve'
          ? 'The installment has been approved and the customer can now pay it.'
          : 'The request has been declined and the customer can see the reason.',
      );
      setSelectedRequest(null);
      await load();
      await onUpdated?.();
    } catch (decisionError) {
      setError(decisionError.message);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <section className="admin-control-card admin-payment-request-manager">
      <div className="finance-request-heading">
        <div>
          <span>PAYMENT ARRANGEMENTS</span>
          <h2>Part-payment requests</h2>
          <p className="admin-card-description">
            Review the amount requested for this project, then approve it or
            decline it with a clear explanation.
          </p>
        </div>
        <HandCoins size={22} />
      </div>

      <div className="finance-balance-strip">
        <span>Outstanding project balance</span>
        <strong>{formatMoney(outstandingKobo)}</strong>
      </div>

      {loading ? (
        <p className="finance-muted-message">Loading payment requests...</p>
      ) : !available ? (
        <div className="finance-capability-notice" role="status">
          <CalendarClock size={20} />
          <div>
            <strong>Part-payment setup is pending</strong>
            <p>
              The project database update has not reached this environment yet.
              Other project controls remain available.
            </p>
          </div>
        </div>
      ) : requests.length === 0 ? (
        <div className="admin-project-empty-state admin-project-empty-state-small">
          <span>No part-payment requests have been submitted for this project.</span>
        </div>
      ) : (
        <div className="finance-admin-request-list">
          {requests.map((request) => (
            <article key={request.id} className="finance-admin-request">
              <div className="finance-admin-request-topline">
                <span
                  className={`finance-status-pill finance-status-pill-${request.status}`}
                >
                  {formatOrderStatus(request.status)}
                </span>
                <small>{formatDate(request.created_at)}</small>
              </div>
              <p>{request.reason}</p>
              {request.requested_amount_kobo > 0 && (
                <strong className="finance-requested-amount">
                  Requested: {formatMoney(request.requested_amount_kobo)}
                </strong>
              )}
              {request.approved_amount_kobo && (
                <strong className="finance-approved-amount">
                  Approved: {formatMoney(request.approved_amount_kobo)}
                </strong>
              )}
              {request.status === 'pending' && (
                <button
                  type="button"
                  className="button button-primary"
                  onClick={() => openReview(request)}
                >
                  Review request
                </button>
              )}
            </article>
          ))}
        </div>
      )}

      {selectedRequest && (
        <div className="finance-review-panel">
          <div className="finance-request-heading">
            <div>
              <span>MANAGEMENT DECISION</span>
              <h3>Set the installment terms</h3>
            </div>
            <CalendarClock size={21} />
          </div>

          {selectedRequest.requested_amount_kobo > 0 && (
            <div className="finance-review-requested-amount">
              <span>Customer requested</span>
              <strong>
                {formatMoney(selectedRequest.requested_amount_kobo)}
              </strong>
              <small>
                Approving accepts this exact installment for the project.
              </small>
            </div>
          )}

          <div className="finance-review-grid">
            {!selectedRequest.requested_amount_kobo && (
              <label>
                <span>Approved installment in Naira</span>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  value={form.amount}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      amount: event.target.value,
                    }))
                  }
                  placeholder="Legacy request amount"
                />
              </label>
            )}
            <label>
              <span>Installment approval expires</span>
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

          <label>
            <span>Note to customer</span>
            <textarea
              value={form.note}
              maxLength="3000"
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  note: event.target.value,
                }))
              }
              placeholder="Explain the approved terms, or provide the reason for declining."
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
              onClick={() => setSelectedRequest(null)}
              disabled={processing}
            >
              Cancel
            </button>
            <button
              type="button"
              className="finance-decline-button"
              onClick={() => saveDecision('decline')}
              disabled={processing}
            >
              <XCircle size={17} />
              Decline
            </button>
            <button
              type="button"
              className="button button-primary"
              onClick={() => saveDecision('approve')}
              disabled={processing}
            >
              <BadgeCheck size={17} />
              {processing ? 'Saving...' : 'Approve installment'}
            </button>
          </div>
        </div>
      )}

      {success && <div className="finance-success-message">{success}</div>}
      {error && <div className="finance-error-message">{error}</div>}
    </section>
  );
}
