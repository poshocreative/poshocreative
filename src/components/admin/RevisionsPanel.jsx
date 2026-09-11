import { useState } from 'react';

import { X } from 'lucide-react';

import { useToast } from '../ui/Toast';
import { EmptyState, ErrorBlock } from '../ui/StateBlocks';
import StatusBadge from '../ui/StatusBadge';
import { useEscapeClose } from '../ui/useEscapeClose';
import { respondRevision } from '../../lib/projectWork';

const RESPONSE_STATUSES = ['acknowledged', 'in_progress', 'resolved', 'rejected_out_of_scope'];

function formatDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function RevisionsPanel({ order, work, onChanged }) {
  const toast = useToast();
  const [responding, setResponding] = useState(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('acknowledged');
  const [response, setResponse] = useState('');

  useEscapeClose(Boolean(responding) && !busy, () => setResponding(null));

  const revisions = work?.revisions || [];
  const loadError = work?.loadErrors?.revisions;
  const open = revisions.filter((revision) => !['resolved', 'rejected_out_of_scope'].includes(revision.status));
  const closed = revisions.filter((revision) => ['resolved', 'rejected_out_of_scope'].includes(revision.status));

  const openRespond = (revision) => {
    setResponding(revision);
    setStatus('acknowledged');
    setResponse('');
  };

  const submit = async (event) => {
    event.preventDefault();

    if ((status === 'resolved' || status === 'rejected_out_of_scope') && response.trim().length < 5) {
      toast.error('Explain the resolution before closing this revision.');
      return;
    }

    try {
      setBusy(true);
      await respondRevision({
        orderId: order.id,
        revisionId: responding.id,
        status,
        managementResponse: response.trim(),
      });
      toast.success(
        status === 'rejected_out_of_scope'
          ? 'Revision marked out of scope. Consider a change request for the extra work.'
          : `Revision marked as ${status.replaceAll('_', ' ')}. The client has been notified.`,
      );
      setResponding(null);
      await onChanged?.();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  const renderRevision = (revision) => (
    <article key={revision.id} className="posho-ledger-item">
      <header>
        <StatusBadge value={revision.status} />
        <small>{formatDate(revision.created_at)}</small>
      </header>
      <p>{revision.description}</p>
      {revision.management_response && (
        <p><strong>Management response:</strong> {revision.management_response}</p>
      )}
      {revision.resolved_at && <p><small>Resolved {formatDate(revision.resolved_at)}</small></p>}
      {!['resolved', 'rejected_out_of_scope'].includes(revision.status) && (
        <div className="finance-review-actions">
          <button type="button" className="button button-secondary" onClick={() => openRespond(revision)}>
            Respond
          </button>
        </div>
      )}
    </article>
  );

  return (
    <section className="admin-control-card">
      <div className="finance-request-heading">
        <div>
          <span>FEEDBACK LOOP</span>
          <h3>Revision requests {open.length > 0 ? `(${open.length} open)` : ''}</h3>
          <p className="admin-card-description">
            Structured client feedback — never random chat. Out-of-scope items
            should become change requests.
          </p>
        </div>
      </div>

      {loadError ? (
        <ErrorBlock message={`Revisions could not be loaded. ${loadError}`} onRetry={onChanged} />
      ) : revisions.length === 0 ? (
        <EmptyState title="No revision requests" body="Client revision requests appear here with full traceability." />
      ) : (
        <>
          <div className="posho-ledger">{open.map(renderRevision)}</div>
          {closed.length > 0 && (
            <details style={{ marginTop: 12 }}>
              <summary>Resolved ({closed.length})</summary>
              <div className="posho-ledger" style={{ marginTop: 10 }}>{closed.map(renderRevision)}</div>
            </details>
          )}
        </>
      )}

      {responding && (
        <div className="posho-modal-backdrop" onClick={() => !busy && setResponding(null)}>
          <form role="dialog" aria-modal="true" aria-label="Respond to revision" className="posho-modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
            <div className="posho-modal-heading">
              <h3>Respond to revision</h3>
              <button type="button" onClick={() => setResponding(null)} aria-label="Close" disabled={busy}><X size={19} /></button>
            </div>
            <p className="posho-modal-description">{responding.description}</p>
            <div className="posho-form-grid">
              <label>
                Status
                <select value={status} onChange={(e) => setStatus(e.target.value)}>
                  {RESPONSE_STATUSES.map((value) => (
                    <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>
                  ))}
                </select>
              </label>
              <label>
                Response to client
                <textarea value={response} maxLength={3000} onChange={(e) => setResponse(e.target.value)} placeholder="What happens next, or why this is out of scope." />
              </label>
            </div>
            <div className="posho-modal-actions">
              <button type="button" className="button button-secondary" onClick={() => setResponding(null)} disabled={busy}>Cancel</button>
              <button type="submit" className="button button-primary" disabled={busy} aria-busy={busy}>
                {busy ? 'Saving…' : 'Send response'}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
