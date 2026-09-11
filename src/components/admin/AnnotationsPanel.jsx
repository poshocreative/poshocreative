import { useState } from 'react';

import { useToast } from '../ui/Toast';
import { EmptyState, ErrorBlock } from '../ui/StateBlocks';
import StatusBadge from '../ui/StatusBadge';
import { runAdminOrderAction } from '../../lib/admin';

function formatDateTime(value) {
  if (!value) return '';
  return new Date(value).toLocaleString('en-NG', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function whereLabel(annotation, versionsById) {
  const version = versionsById[annotation.version_id];
  const parts = [];

  if (version) {
    parts.push(`${version.title || 'Deliverable'} V${version.version_number || '?'}`);
  }

  if (annotation.page) parts.push(`p.${annotation.page}`);

  return parts.join(' · ');
}

export default function AnnotationsPanel({ order, work, onChanged }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [replyBody, setReplyBody] = useState('');

  const annotations = work?.annotations || [];
  const versionsByDeliverable = work?.versionsByDeliverable || {};
  const loadError = work?.loadErrors?.annotations;

  const versionsById = {};
  for (const versions of Object.values(versionsByDeliverable)) {
    for (const version of versions) {
      versionsById[version.id] = {
        ...version,
        title: (work?.deliverables || []).find((d) => d.id === version.deliverable_id)?.title,
      };
    }
  }

  const roots = annotations.filter((annotation) => !annotation.parent_id);
  const open = roots.filter((annotation) => annotation.status !== 'resolved');
  const resolved = roots.filter((annotation) => annotation.status === 'resolved');

  const repliesFor = (id) => annotations.filter((annotation) => annotation.parent_id === id);

  const setStatus = async (annotationId, status) => {
    try {
      setBusy(true);

      await runAdminOrderAction({
        orderId: order.id,
        action: 'annotation_status',
        annotationId,
        status,
      });

      toast.success(
        status === 'resolved'
          ? 'Thread marked resolved. The client can see the resolution.'
          : 'Thread reopened.',
      );
      await onChanged?.();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  const submitReply = async (event, versionId, parentId) => {
    event.preventDefault();

    if (!replyBody.trim()) return;

    try {
      setBusy(true);

      await runAdminOrderAction({
        orderId: order.id,
        action: 'annotation_reply',
        versionId,
        parentId,
        body: replyBody.trim(),
      });

      setReplyTo(null);
      setReplyBody('');
      await onChanged?.();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  const renderThread = (annotation) => (
    <article key={annotation.id} className="posho-ledger-item">
      <header>
        <strong className="posho-long-value">
          {whereLabel(annotation, versionsById) || 'General comment'}
        </strong>
        <StatusBadge value={annotation.status} />
      </header>

      <p>
        <strong>{annotation.author_kind === 'client' ? 'Client' : 'Team'}:</strong>{' '}
        {annotation.body}
      </p>
      <p>
        <small>{formatDateTime(annotation.created_at)}</small>
      </p>

      {repliesFor(annotation.id).map((reply) => (
        <div
          key={reply.id}
          style={{ marginTop: 8, paddingLeft: 12, borderLeft: '2px solid var(--posho-line)' }}
        >
          <strong>{reply.author_kind === 'client' ? 'Client' : 'Team'}</strong>
          <p>{reply.body}</p>
          <p>
            <small>{formatDateTime(reply.created_at)}</small>
          </p>
        </div>
      ))}

      <div className="finance-review-actions">
        {annotation.status !== 'resolved' ? (
          <button
            type="button"
            className="button button-secondary"
            disabled={busy}
            onClick={() => setStatus(annotation.id, 'resolved')}
          >
            Mark resolved
          </button>
        ) : (
          <button
            type="button"
            className="button button-secondary"
            disabled={busy}
            onClick={() => setStatus(annotation.id, 'reopened')}
          >
            Reopen
          </button>
        )}

        <button
          type="button"
          className="button button-secondary"
          onClick={() => {
            setReplyTo(replyTo === annotation.id ? null : annotation.id);
            setReplyBody('');
          }}
        >
          Reply
        </button>
      </div>

      {replyTo === annotation.id && (
        <form
          onSubmit={(event) => submitReply(event, annotation.version_id, annotation.id)}
          className="posho-form-grid"
          style={{ marginTop: 8 }}
        >
          <label>
            <span>Reply as Management</span>
            <input
              value={replyBody}
              onChange={(event) => setReplyBody(event.target.value)}
              maxLength={2000}
              required
            />
          </label>

          <button type="submit" className="button button-secondary" disabled={busy}>
            Send reply
          </button>
        </form>
      )}
    </article>
  );

  return (
    <section className="admin-control-card">
      <div className="finance-request-heading">
        <div>
          <span>PROOFING</span>
          <h3>Annotation threads {open.length > 0 ? `(${open.length} open)` : ''}</h3>
          <p className="admin-card-description">
            Pinned client feedback on deliverables. Resolve threads so the
            client sees progress.
          </p>
        </div>
      </div>

      {loadError ? (
        <ErrorBlock message={`Annotations could not be loaded. ${loadError}`} onRetry={onChanged} />
      ) : roots.length === 0 ? (
        <EmptyState title="No annotations yet" body="Pinned comments on deliverable previews appear here as threads." />
      ) : (
        <>
          <div className="posho-ledger">{open.map(renderThread)}</div>

          {resolved.length > 0 && (
            <details style={{ marginTop: 12 }}>
              <summary>Resolved ({resolved.length})</summary>
              <div className="posho-ledger" style={{ marginTop: 10 }}>
                {resolved.map(renderThread)}
              </div>
            </details>
          )}
        </>
      )}
    </section>
  );
}
