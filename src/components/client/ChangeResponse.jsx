import { useState } from 'react';

import { useToast } from '../ui/Toast';
import { EmptyState, ErrorBlock } from '../ui/StateBlocks';
import StatusBadge from '../ui/StatusBadge';
import { useEscapeClose } from '../ui/useEscapeClose';
import { formatKobo } from '../../lib/money';
import { respondChangeRequest } from '../../lib/projectWork';

function formatDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function ChangeResponse({ order, work, onChanged }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [responding, setResponding] = useState(null);
  const [decision, setDecision] = useState('accept');
  const [message, setMessage] = useState('');

  useEscapeClose(Boolean(responding) && !busy, () => setResponding(null));

  const changes = work?.changeRequests || [];
  const loadError = work?.loadErrors?.changeRequests;
  const awaiting = changes.filter((change) => change.status === 'sent');
  const decided = changes.filter((change) => change.status !== 'sent' && change.status !== 'draft');

  const openRespond = (change) => {
    setResponding(change);
    setDecision('accept');
    setMessage('');
  };

  const submit = async (event) => {
    event.preventDefault();

    if (decision !== 'accept' && message.trim().length < 5) {
      toast.error('Add a short note so Management understands your response.');
      return;
    }

    try {
      setBusy(true);
      await respondChangeRequest({
        orderId: order.id,
        changeId: responding.id,
        decision,
        message: message.trim(),
      });
      toast.success(
        decision === 'accept'
          ? 'Change accepted. Management will implement it.'
          : decision === 'decline'
            ? 'Change declined. Management has been notified.'
            : 'Question sent. Management will respond shortly.',
      );
      setResponding(null);
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
            <span>CHANGE REQUESTS</span>
            <h3>Scope changes</h3>
          </div>
        </div>
        <ErrorBlock message={`Change requests could not be loaded. ${loadError}`} onRetry={onChanged} />
      </section>
    );
  }

  if (changes.length === 0) {
    return null;
  }

  return (
    <section className="workspace-panel">
      <div className="workspace-panel-heading">
        <div>
          <span>CHANGE REQUESTS</span>
          <h3>Scope changes {awaiting.length > 0 ? `(${awaiting.length} awaiting you)` : ''}</h3>
        </div>
      </div>

      {awaiting.length === 0 && decided.length === 0 ? (
        <EmptyState title="No change requests" body="Extra work beyond the agreed scope is documented here first." />
      ) : (
        <div className="posho-ledger">
          {awaiting.map((change) => (
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
                {Number(change.timeline_impact_days || 0) > 0 && <>+{change.timeline_impact_days} days{' · '}</>}
                <small>Sent {formatDate(change.created_at)}</small>
              </p>
              {change.payment_requirement_note && <p><strong>Payment terms:</strong> {change.payment_requirement_note}</p>}
              <div className="finance-review-actions">
                <button type="button" className="button button-primary" onClick={() => openRespond(change)} disabled={busy}>
                  Review change
                </button>
              </div>
            </article>
          ))}

          {decided.slice(0, 5).map((change) => (
            <article key={change.id} className="posho-ledger-item">
              <header>
                <strong className="posho-long-value">{change.title}</strong>
                <StatusBadge value={change.status} />
              </header>
              {change.client_message && <p><strong>Your response:</strong> {change.client_message}</p>}
            </article>
          ))}
        </div>
      )}

      {responding && (
        <div className="posho-modal-backdrop" onClick={() => !busy && setResponding(null)}>
          <form role="dialog" aria-modal="true" aria-label="Respond to change request" className="posho-modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
            <div className="posho-modal-heading">
              <h3 className="posho-long-value">{responding.title}</h3>
              <button type="button" onClick={() => setResponding(null)} aria-label="Close" disabled={busy}>×</button>
            </div>
            {responding.description && <p className="posho-modal-description">{responding.description}</p>}
            {(Number(responding.additional_cost_kobo || 0) > 0 || Number(responding.timeline_impact_days || 0) > 0) && (
              <div className="posho-preview-box">
                {Number(responding.additional_cost_kobo || 0) > 0 && <div>Additional cost: {formatKobo(responding.additional_cost_kobo)}</div>}
                {Number(responding.timeline_impact_days || 0) > 0 && <div>Timeline impact: +{responding.timeline_impact_days} days</div>}
                {responding.payment_requirement_note && <div>Payment terms: {responding.payment_requirement_note}</div>}
              </div>
            )}
            <div className="posho-form-grid">
              <label>
                Your decision
                <select value={decision} onChange={(e) => setDecision(e.target.value)}>
                  <option value="accept">Accept this change</option>
                  <option value="decline">Decline</option>
                  <option value="question">Ask a question</option>
                </select>
              </label>
              <label>
                Note to Management {decision === 'accept' ? '(optional)' : ''}
                <textarea value={message} maxLength={3000} onChange={(e) => setMessage(e.target.value)} placeholder="Anything Management should know…" />
              </label>
            </div>
            <div className="posho-modal-actions">
              <button type="button" className="button button-secondary" onClick={() => setResponding(null)} disabled={busy}>Cancel</button>
              <button type="submit" className="button button-primary" disabled={busy} aria-busy={busy}>
                {busy ? 'Sending…' : decision === 'accept' ? 'Accept change' : decision === 'decline' ? 'Decline change' : 'Send question'}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
