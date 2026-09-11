import { useCallback, useEffect, useState } from 'react';

import StatusBadge from '../ui/StatusBadge';
import { ErrorBlock } from '../ui/StateBlocks';

import { getMeetingsForOrder } from '../../lib/operations';

function pretty(value) {
  return String(value || '').replaceAll('_', ' ');
}

export default function ProjectMeetings({ order }) {
  const [meetings, setMeetings] = useState([]);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setError('');
      setMeetings(await getMeetingsForOrder(order.id));
    } catch (loadError) {
      setError(loadError.message || 'Meetings could not be loaded.');
    }
  }, [order.id]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <section className="admin-control-card">
      <span className="posho-section-label">Scheduling</span>
      <h3>Meetings</h3>

      <p className="admin-card-description">
        Schedule from Sales — project meetings land here automatically.
      </p>

      {error ? (
        <ErrorBlock message={error} onRetry={load} />
      ) : meetings.length === 0 ? (
        <p className="admin-card-description">
          No meetings linked to this project yet.
        </p>
      ) : (
        <div className="posho-timeline">
          {meetings.map((meeting) => (
            <div key={meeting.id} className="posho-timeline-item">
              <span
                className="posho-timeline-dot"
                aria-hidden="true"
              />

              <div className="posho-timeline-body">
                <strong>
                  {pretty(meeting.kind)} ·{' '}
                  {new Date(
                    meeting.scheduled_at,
                  ).toLocaleString('en-NG')}
                </strong>

                {meeting.outcome && <p>{meeting.outcome}</p>}
                {meeting.next_action && (
                  <p>Next: {meeting.next_action}</p>
                )}

                <time>
                  <StatusBadge value={meeting.status} />
                </time>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
