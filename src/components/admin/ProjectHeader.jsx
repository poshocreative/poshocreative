function pillClass(value) {
  const normalized = String(value || '').toLowerCase();

  if (['paid', 'successful', 'completed', 'approved', 'fulfilled'].includes(normalized)) {
    return 'posho-pill solid-green';
  }

  if (['pending', 'under_review', 'awaiting_client', 'processing', 'awaiting_confirmation'].includes(normalized)) {
    return 'posho-pill solid-amber';
  }

  if (['failed', 'declined', 'cancelled', 'expired', 'overdue'].includes(normalized)) {
    return 'posho-pill solid-red';
  }

  if (['awaiting_payment', 'in_progress', 'sent'].includes(normalized)) {
    return 'posho-pill solid-purple';
  }

  return 'posho-pill';
}

export default function ProjectHeader({ order, finance, customerName }) {
  const progress = Math.max(0, Math.min(100, Number(order?.progress_percent || 0)));

  return (
    <header className="posho-project-head">
      <span className="ref posho-long-value">
        {order?.reference} · {order?.service_slug || 'Project'}
        {order?.archived_at ? ' · Archived' : ''}
      </span>
      <h1>{order?.project_title || 'Project'}</h1>

      <div className="posho-pill-row">
        <span className={pillClass(order?.review_decision)}>
          Review: {String(order?.review_decision || 'pending').replaceAll('_', ' ')}
        </span>
        <span className={pillClass(order?.status)}>
          {String(order?.status || 'new').replaceAll('_', ' ')}
        </span>
        <span className={pillClass(order?.payment_status)}>
          Pay: {String(order?.payment_status || 'pending').replaceAll('_', ' ')}
        </span>
        {finance?.approvedRequest && (
          <span className="posho-pill solid-purple">Installment approved</span>
        )}
        {finance?.pendingRequest && (
          <span className="posho-pill solid-amber">Part-payment pending</span>
        )}
      </div>

      <div className="posho-progress-track" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Project progress">
        <div className="posho-progress-fill" style={{ width: `${progress}%` }} />
      </div>
      <div className="posho-progress-meta">
        <span>{progress}% · {order?.progress_label || 'No milestone yet'}</span>
        <span className="posho-long-value">
          {customerName || ''}{order?.deadline ? ` · Due ${order.deadline}` : ''}
        </span>
      </div>
    </header>
  );
}
