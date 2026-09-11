import { useState } from 'react';

import { PlusCircle, X } from 'lucide-react';

import { useToast } from '../ui/Toast';
import { EmptyState, ErrorBlock } from '../ui/StateBlocks';
import StatusBadge from '../ui/StatusBadge';
import ConfirmDialog from '../ui/ConfirmDialog';
import { useEscapeClose } from '../ui/useEscapeClose';
import { formatKobo } from '../../lib/money';
import {
  cancelChangeRequest,
  createChangeRequest,
  implementChangeRequest,
  sendChangeRequest,
} from '../../lib/projectWork';

function formatDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
}

const emptyForm = {
  title: '', description: '', additionalCost: '', timelineImpact: '',
  paymentRequirementNote: '', requiresClientApproval: true,
};

export default function ChangeRequestsPanel({ order, work, onChanged }) {
  const toast = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(null);
  const [form, setForm] = useState(emptyForm);

  useEscapeClose(createOpen && !busy, () => setCreateOpen(false));

  const changes = work?.changeRequests || [];
  const loadError = work?.loadErrors?.changeRequests;

  const set = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const submitCreate = async (event) => {
    event.preventDefault();

    if (!form.title.trim()) {
      toast.error('Give the change request a clear title.');
      return;
    }

    const additionalCostKobo = form.additionalCost === ''
      ? 0
      : Math.round(Number(String(form.additionalCost).replaceAll(',', '')) * 100);

    if (!Number.isFinite(additionalCostKobo) || additionalCostKobo < 0) {
      toast.error('Enter a valid additional cost (or leave it at zero).');
      return;
    }

    try {
      setBusy(true);
      await createChangeRequest({
        orderId: order.id,
        change: {
          title: form.title.trim(),
          description: form.description.trim(),
          additionalCostKobo,
          timelineImpactDays: form.timelineImpact === '' ? 0 : Number(form.timelineImpact),
          paymentRequirementNote: form.paymentRequirementNote.trim(),
          requiresClientApproval: form.requiresClientApproval,
        },
      });
      toast.success('Change request drafted. Send it when the wording is final.');
      setCreateOpen(false);
      setForm(emptyForm);
      await onChanged?.();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  const act = async (action, changeId, successMessage) => {
    try {
      setBusy(true);

      if (action === 'send') await sendChangeRequest({ orderId: order.id, changeId });
      if (action === 'cancel') await cancelChangeRequest({ orderId: order.id, changeId });
      if (action === 'implement') await implementChangeRequest({ orderId: order.id, changeId });

      toast.success(successMessage);
      setConfirming(null);
      await onChanged?.();
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
          <span>SCOPE CONTROL</span>
          <h3>Change requests</h3>
          <p className="admin-card-description">
            Extra work is explicit: cost, timeline impact and client approval.
            Accepted requests can create an additional project cost.
          </p>
        </div>
        <button type="button" className="button button-secondary" onClick={() => setCreateOpen(true)}>
          <PlusCircle size={17} /> New change request
        </button>
      </div>

      {loadError ? (
        <ErrorBlock message={`Change requests could not be loaded. ${loadError}`} onRetry={onChanged} />
      ) : changes.length === 0 ? (
        <EmptyState title="No change requests" body="Scope changes beyond the agreed baseline are documented here." />
      ) : (
        <div className="posho-ledger">
          {changes.map((change) => (
            <article key={change.id} className="posho-ledger-item">
              <header>
                <strong className="posho-long-value">{change.title}</strong>
                <StatusBadge value={change.status} />
              </header>
              {change.description && <p>{change.description}</p>}
              <p>
                {Number(change.additional_cost_kobo || 0) > 0 && (
                  <>Additional cost <strong>{formatKobo(change.additional_cost_kobo)}</strong>{' · '}</>
                )}
                {Number(change.timeline_impact_days || 0) > 0 && (
                  <>+{change.timeline_impact_days} days{' · '}</>
                )}
                <small>Created {formatDate(change.created_at)}</small>
              </p>
              {change.payment_requirement_note && <p><strong>Payment terms:</strong> {change.payment_requirement_note}</p>}
              {change.client_message && <p><strong>Client:</strong> {change.client_message}</p>}
              <div className="finance-review-actions">
                {change.status === 'draft' && (
                  <button type="button" className="button button-primary" onClick={() => act('send', change.id, 'Change request sent to the client.')} disabled={busy}>
                    {busy ? 'Sending…' : 'Send to client'}
                  </button>
                )}
                {change.status === 'accepted' && (
                  <button type="button" className="button button-primary" onClick={() => setConfirming({ action: 'implement', id: change.id, title: change.title, cost: change.additional_cost_kobo })} disabled={busy}>
                    Implement
                  </button>
                )}
                {['draft', 'sent', 'questioned'].includes(change.status) && (
                  <button type="button" className="button button-secondary" onClick={() => act('cancel', change.id, 'Change request cancelled.')} disabled={busy}>
                    Cancel
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {createOpen && (
        <div className="posho-modal-backdrop" onClick={() => !busy && setCreateOpen(false)}>
          <form role="dialog" aria-modal="true" aria-label="New change request" className="posho-modal" onClick={(e) => e.stopPropagation()} onSubmit={submitCreate}>
            <div className="posho-modal-heading">
              <h3>New change request</h3>
              <button type="button" onClick={() => setCreateOpen(false)} aria-label="Close" disabled={busy}><X size={19} /></button>
            </div>
            <div className="posho-form-grid">
              <label>
                Title
                <input value={form.title} maxLength={160} onChange={(e) => set('title', e.target.value)} placeholder="Add ecommerce store" required />
              </label>
              <label>
                Description
                <textarea value={form.description} maxLength={5000} onChange={(e) => set('description', e.target.value)} placeholder="Products, cart, checkout and order management." />
              </label>
              <label>
                Additional cost (NGN)
                <input type="number" min="0" step="0.01" value={form.additionalCost} onChange={(e) => set('additionalCost', e.target.value)} placeholder="180000" />
              </label>
              <label>
                Timeline impact (days)
                <input type="number" min="0" step="1" value={form.timelineImpact} onChange={(e) => set('timelineImpact', e.target.value)} placeholder="14" />
              </label>
              <label>
                Payment requirement
                <textarea value={form.paymentRequirementNote} maxLength={2000} onChange={(e) => set('paymentRequirementNote', e.target.value)} placeholder="50% before implementation." />
              </label>
              <label className="finance-checkbox-row">
                <input type="checkbox" checked={form.requiresClientApproval} onChange={(e) => set('requiresClientApproval', e.target.checked)} />
                <span>Requires client approval</span>
              </label>
            </div>
            <div className="posho-modal-actions">
              <button type="button" className="button button-secondary" onClick={() => setCreateOpen(false)} disabled={busy}>Cancel</button>
              <button type="submit" className="button button-primary" disabled={busy} aria-busy={busy}>
                {busy ? 'Saving…' : 'Save draft'}
              </button>
            </div>
          </form>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(confirming)}
        title="Implement change request"
        description={confirming && Number(confirming.cost || 0) > 0
          ? `“${confirming.title}” will add ${formatKobo(confirming.cost)} as an additional project cost. Continue?`
          : `Implement “${confirming?.title}”?`}
        confirmLabel="Implement"
        busy={busy}
        busyLabel="Implementing…"
        onClose={() => !busy && setConfirming(null)}
        onConfirm={() => act('implement', confirming.id, 'Change request implemented.')}
      />
    </section>
  );
}
