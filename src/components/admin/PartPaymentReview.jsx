import { useState } from 'react';


import Icon from '../ui/Icon';
import { useToast } from '../ui/Toast';
import { useEscapeClose } from '../ui/useEscapeClose';
import { reviewProjectPartPayment } from '../../lib/projectFinance';
import { formatKobo } from '../../lib/money';

function toEndOfDay(value) {
  return value ? new Date(`${value}T23:59:59`).toISOString() : null;
}

function datePlus(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Management review with a Management-chosen installment.
 * Admin is NOT required to accept the customer's proposed amount.
 */
export default function PartPaymentReview({ order, finance, onChanged }) {
  const toast = useToast();
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    amount: '',
    expiry: datePlus(7),
    balanceDue: datePlus(37),
    note: '',
    allowWork: false,
  });

  const requests = order?.partRequests || [];
  const pending = requests.filter((request) => request.status === 'pending');

  useEscapeClose(Boolean(selected) && !busy, () => setSelected(null));
  const decided = requests.filter((request) => request.status !== 'pending');
  const outstanding = finance?.outstanding ?? 0;
  const paid = finance?.paid ?? 0;

  const open = (request) => {
    setSelected(request);
    setForm({
      amount: String(Number(request.requested_amount_kobo || 0) / 100 || ''),
      expiry: datePlus(7),
      balanceDue: datePlus(37),
      note: '',
      allowWork: false,
    });
  };

  const approvedPreview = Math.round(Number(String(form.amount).replaceAll(',', '')) * 100) || 0;

  const decide = async (decision) => {
    if (!selected) return;

    if (decision === 'decline' && form.note.trim().length < 5) {
      toast.error('Add a clear reason before declining the request.');
      return;
    }

    if (decision === 'approve') {
      if (!Number.isFinite(approvedPreview) || approvedPreview <= 0) {
        toast.error('Enter the installment Management is approving.');
        return;
      }

      if (approvedPreview >= outstanding) {
        toast.error(
          `The approved installment must be lower than the outstanding balance of ${formatKobo(outstanding)}. Use full payment instead.`,
        );
        return;
      }

      if (form.expiry && form.balanceDue && new Date(form.balanceDue) < new Date(form.expiry)) {
        toast.error('The remaining-balance due date cannot be earlier than the installment expiry date.');
        return;
      }
    }

    try {
      setBusy(true);
      await reviewProjectPartPayment({
        requestId: selected.id,
        decision,
        approvedAmountKobo: decision === 'approve' ? approvedPreview : null,
        approvalExpiresAt: decision === 'approve' ? toEndOfDay(form.expiry) : null,
        balanceDueAt: decision === 'approve' ? toEndOfDay(form.balanceDue) : null,
        adminNote: form.note,
        allowWorkToStart: form.allowWork,
      });
      toast.success(
        decision === 'approve'
          ? `Installment of ${formatKobo(approvedPreview)} approved. The customer can now pay it.`
          : 'Request declined with your reason.',
      );
      setSelected(null);
      await onChanged?.();
      window.dispatchEvent(new CustomEvent('posho:admin-part-payments-changed'));
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="admin-control-card">
      <div className="finance-request-heading">
        <div>
          <span>PAYMENT ARRANGEMENTS</span>
          <h3>Part-payment requests</h3>
          <p className="admin-card-description">
            Management chooses the approved installment — it may differ from
            what the customer proposed.
          </p>
        </div>
      </div>

      <div className="finance-balance-strip">
        <span>Outstanding project balance</span>
        <strong>{formatKobo(outstanding)}</strong>
      </div>

      {pending.length === 0 && (
        <div className="admin-project-empty-state admin-project-empty-state-small">
          <span>No part-payment applications are waiting for review.</span>
        </div>
      )}

      <div className="finance-admin-request-list">
        {pending.map((request) => (
          <article key={request.id} className="finance-admin-request">
            <div className="finance-admin-request-topline">
              <span className="finance-status-pill finance-status-pill-pending">Pending review</span>
              <small>{new Date(request.created_at).toLocaleDateString('en-NG')}</small>
            </div>
            <strong className="finance-requested-amount">
              Requested: {formatKobo(request.requested_amount_kobo)}
            </strong>
            {request.reason && <p>{request.reason}</p>}
            <button type="button" className="button button-primary" onClick={() => open(request)}>
              Review request
            </button>
          </article>
        ))}
      </div>

      {decided.length > 0 && (
        <details style={{ marginTop: 12 }}>
          <summary>Decided requests ({decided.length})</summary>
          <div className="finance-admin-request-list" style={{ marginTop: 10 }}>
            {decided.slice(0, 8).map((request) => (
              <article key={request.id} className="finance-admin-request">
                <div className="finance-admin-request-topline">
                  <span className={`finance-status-pill finance-status-pill-${request.status}`}>
                    {request.status}
                  </span>
                  <small>{new Date(request.created_at).toLocaleDateString('en-NG')}</small>
                </div>
                <p>
                  Requested {formatKobo(request.requested_amount_kobo)}
                  {request.approved_amount_kobo
                    ? ` · Approved ${formatKobo(request.approved_amount_kobo)}`
                    : ''}
                </p>
                {(request.admin_note || request.decline_reason) && (
                  <p>{request.admin_note || request.decline_reason}</p>
                )}
              </article>
            ))}
          </div>
        </details>
      )}

      {selected && (
        <div className="posho-modal-backdrop" onClick={() => !busy && setSelected(null)}>
          <div
            role="dialog" aria-modal="true" aria-label="Review part-payment request"
            className="posho-modal" onClick={(event) => event.stopPropagation()}
          >
            <div className="posho-modal-heading">
              <h3>Management decision</h3>
              <button type="button" onClick={() => setSelected(null)} aria-label="Close" disabled={busy}>×</button>
            </div>

            <div className="posho-preview-box" style={{ marginBottom: 12 }}>
              Outstanding {formatKobo(outstanding)} · Customer requested{' '}
              {formatKobo(selected.requested_amount_kobo)}
            </div>

            <div className="posho-form-grid">
              <label>
                Approved installment (NGN)
                <input
                  type="number" min="1" step="0.01"
                  value={form.amount}
                  onChange={(event) => setForm((c) => ({ ...c, amount: event.target.value }))}
                  placeholder="Management-chosen amount"
                />
              </label>
              <label>
                Approval valid until
                <input type="date" value={form.expiry} onChange={(event) => setForm((c) => ({ ...c, expiry: event.target.value }))} />
              </label>
              <label>
                Remaining balance due
                <input type="date" value={form.balanceDue} onChange={(event) => setForm((c) => ({ ...c, balanceDue: event.target.value }))} />
              </label>
              <label>
                Customer terms / response
                <textarea value={form.note} maxLength={3000} onChange={(event) => setForm((c) => ({ ...c, note: event.target.value }))} placeholder="Explain the approved terms, or the reason for declining." />
              </label>
              <label className="finance-checkbox-row">
                <input type="checkbox" checked={form.allowWork} onChange={(event) => setForm((c) => ({ ...c, allowWork: event.target.checked }))} />
                <span>Allow project work after this installment</span>
              </label>

              {approvedPreview > 0 && approvedPreview < outstanding && (
                <div className="posho-preview-box" role="status">
                  After installment: Paid {formatKobo(paid + approvedPreview)} ·
                  Outstanding {formatKobo(outstanding - approvedPreview)}
                </div>
              )}
            </div>

            <div className="posho-modal-actions">
              <button type="button" className="button button-secondary" onClick={() => setSelected(null)} disabled={busy}>
                Cancel
              </button>
              <button type="button" className="finance-decline-button" onClick={() => decide('decline')} disabled={busy}>
                <Icon name="cancel" size={17} /> Decline
              </button>
              <button type="button" className="button button-primary" onClick={() => decide('approve')} disabled={busy} aria-busy={busy}>
                <Icon name="verified" size={17} /> {busy ? 'Saving…' : 'Approve arrangement'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
