import { useState } from 'react';

import { useToast } from '../ui/Toast';
import { EmptyState, ErrorBlock } from '../ui/StateBlocks';
import { saveClientNote } from '../../lib/projectWork';

function formatDateTime(value) {
  if (!value) return '';
  return new Date(value).toLocaleString('en-NG', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function ClientNotesPanel({ order, work, onChanged }) {
  const toast = useToast();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const notes = work?.clientNotes || [];
  const loadError = work?.loadErrors?.clientNotes;

  const submit = async (event) => {
    event.preventDefault();

    if (note.trim().length < 3) {
      toast.error('Write the note before saving.');
      return;
    }

    try {
      setBusy(true);
      await saveClientNote({ orderId: order.id, note: note.trim() });
      toast.success('Internal note saved. It is never visible to the client.');
      setNote('');
      await onChanged?.();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="admin-control-card">
      <span className="posho-section-label">CRM</span>
      <h3>Internal client notes</h3>
      <p className="admin-card-description">
        Private context for Management — preferences, risks, relationship
        history. Never visible to the client.
      </p>

      <form onSubmit={submit} className="posho-form-grid">
        <label>
          New note
          <textarea value={note} maxLength={5000} onChange={(e) => setNote(e.target.value)} placeholder="Client prefers WhatsApp updates on Fridays…" />
        </label>
        <button type="submit" className="button button-primary" disabled={busy} aria-busy={busy}>
          {busy ? 'Saving…' : 'Save internal note'}
        </button>
      </form>

      <div style={{ marginTop: 12 }}>
        {loadError ? (
          <ErrorBlock message={`Notes could not be loaded. ${loadError}`} onRetry={onChanged} />
        ) : notes.length === 0 ? (
          <EmptyState title="No internal notes" body="Relationship context saved here stays with the client record." />
        ) : (
          <div className="posho-timeline">
            {notes.map((entry) => (
              <div key={entry.id} className="posho-timeline-item">
                <span className="posho-timeline-dot" aria-hidden="true">•</span>
                <div className="posho-timeline-body">
                  <p>{entry.note}</p>
                  <time>{formatDateTime(entry.created_at)}</time>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
