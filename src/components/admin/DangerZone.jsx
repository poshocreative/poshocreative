import { useState } from 'react';

import { useNavigate } from 'react-router-dom';

import ConfirmDialog from '../ui/ConfirmDialog';
import { useToast } from '../ui/Toast';
import { useEscapeClose } from '../ui/useEscapeClose';
import { useAuth } from '../../context/AuthContext';
import { formatKobo } from '../../lib/money';
import {
  archiveProject,
  permanentDeleteProject,
  restoreProject,
} from '../../lib/projectLifecycle';

export default function DangerZone({ order, onChanged }) {
  const toast = useToast();
  const navigate = useNavigate();
  const { adminPath } = useAuth();
  const [busy, setBusy] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveReason, setArchiveReason] = useState('');
  const [deleteStep, setDeleteStep] = useState(0);
  const [typedRef, setTypedRef] = useState('');
  const [deleteReason, setDeleteReason] = useState('');

  useEscapeClose(archiveOpen && !busy, () => setArchiveOpen(false));
  useEscapeClose(deleteStep === 1 && !busy, () => setDeleteStep(0));

  const archived = Boolean(order?.archived_at);
  const hasPayments = Number(order?.paid_amount_kobo || 0) > 0 ||
    (order?.payments || []).some((payment) => payment.status === 'successful');

  const doArchive = async () => {
    try {
      setBusy(true);
      await archiveProject({ orderId: order.id, reason: archiveReason });
      toast.success('Project archived. It is hidden from active views and can be restored.');
      setArchiveOpen(false);
      setArchiveReason('');
      await onChanged?.();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  const doRestore = async () => {
    try {
      setBusy(true);
      await restoreProject({ orderId: order.id });
      toast.success('Project restored to the active workspace.');
      await onChanged?.();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async () => {
    try {
      setBusy(true);
      await permanentDeleteProject({
        orderId: order.id,
        typedReference: typedRef,
        reason: deleteReason,
      });
      toast.success('Project permanently deleted. An audit tombstone was preserved.');
      navigate(adminPath('orders'), { replace: true });
    } catch (error) {
      toast.error(error.message);
      setBusy(false);
    }
  };

  return (
    <div className="posho-danger-zone">
      <h3>Project lifecycle</h3>
      <p>
        Archiving is the default. It hides the project from active views while
        preserving payments, files and history. Permanent deletion is separate
        and requires typing the project reference.
      </p>

      <div className="posho-danger-row">
        <div>
          <strong>{archived ? 'Archived project' : 'Archive project'}</strong>
          <p>{archived ? 'Restore this project to the active workspace.' : 'Hide from active views. Restorable at any time.'}</p>
        </div>
        {archived ? (
          <button type="button" className="button button-secondary" onClick={doRestore} disabled={busy} aria-busy={busy}>
            {busy ? 'Restoring…' : 'Restore project'}
          </button>
        ) : (
          <button type="button" className="button button-secondary" onClick={() => setArchiveOpen(true)}>
            Archive project
          </button>
        )}
      </div>

      <div className="posho-danger-row">
        <div>
          <strong>Permanent deletion</strong>
          <p>
            May remove the project, files, progress, notes, part-payment
            requests, plans and additional costs.
            {hasPayments
              ? ` This project has confirmed payments (${formatKobo(order?.paid_amount_kobo)}). A financial tombstone is preserved, but deletion is still discouraged.`
              : ' No confirmed payments detected, but an audit tombstone is still preserved.'}
          </p>
        </div>
        <button type="button" className="posho-button-danger" onClick={() => setDeleteStep(1)}>
          Permanently delete
        </button>
      </div>

      {archiveOpen && (
        <div className="posho-modal-backdrop" onClick={() => !busy && setArchiveOpen(false)}>
          <div role="dialog" aria-modal="true" aria-label="Archive project" className="posho-modal" onClick={(e) => e.stopPropagation()}>
            <div className="posho-modal-heading">
              <h3>Archive {order?.reference}</h3>
              <button type="button" onClick={() => setArchiveOpen(false)} aria-label="Close" disabled={busy}>×</button>
            </div>
            <div className="posho-form-grid">
              <label>
                Reason
                <textarea value={archiveReason} onChange={(e) => setArchiveReason(e.target.value)} placeholder="Why is this project being archived?" />
              </label>
            </div>
            <div className="posho-modal-actions">
              <button type="button" className="button button-secondary" onClick={() => setArchiveOpen(false)} disabled={busy}>Cancel</button>
              <button type="button" className="button button-primary" onClick={doArchive} disabled={busy || archiveReason.trim().length < 5} aria-busy={busy}>
                {busy ? 'Archiving…' : 'Archive project'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteStep === 1 && (
        <div className="posho-modal-backdrop" onClick={() => !busy && setDeleteStep(0)}>
          <div role="dialog" aria-modal="true" aria-label="Permanently delete project" className="posho-modal posho-modal-danger" onClick={(e) => e.stopPropagation()}>
            <div className="posho-modal-heading">
              <h3>Permanently delete project</h3>
              <button type="button" onClick={() => setDeleteStep(0)} aria-label="Close" disabled={busy}>×</button>
            </div>
            <p className="posho-modal-description">
              Project {order?.reference}. This may remove the project, project
              files, progress history, notes, part-payment requests, payment
              plans, additional costs and client-visible updates.
              {hasPayments ? ' It has financial history — prefer archiving.' : ''}
            </p>
            <div className="posho-form-grid">
              <label>
                Type {order?.reference} to continue
                <input value={typedRef} onChange={(e) => setTypedRef(e.target.value)} placeholder={order?.reference} autoComplete="off" />
              </label>
              <label>
                Reason (at least 10 characters)
                <textarea value={deleteReason} onChange={(e) => setDeleteReason(e.target.value)} placeholder="Why must this record be destroyed?" />
              </label>
            </div>
            <div className="posho-modal-actions">
              <button type="button" className="button button-secondary" onClick={() => setDeleteStep(0)} disabled={busy}>Cancel</button>
              <button
                type="button"
                className="posho-button-danger"
                disabled={busy || typedRef.trim() !== order?.reference || deleteReason.trim().length < 10}
                onClick={() => setDeleteStep(2)}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteStep === 2}
        title="Final confirmation"
        description={`Delete ${order?.reference} permanently? This cannot be undone. An audit tombstone is preserved.`}
        confirmLabel="Permanently delete"
        cancelLabel="Go back"
        tone="danger"
        busy={busy}
        busyLabel="Deleting…"
        onClose={() => !busy && setDeleteStep(1)}
        onConfirm={doDelete}
      />
    </div>
  );
}
