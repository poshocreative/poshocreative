import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  MessageSquare,
  Plus,
  X,
} from 'lucide-react';

import BrandLoader from '../components/BrandLoader';
import PageHeader from '../components/ui/PageHeader';
import StatusBadge from '../components/ui/StatusBadge';
import Tabs from '../components/ui/Tabs';
import {
  EmptyState,
  ErrorBlock,
} from '../components/ui/StateBlocks';

import {
  useToast,
} from '../components/ui/Toast';

import {
  useEscapeClose,
} from '../components/ui/useEscapeClose';

import {
  getMyRequests,
  runClientProjectAction,
} from '../lib/clientOps';

function pretty(value) {
  return String(value || '').replaceAll('_', ' ');
}

export default function DashboardRequests() {
  const toast = useToast();

  const [tab, setTab] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [requests, setRequests] = useState([]);
  const [detail, setDetail] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState('');
  const [replyBusy, setReplyBusy] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    service_slug: 'creative-solutions',
    priority: 'normal',
  });

  useEscapeClose(Boolean(detail) && !busy, () => setDetail(null));
  useEscapeClose(createOpen && !busy, () => setCreateOpen(false));

  const load = useCallback(async () => {
    try {
      setError('');
      setLoading(true);
      setRequests(await getMyRequests());
    } catch (loadError) {
      setError(loadError.message || 'Requests could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    document.title = 'Requests | Posho Creative';
    load();
  }, [load]);

  const visible =
    tab === 'all'
      ? requests
      : tab === 'active'
        ? requests.filter(
            (request) =>
              !['completed', 'cancelled'].includes(request.status),
          )
        : requests.filter(
            (request) => request.status === tab,
          );

  const submit = async (event) => {
    event.preventDefault();

    if (!form.title.trim() || !form.description.trim()) {
      toast.error('Title and description are required.');
      return;
    }

    try {
      setBusy(true);

      const result = await runClientProjectAction({
        action: 'request_create',
        title: form.title.trim(),
        description: form.description.trim(),
        service_slug: form.service_slug,
        priority: form.priority,
      });

      toast.success(
        `Request ${result.reference} submitted. Management will respond here.`,
      );
      setCreateOpen(false);
      setForm({
        title: '',
        description: '',
        service_slug: 'creative-solutions',
        priority: 'normal',
      });
      await load();
    } catch (createError) {
      toast.error(createError.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <BrandLoader label="Loading requests…" />;
  }

  return (
    <div className="workspace-view page-reveal">
      <PageHeader
        kicker="Service"
        title="Requests"
        description="Small work, updates and support — without opening a full project."
        actions={
          <button
            type="button"
            className="button button-primary"
            onClick={() => setCreateOpen(true)}
          >
            <Plus size={17} />
            New request
          </button>
        }
      />

      {error && <ErrorBlock message={error} onRetry={load} />}

      <Tabs
        tabs={[
          { key: 'all', label: 'All' },
          { key: 'active', label: 'Active' },
          { key: 'waiting_on_client', label: 'Needs you' },
          { key: 'awaiting_review', label: 'In review' },
          { key: 'completed', label: 'Completed' },
        ]}
        active={tab}
        onChange={setTab}
        label="Request filters"
      />

      {visible.length === 0 ? (
        <EmptyState
          title="No requests here"
          body="Maintenance, updates and small design tasks live here."
          action={
            <button
              type="button"
              className="button button-primary"
              onClick={() => setCreateOpen(true)}
            >
              Submit a request
            </button>
          }
        />
      ) : (
        <div className="posho-ledger">
          {visible.map((request) => (
            <article key={request.id} className="posho-ledger-item">
              <header>
                <strong className="posho-long-value">{request.title}</strong>
                <StatusBadge value={request.status} />
              </header>

              <p className="posho-long-value">{request.description}</p>

              <p>
                <small>
                  {request.reference} · {pretty(request.priority)} priority
                  {request.due_date ? ` · Due ${request.due_date}` : ''}
                </small>
              </p>

              <div className="finance-review-actions">
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => setDetail(request)}
                >
                  <MessageSquare size={15} /> Details
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {createOpen && (
        <div
          className="posho-modal-backdrop"
          onClick={() => !busy && setCreateOpen(false)}
        >
          <form
            role="dialog"
            aria-modal="true"
            aria-label="New service request"
            className="posho-modal"
            onClick={(event) => event.stopPropagation()}
            onSubmit={submit}
          >
            <div className="posho-modal-heading">
              <h3>New request</h3>

              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                aria-label="Close"
                disabled={busy}
              >
                <X size={19} />
              </button>
            </div>

            <div className="posho-form-grid">
              <label>
                <span>What do you need?</span>
                <input
                  value={form.title}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  required
                  maxLength={200}
                  placeholder="Update homepage headline"
                />
              </label>

              <label>
                <span>Details</span>
                <textarea
                  value={form.description}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  required
                  maxLength={5000}
                  placeholder="Current text, new text, links…"
                />
              </label>

              <label>
                <span>Priority</span>
                <select
                  value={form.priority}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      priority: event.target.value,
                    }))
                  }
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent (exceptional)</option>
                </select>
              </label>
            </div>

            <div className="posho-modal-actions">
              <button
                type="button"
                className="button button-secondary"
                onClick={() => setCreateOpen(false)}
                disabled={busy}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="button button-primary"
                disabled={busy}
                aria-busy={busy}
              >
                {busy ? 'Submitting…' : 'Submit request'}
              </button>
            </div>
          </form>
        </div>
      )}

      {detail && (
        <div
          className="posho-modal-backdrop"
          onClick={() => !busy && setDetail(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Request detail"
            className="posho-modal posho-modal-wide"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="posho-modal-heading">
              <div>
                <span>REQUEST · {detail.reference}</span>
                <h3 className="posho-long-value">{detail.title}</h3>
              </div>

              <button
                type="button"
                onClick={() => setDetail(null)}
                aria-label="Close"
              >
                <X size={19} />
              </button>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <StatusBadge value={detail.status} />
              <StatusBadge value={detail.priority} />
              {detail.billing_status !== 'included' && (
                <StatusBadge value={detail.billing_status} />
              )}
            </div>

            <p style={{ whiteSpace: 'pre-wrap' }}>
              {detail.description}
            </p>

            {detail.checklist && detail.checklist.length > 0 && (
              <ul style={{ marginTop: 12 }}>
                {detail.checklist.map((item, index) => (
                  <li key={index}>
                    {item.done ? '☑' : '☐'} {item.label}
                  </li>
                ))}
              </ul>
            )}

            <span
              className="posho-section-label"
              style={{ marginTop: 16 }}
            >
              Discussion
            </span>

            {(detail.comments || []).length === 0 ? (
              <p className="admin-card-description">
                No messages yet.
              </p>
            ) : (
              <div className="posho-timeline">
                {detail.comments.map((comment) => (
                  <div
                    key={comment.id}
                    className="posho-timeline-item"
                  >
                    <span
                      className="posho-timeline-dot"
                      aria-hidden="true"
                    />

                    <div className="posho-timeline-body">
                      <strong>
                        {comment.author_kind === 'client'
                          ? 'You'
                          : 'Posho Creative'}
                      </strong>

                      <p>{comment.body}</p>

                      <time>
                        {new Date(
                          comment.created_at,
                        ).toLocaleString('en-NG')}
                      </time>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <form
              onSubmit={async (event) => {
                event.preventDefault();

                if (!reply.trim()) {
                  return;
                }

                try {
                  setReplyBusy(true);

                  await runClientProjectAction({
                    action: 'request_comment',
                    request_id: detail.id,
                    body: reply.trim(),
                  });

                  setReply('');
                  await load();
                  const refreshed = await getMyRequests();
                  setRequests(refreshed);

                  const updated = refreshed.find(
                    (request) => request.id === detail.id,
                  );

                  if (updated) {
                    setDetail(updated);
                  }
                } catch (replyError) {
                  toast.error(replyError.message);
                } finally {
                  setReplyBusy(false);
                }
              }}
              className="posho-form-grid"
              style={{ marginTop: 12 }}
            >
              <label>
                <span>Reply</span>

                <textarea
                  value={reply}
                  onChange={(event) => setReply(event.target.value)}
                  maxLength={5000}
                  placeholder="Add more detail or answer Management…"
                />
              </label>

              <button
                type="submit"
                className="button button-secondary"
                disabled={replyBusy}
                aria-busy={replyBusy}
              >
                {replyBusy ? 'Sending…' : 'Send reply'}
              </button>
            </form>

            <div className="posho-modal-actions">
              <button
                type="button"
                className="button button-secondary"
                onClick={() => setDetail(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
