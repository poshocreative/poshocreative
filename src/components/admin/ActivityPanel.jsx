import { useMemo } from 'react';

import { EmptyState, ErrorBlock } from '../ui/StateBlocks';

function toTime(value) {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function describeEvent(event) {
  const payload = event.payload || {};
  const reference = payload.reference ? ` · ${payload.reference}` : '';

  const titles = {
    order_approved: 'Project approved',
    order_declined: 'Project declined',
    quote_sent: 'Quote issued',
    quote_accepted: 'Quote accepted by client',
    quote_declined: 'Quote declined by client',
    project_price_set: 'Project price set',
    project_additional_cost_added: 'Additional cost added',
    project_additional_cost_waived: 'Additional cost waived',
    additional_cost_added: 'Additional cost added',
    additional_cost_waived: 'Additional cost waived',
    part_payment_requested: 'Part payment requested',
    part_payment_approved: 'Part payment approved',
    part_payment_declined: 'Part payment declined',
    part_payment_received: 'Installment received',
    payment_received: 'Payment received',
    manual_payment_recorded: 'Manual payment recorded',
    payment_adjusted: 'Payment adjusted',
    project_progress_updated: 'Progress updated',
    milestone_completed: 'Milestone completed',
    deliverable_ready: 'Deliverable published',
    deliverable_approved: 'Deliverable approved by client',
    revision_requested: 'Revision requested by client',
    revision_updated: 'Revision updated',
    change_request_sent: 'Change request sent',
    change_request_accepted: 'Change request accepted',
    change_request_declined: 'Change request declined',
    change_request_questioned: 'Change request questioned',
    change_request_implemented: 'Change request implemented',
    project_delivered: 'Project delivered',
    project_completed: 'Project completed',
    feedback_submitted: 'Client feedback received',
    status_changed: 'Status changed',
    project_update: 'Customer update published',
    remaining_payment_requested: 'Remaining balance requested',
    order_created: 'Project submitted',
    customer_files_added: 'Client files added',
  };

  return {
    title: titles[event.event_type] || String(event.event_type || 'Activity').replaceAll('_', ' '),
    detail:
      payload.message ||
      payload.reason ||
      (payload.amount_kobo ? `Amount: ${Number(payload.amount_kobo) / 100}` : '') ||
      '',
    reference,
  };
}

export default function ActivityPanel({ order, loadError }) {
  const items = useMemo(() => {
    const trail = [];

    for (const note of order?.notes || []) {
      trail.push({
        id: `note-${note.id}`,
        at: note.created_at,
        kind: note.is_internal ? 'Internal note' : 'Customer update',
        title: note.is_internal ? 'Internal note' : 'Update sent to customer',
        body: note.note,
      });
    }

    for (const update of order?.progressUpdates || []) {
      trail.push({
        id: `progress-${update.id}`,
        at: update.created_at,
        kind: 'Progress',
        title: `${update.progress_percent}% · ${update.label || 'Progress update'}`,
        body: update.message,
      });
    }

    for (const event of order?.notificationTrail || []) {
      const described = describeEvent(event);
      trail.push({
        id: `event-${event.id}`,
        at: event.created_at,
        kind: 'Notification',
        title: `${described.title}${described.reference}`,
        body: described.detail,
      });
    }

    for (const entry of order?.adminActivity || []) {
      trail.push({
        id: `audit-${entry.id}`,
        at: entry.created_at,
        kind: 'Audit',
        title: entry.description || entry.action,
        body: entry.action,
      });
    }

    for (const change of order?.history || []) {
      trail.push({
        id: `status-${change.id}`,
        at: change.created_at,
        kind: 'Status',
        title: `Status: ${String(change.new_status || change.status || '').replaceAll('_', ' ')}`,
        body: change.note || '',
      });
    }

    return trail.sort((a, b) => toTime(b.at) - toTime(a.at)).slice(0, 120);
  }, [order]);

  if (loadError) {
    return <ErrorBlock message={`Activity could not be loaded. ${loadError}`} />;
  }

  if (items.length === 0) {
    return <EmptyState title="No activity yet" body="Approvals, payments, progress and updates appear here." />;
  }

  const grouped = [];
  let currentDay = null;

  for (const item of items) {
    const day = item.at
      ? new Date(item.at).toLocaleDateString('en-NG', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : '';

    if (day !== currentDay) {
      currentDay = day;
      grouped.push({ kind: 'day', key: `day-${day}-${grouped.length}`, day });
    }

    grouped.push({ kind: 'item', key: item.id, item });
  }

  return (
    <div>
      {grouped.map((entry) => {
        if (entry.kind === 'day') {
          return (
            <h4 key={entry.key} style={{ fontSize: 13, color: '#5f5878', margin: '14px 0 8px' }}>
              {entry.day}
            </h4>
          );
        }

        const item = entry.item;

        return (
          <div key={entry.key}>
            <div className="posho-timeline-item">
              <span className="posho-timeline-dot" aria-hidden="true">•</span>
              <div className="posho-timeline-body">
                <strong>{item.title}</strong>
                {item.body && <p>{item.body}</p>}
                <time>
                  {item.at ? new Date(item.at).toLocaleString('en-NG') : ''} · {item.kind}
                </time>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
