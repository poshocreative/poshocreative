export function toneForStatus(value) {
  const normalized = String(value || '').toLowerCase();

  if (
    [
      'paid', 'successful', 'completed', 'approved', 'fulfilled', 'accepted',
      'delivered', 'resolved', 'active', 'sent', 'healthy', 'available',
    ].includes(normalized)
  ) {
    return 'green';
  }

  if (
    [
      'pending', 'under_review', 'awaiting_client', 'processing',
      'awaiting_confirmation', 'awaiting_payment', 'open', 'due_soon',
      'in_progress', 'acknowledged', 'questioned', 'draft', 'attention',
      'at_risk',
    ].includes(normalized)
  ) {
    return 'amber';
  }

  if (
    [
      'failed', 'declined', 'cancelled', 'expired', 'overdue', 'rejected',
      'rejected_out_of_scope', 'critical', 'overloaded',
    ].includes(normalized)
  ) {
    return 'red';
  }

  if (
    [
      'awaiting_payment', 'in_production', 'production', 'internal_review',
      'client_review', 'revision', 'final_review', 'superseded',
    ].includes(normalized)
  ) {
    return 'purple';
  }

  return 'gray';
}

export default function StatusBadge({ value, label }) {
  const tone = toneForStatus(value);

  return (
    <span className={`posho-status-badge posho-status-${tone}`}>
      {label || String(value || '—').replaceAll('_', ' ')}
    </span>
  );
}
