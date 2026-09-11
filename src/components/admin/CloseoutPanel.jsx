import { useState } from 'react';


import Icon from '../ui/Icon';
import { useToast } from '../ui/Toast';
import ConfirmDialog from '../ui/ConfirmDialog';
import { formatKobo } from '../../lib/money';
import { completeProject, markDelivered } from '../../lib/projectWork';

function formatDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function CloseoutPanel({ order, work, finance, onChanged }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [deliveryNote, setDeliveryNote] = useState('');
  const [delivering, setDelivering] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [override, setOverride] = useState(false);

  const deliverables = work?.deliverables || [];
  const pendingApprovals = deliverables.filter((deliverable) => deliverable.client_approval_state === 'pending');
  const openRevisions = (work?.revisions || []).filter((revision) => !['resolved', 'rejected_out_of_scope'].includes(revision.status));
  const outstanding = finance?.outstanding ?? 0;
  const progress = Math.max(0, Math.min(100, Number(order?.progress_percent || 0)));

  const delivered = Boolean(order?.delivered_at);
  const completed = order?.status === 'completed' || Boolean(order?.completed_at);

  const submitDeliver = async (event) => {
    event.preventDefault();

    try {
      setBusy(true);
      await markDelivered({ orderId: order.id, deliveryNote: deliveryNote.trim() });
      toast.success('Project marked as delivered. The client can now download the final files.');
      setDelivering(false);
      setDeliveryNote('');
      await onChanged?.();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  const submitComplete = async () => {
    try {
      setBusy(true);
      await completeProject({ orderId: order.id, overrideFinancial: override, confirmUndelivered: !delivered });
      toast.success('Project completed.');
      setCompleting(false);
      setOverride(false);
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
          <span>CLOSEOUT</span>
          <h3>Delivery & completion</h3>
          <p className="admin-card-description">
            Deliberate finish: deliver first, then complete. Financial
            obligations must be clear or explicitly overridden.
          </p>
        </div>
      </div>

      <div className="posho-kv">
        <div><span>Progress</span><strong>{progress}%</strong></div>
        <div>
          <span>Deliverables awaiting client review</span>
          <strong>{pendingApprovals.length}</strong>
        </div>
        <div>
          <span>Open revisions</span>
          <strong>{openRevisions.length}</strong>
        </div>
        <div>
          <span>Outstanding balance</span>
          <strong>{formatKobo(outstanding)}</strong>
        </div>
        <div>
          <span>Delivered</span>
          <strong>{delivered ? formatDate(order.delivered_at) : 'Not yet'}</strong>
        </div>
        <div>
          <span>Completed</span>
          <strong>{completed ? formatDate(order.completed_at) || 'Yes' : 'Not yet'}</strong>
        </div>
      </div>

      {!delivered && !completed && (
        <form onSubmit={submitDeliver} className="posho-form-grid" style={{ marginTop: 12 }}>
          <label>
            Delivery note to client (optional)
            <textarea value={deliveryNote} maxLength={3000} onChange={(e) => setDeliveryNote(e.target.value)} placeholder="Everything is ready — download links and next steps." />
          </label>
          <button type="button" className="button button-primary" onClick={() => setDelivering(true)} disabled={busy}>
            <Icon name="package_2" size={17} /> Mark delivered
          </button>
        </form>
      )}

      {!completed && (
        <div className="finance-review-actions" style={{ marginTop: 12 }}>
          <button type="button" className="button button-primary" onClick={() => setCompleting(true)} disabled={busy}>
            <Icon name="check_circle" size={17} /> Complete project
          </button>
        </div>
      )}

      {completed && (
        <p className="admin-card-description" style={{ marginTop: 8 }}>
          This project is complete. The client sees a polished completed state and can leave feedback.
          For ongoing work, propose a retainer from the Clients page instead of reopening this project.
        </p>
      )}

      <ConfirmDialog
        open={delivering}
        title="Mark as delivered"
        description={pendingApprovals.length > 0
          ? `${pendingApprovals.length} deliverable(s) still await client review. Delivery will proceed anyway — approvals stay open. Continue?`
          : 'The client will be notified and can download the final files. Continue?'}
        confirmLabel="Mark delivered"
        busy={busy}
        busyLabel="Saving…"
        onClose={() => !busy && setDelivering(false)}
        onConfirm={submitDeliver}
      />

      <ConfirmDialog
        open={completing}
        title="Complete project"
        description={!delivered
          ? 'This project has not been marked delivered yet. It will be completed without a delivery record. Continue?'
          : outstanding > 0
            ? `An outstanding balance of ${formatKobo(outstanding)} remains. Tick the override to complete anyway — the balance stays on record.`
            : 'All obligations look clear. Complete this project?'}
        confirmLabel="Complete project"
        busy={busy}
        busyLabel="Completing…"
        onClose={() => !busy && setCompleting(false)}
        onConfirm={submitComplete}
      />

      {completing && !delivered && (
        <label className="finance-checkbox-row" style={{ marginTop: 8 }}>
          <input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} />
          <span>I understand this project was never marked delivered{outstanding > 0 ? ` and ${formatKobo(outstanding)} is still outstanding` : ''}</span>
        </label>
      )}

      {completing && delivered && outstanding > 0 && (
        <label className="finance-checkbox-row" style={{ marginTop: 8 }}>
          <input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} />
          <span>Management override: complete with {formatKobo(outstanding)} still outstanding</span>
        </label>
      )}
    </section>
  );
}
