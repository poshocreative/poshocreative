import {
  useCallback,
  useEffect,
  useState,
} from 'react';


import Icon from '../components/ui/Icon';
import BrandLoader from '../components/BrandLoader';
import FieldError from '../components/ui/FieldError';
import Modal, {
  ModalHeading,
} from '../components/ui/Modal';
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

  const [fieldErrors, setFieldErrors] =
    useState({});

  const updateFormField = (
    field,
    value,
  ) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));

    setFieldErrors(
      (current) => {
        if (!current[field]) {
          return current;
        }

        const next = {
          ...current,
        };

        delete next[field];

        return next;
      },
    );
  };

  const focusField = (id) => {
    window.setTimeout(() => {
      document
        .getElementById(id)
        ?.focus();
    }, 30);
  };

  const openCreate = () => {
    setFieldErrors({});
    setCreateOpen(true);
  };

  const closeCreate = () => {
    if (busy) {
      return;
    }

    setFieldErrors({});
    setCreateOpen(false);
  };

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

    const nextErrors = {};

    if (!form.title.trim()) {
      nextErrors.title =
        'Tell us what you need — a short title is required.';
    } else if (
      form.title.trim().length < 4
    ) {
      nextErrors.title =
        'Give a little more detail — at least 4 characters.';
    }

    if (!form.description.trim()) {
      nextErrors.description =
        'Add a few details so Management can act without back-and-forth.';
    } else if (
      form.description.trim()
        .length < 10
    ) {
      nextErrors.description =
        'Add a little more context — at least 10 characters.';
    }

    setFieldErrors(nextErrors);

    if (
      Object.keys(nextErrors)
        .length > 0
    ) {
      focusField(
        nextErrors.title
          ? 'request-title'
          : 'request-description',
      );

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
      setFieldErrors({});
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
            onClick={() => openCreate()}
          >
            <Icon name="add" size={17} />
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
              onClick={() => openCreate()}
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
                  <Icon name="chat" size={15} /> Details
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {createOpen && (
        <Modal
          labelledBy="new-request-title"
          busy={busy}
          onClose={() =>
            closeCreate()
          }
        >
          <form
            onSubmit={submit}
            noValidate
          >
            <ModalHeading
              id="new-request-title"
              title="New request"
              busy={busy}
              onClose={() =>
                closeCreate()
              }
            />

            <div className="posho-form-grid">
              <label
                className={
                  fieldErrors.title
                    ? 'field-invalid'
                    : ''
                }
              >
                <span>What do you need?</span>
                <input
                  id="request-title"
                  value={form.title}
                  onChange={(event) =>
                    updateFormField(
                      'title',
                      event.target.value,
                    )
                  }
                  maxLength={200}
                  placeholder="Update homepage headline"
                  aria-invalid={Boolean(
                    fieldErrors.title,
                  )}
                  aria-describedby={
                    fieldErrors.title
                      ? 'request-title-error'
                      : undefined
                  }
                />

                <FieldError
                  id="request-title-error"
                  message={
                    fieldErrors.title
                  }
                />
              </label>

              <label
                className={
                  fieldErrors.description
                    ? 'field-invalid'
                    : ''
                }
              >
                <span>Details</span>
                <textarea
                  id="request-description"
                  value={form.description}
                  onChange={(event) =>
                    updateFormField(
                      'description',
                      event.target.value,
                    )
                  }
                  maxLength={5000}
                  placeholder="Current text, new text, links…"
                  aria-invalid={Boolean(
                    fieldErrors.description,
                  )}
                  aria-describedby={
                    fieldErrors.description
                      ? 'request-description-error'
                      : undefined
                  }
                />

                <FieldError
                  id="request-description-error"
                  message={
                    fieldErrors.description
                  }
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
                onClick={() => closeCreate()}
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
        </Modal>
      )}

      {detail && (
        <Modal
          wide
          labelledBy="request-detail-title"
          onClose={() =>
            setDetail(null)
          }
        >
          <div>
            <div className="posho-modal-heading">
              <div>
                <span>REQUEST · {detail.reference}</span>
                <h3 id="request-detail-title" className="posho-long-value">{detail.title}</h3>
              </div>

              <button
                type="button"
                onClick={() => setDetail(null)}
                aria-label="Close dialog"
              >
                <Icon name="close" size={19} />
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
        </Modal>
      )}
    </div>
  );
}
