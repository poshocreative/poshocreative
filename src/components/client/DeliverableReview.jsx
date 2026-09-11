import { useState } from 'react';

import { CheckCircle2, Download, MessageSquareText, X } from 'lucide-react';

import { useToast } from '../ui/Toast';
import { EmptyState, ErrorBlock } from '../ui/StateBlocks';
import StatusBadge from '../ui/StatusBadge';
import ConfirmDialog from '../ui/ConfirmDialog';
import { useEscapeClose } from '../ui/useEscapeClose';
import { downloadProjectFile } from '../../lib/orders';
import { approveDeliverable, requestRevision } from '../../lib/projectWork';
import ProofingPanel from './ProofingPanel';

function isPdfName(name) {
  return /\.pdf$/i.test(String(name || ''));
}

function versionStoragePath(version) {
  const file = Array.isArray(version.order_files)
    ? version.order_files[0]
    : version.order_files;

  return file?.storage_path || '';
}

function formatDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function DeliverableReview({ order, work, onChanged }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [approving, setApproving] = useState(null);
  const [revising, setRevising] = useState(null);
  const [feedback, setFeedback] = useState('');
  const [downloading, setDownloading] = useState('');
  const [annotating, setAnnotating] = useState('');

  useEscapeClose(Boolean(revising) && !busy, () => setRevising(null));

  const downloadVersion = async (version) => {
    const file = Array.isArray(version.order_files)
      ? version.order_files[0]
      : version.order_files;

    if (!file?.storage_path) {
      toast.error('This file is not available for download yet.');
      return;
    }

    try {
      setDownloading(version.id);
      await downloadProjectFile({
        storage_path: file.storage_path,
        original_name: version.original_name || 'deliverable',
      });
    } catch {
      toast.error('This file could not be prepared for download. Please try again.');
    } finally {
      setDownloading('');
    }
  };

  const deliverables = (work?.deliverables || []).filter(
    (deliverable) => deliverable.visible_to_client !== false,
  );
  const versionsByDeliverable = work?.versionsByDeliverable || {};
  const loadError = work?.loadErrors?.deliverables || work?.loadErrors?.versions;

  const submitApprove = async () => {
    if (!approving) return;

    try {
      setBusy(true);
      await approveDeliverable({ orderId: order.id, versionId: approving.versionId });
      toast.success('Deliverable approved. Thank you — Management has been notified.');
      setApproving(null);
      await onChanged?.();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  const submitRevision = async (event) => {
    event.preventDefault();

    if (feedback.trim().length < 10) {
      toast.error('Describe the change you need in at least a sentence.');
      return;
    }

    try {
      setBusy(true);
      await requestRevision({
        orderId: order.id,
        deliverableId: revising.deliverableId,
        versionId: revising.versionId,
        description: feedback.trim(),
      });
      toast.success('Revision requested. Management will respond shortly.');
      setRevising(null);
      setFeedback('');
      await onChanged?.();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  if (loadError) {
    return (
      <section className="workspace-panel">
        <div className="workspace-panel-heading">
          <div>
            <span>DELIVERABLES</span>
            <h3>Review work</h3>
          </div>
        </div>
        <ErrorBlock message={`Deliverables could not be loaded. ${loadError}`} onRetry={onChanged} />
      </section>
    );
  }

  if (deliverables.length === 0) {
    return (
      <section className="workspace-panel">
        <div className="workspace-panel-heading">
          <div>
            <span>DELIVERABLES</span>
            <h3>Review work</h3>
          </div>
        </div>
        <EmptyState title="No deliverables yet" body="Files Posho Creative publishes for your review appear here." />
      </section>
    );
  }

  return (
    <section className="workspace-panel">
      <div className="workspace-panel-heading">
        <div>
          <span>DELIVERABLES</span>
          <h3>Review work</h3>
        </div>
      </div>

      <div className="posho-ledger">
        {deliverables.map((deliverable) => {
          const versions = (versionsByDeliverable[deliverable.id] || []).slice().sort(
            (a, b) => Number(b.version_number) - Number(a.version_number),
          );
          const current = versions[0];

          return (
            <article key={deliverable.id} className="posho-ledger-item">
              <header>
                <strong className="posho-long-value">{deliverable.title}</strong>
                <StatusBadge value={deliverable.client_approval_state} />
              </header>
              {deliverable.description && <p>{deliverable.description}</p>}

              {versions.map((version) => (
                <div key={version.id} className="posho-version-row" style={{ marginTop: 8 }}>
                  <div>
                    <strong>V{version.version_number}</strong>
                    {version.original_name ? ` · ${version.original_name}` : ''}
                    <br />
                    <small>
                      <StatusBadge value={version.approval_state} />
                      {' · '}
                      {formatDate(version.created_at)}
                    </small>
                    {version.notes && <p style={{ margin: '4px 0 0' }}>{version.notes}</p>}
                  </div>
                  <div className="finance-review-actions">
                    <button
                      type="button"
                      className="button button-secondary"
                      onClick={() => downloadVersion(version)}
                      disabled={downloading === version.id}
                      aria-busy={downloading === version.id}
                    >
                      <Download size={15} /> {downloading === version.id ? 'Preparing…' : 'Download'}
                    </button>

                    <button
                      type="button"
                      className="button button-secondary"
                      onClick={() =>
                        setAnnotating(
                          annotating === version.id ? '' : version.id,
                        )
                      }
                      aria-expanded={annotating === version.id}
                    >
                      <MessageSquareText size={15} />{' '}
                      {annotating === version.id ? 'Hide comments' : 'Comment on file'}
                    </button>
                  </div>

                  {annotating === version.id && (
                    <ProofingPanel
                      version={version}
                      storagePath={versionStoragePath(version)}
                      readOnly={version.approval_state === 'approved'}
                      isPdf={isPdfName(version.original_name)}
                      onChanged={onChanged}
                    />
                  )}
                  {version.approval_state === 'pending' && (
                    <div className="finance-review-actions">
                      <button
                        type="button"
                        className="button button-primary"
                        onClick={() => setApproving({ versionId: version.id, label: `${deliverable.title} V${version.version_number}` })}
                        disabled={busy}
                      >
                        <CheckCircle2 size={15} /> Approve
                      </button>
                      <button
                        type="button"
                        className="button button-secondary"
                        onClick={() => { setRevising({ deliverableId: deliverable.id, versionId: version.id, label: `${deliverable.title} V${version.version_number}` }); setFeedback(''); }}
                        disabled={busy}
                      >
                        <MessageSquareText size={15} /> Request revision
                      </button>
                    </div>
                  )}
                </div>
              ))}

              {!current && <p><small>No versions shared yet.</small></p>}
            </article>
          );
        })}
      </div>

      <ConfirmDialog
        open={Boolean(approving)}
        title="Approve deliverable"
        description={approving ? `Approve ${approving.label}? This records your approval with a timestamp.` : ''}
        confirmLabel="Approve"
        busy={busy}
        busyLabel="Saving…"
        onClose={() => !busy && setApproving(null)}
        onConfirm={submitApprove}
      />

      {revising && (
        <div className="posho-modal-backdrop" onClick={() => !busy && setRevising(null)}>
          <form role="dialog" aria-modal="true" aria-label="Request revision" className="posho-modal" onClick={(e) => e.stopPropagation()} onSubmit={submitRevision}>
            <div className="posho-modal-heading">
              <h3>Request revision</h3>
              <button type="button" onClick={() => setRevising(null)} aria-label="Close" disabled={busy}><X size={19} /></button>
            </div>
            <p className="posho-modal-description">
              {revising.label} — describe exactly what should change. Specific
              feedback gets resolved faster.
            </p>
            <div className="posho-form-grid">
              <label>
                What should change?
                <textarea value={feedback} maxLength={5000} onChange={(e) => setFeedback(e.target.value)} placeholder="The headline should mention delivery in Lagos, and the hero image feels too dark…" required />
              </label>
            </div>
            <div className="posho-modal-actions">
              <button type="button" className="button button-secondary" onClick={() => setRevising(null)} disabled={busy}>Cancel</button>
              <button type="submit" className="button button-primary" disabled={busy} aria-busy={busy}>
                {busy ? 'Sending…' : 'Send revision request'}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
