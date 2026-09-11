import {
  useEffect,
  useState,
} from 'react';

import {
  useToast,
} from '../ui/Toast';

import StatusBadge from '../ui/StatusBadge';
import ConfirmDialog from '../ui/ConfirmDialog';

import {
  getMyAgreements,
  getMyMeetings,
  runClientProjectAction,
} from '../../lib/clientOps';

function formatDateTime(value) {
  if (!value) {
    return '';
  }

  return new Date(value).toLocaleString('en-NG', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function ClientAgreements({ order, onChanged }) {
  const toast = useToast();
  const [agreements, setAgreements] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [busy, setBusy] = useState(false);
  const [deciding, setDeciding] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [agreementRows, meetingRows] = await Promise.all([
          getMyAgreements().catch(() => []),
          getMyMeetings().catch(() => []),
        ]);

        if (cancelled) {
          return;
        }

        setAgreements(
          (agreementRows || []).filter(
            (agreement) => agreement.order_id === order.id,
          ),
        );
        setMeetings(
          (meetingRows || []).filter(
            (meeting) => meeting.order_id === order.id,
          ),
        );
      } catch {
        if (!cancelled) {
          setAgreements([]);
          setMeetings([]);
        }
      }
    }

    if (order?.id) {
      load();
    }

    return () => {
      cancelled = true;
    };
  }, [order?.id]);

  const submit = async () => {
    if (!deciding) {
      return;
    }

    try {
      setBusy(true);

      await runClientProjectAction({
        action: 'agreement_decide',
        agreement_id: deciding.id,
        decision: deciding.decision,
        consent_note:
          'Accepted in the client workspace.',
      });

      toast.success(
        deciding.decision === 'accept'
          ? 'Agreement accepted and recorded.'
          : 'Agreement declined. Management has been notified.',
      );
      setDeciding(null);

      const rows = await getMyAgreements().catch(() => []);
      setAgreements(
        (rows || []).filter(
          (agreement) => agreement.order_id === order.id,
        ),
      );
      await onChanged?.();
    } catch (decideError) {
      toast.error(decideError.message);
    } finally {
      setBusy(false);
    }
  };

  if (
    agreements.length === 0 &&
    meetings.length === 0
  ) {
    return null;
  }

  return (
    <>
      {agreements.length > 0 && (
        <section className="workspace-panel">
          <div className="workspace-panel-heading">
            <div>
              <span>AGREEMENTS</span>
              <h3>Terms and acceptance</h3>
            </div>
          </div>

          <div className="posho-ledger">
            {agreements.map((agreement) => (
              <article
                key={agreement.id}
                className="posho-ledger-item"
              >
                <header>
                  <strong className="posho-long-value">
                    {agreement.title} · V{agreement.version}
                  </strong>

                  <StatusBadge value={agreement.status} />
                </header>

                <p style={{ whiteSpace: 'pre-wrap' }}>
                  {String(agreement.body || '').slice(0, 600)}
                  {String(agreement.body || '').length > 600
                    ? '…'
                    : ''}
                </p>

                {agreement.status === 'sent' && (
                  <div className="finance-review-actions">
                    <button
                      type="button"
                      className="button button-primary"
                      disabled={busy}
                      onClick={() =>
                        setDeciding({
                          id: agreement.id,
                          decision: 'accept',
                          title: agreement.title,
                        })
                      }
                    >
                      Accept
                    </button>

                    <button
                      type="button"
                      className="button button-secondary"
                      disabled={busy}
                      onClick={() =>
                        setDeciding({
                          id: agreement.id,
                          decision: 'decline',
                          title: agreement.title,
                        })
                      }
                    >
                      Decline
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>

          <ConfirmDialog
            open={Boolean(deciding)}
            title={
              deciding?.decision === 'accept'
                ? 'Accept agreement'
                : 'Decline agreement'
            }
            description={
              deciding
                ? `“${deciding.title}”? Your decision is recorded with a timestamp.`
                : ''
            }
            confirmLabel={
              deciding?.decision === 'accept'
                ? 'Accept'
                : 'Decline'
            }
            busy={busy}
            busyLabel="Saving…"
            onClose={() => !busy && setDeciding(null)}
            onConfirm={submit}
          />
        </section>
      )}

      {meetings.length > 0 && (
        <section className="workspace-panel">
          <div className="workspace-panel-heading">
            <div>
              <span>MEETINGS</span>
              <h3>Scheduled sessions</h3>
            </div>
          </div>

          <div className="posho-timeline">
            {meetings.map((meeting) => (
              <div
                key={meeting.id}
                className="posho-timeline-item"
              >
                <span
                  className="posho-timeline-dot"
                  aria-hidden="true"
                />

                <div className="posho-timeline-body">
                  <strong>
                    {String(
                      meeting.kind || '',
                    ).replaceAll('_', ' ')}{' '}
                    · {meeting.duration_minutes} min
                  </strong>

                  <p>{formatDateTime(meeting.scheduled_at)}</p>

                  <time>
                    <StatusBadge value={meeting.status} />
                    {meeting.outcome
                      ? ` · ${meeting.outcome}`
                      : ''}
                  </time>
                </div>
              </div>
            ))}
          </div>

          <p
            style={{
              fontSize: 13,
              color: '#5f5878',
            }}
          >
            Reminders appear here in your workspace — no emails are sent.
          </p>
        </section>
      )}
    </>
  );
}
