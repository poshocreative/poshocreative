import { X } from 'lucide-react';

import { useEscapeClose } from '../ui/useEscapeClose';
import StatusBadge from '../ui/StatusBadge';
import { formatKobo } from '../../lib/money';

function formatDate(value) {
  if (!value) return 'Not set';
  const date = value.length <= 10 ? new Date(`${value}T12:00:00`) : new Date(value);
  return date.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * READ-ONLY Management preview of the client experience.
 * Renders only client-visible data. No payments, approvals,
 * messages, uploads or data changes are possible here.
 */
export default function ClientPreview({ open, order, work, finance, onClose }) {
  useEscapeClose(open, onClose);

  if (!open || !order) {
    return null;
  }

  const visibleMilestones = (work?.milestones || []).filter(
    (milestone) => milestone.client_visible !== false,
  );
  const visibleTasks = (work?.tasks || []).filter(
    (task) => task.client_visible === true,
  );
  const visibleDeliverables = (work?.deliverables || []).filter(
    (deliverable) => deliverable.visible_to_client !== false,
  );
  const versionsByDeliverable = work?.versionsByDeliverable || {};
  const scope = work?.scope && work.scope.visible_to_client !== false ? work.scope : null;
  const progress = Math.max(0, Math.min(100, Number(order.progress_percent || 0)));

  return (
    <div className="posho-modal-backdrop" onClick={onClose} style={{ alignItems: 'flex-start' }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Client preview (read-only)"
        className="posho-modal posho-modal-wide"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 720 }}
      >
        <div className="posho-modal-heading">
          <div>
            <span className="posho-section-label">Preview as client · read-only</span>
            <h3 className="posho-long-value">{order.project_title}</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="Close preview"><X size={19} /></button>
        </div>

        <p className="posho-modal-description">
          Exactly what this client currently sees. Actions are disabled in preview.
        </p>

        <div className="posho-preview-readonly">
          <section className="workspace-panel">
            <span>PROGRESS</span>
            <h3>{progress}% · {order.progress_label || 'In progress'}</h3>
            <div className="posho-progress-track" style={{ background: '#ece7f8' }} role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Project progress">
              <div className="posho-progress-fill" style={{ width: `${progress}%`, background: '#6C2BD9' }} />
            </div>
            {order.progress_message && <p style={{ marginTop: 8 }}>{order.progress_message}</p>}
          </section>

          {finance?.hasPrice && (
            <section className="workspace-panel">
              <span>FINANCIALS</span>
              <div className="posho-kv">
                <div><span>Project value</span><strong>{formatKobo(finance.total)}</strong></div>
                <div><span>Paid</span><strong>{formatKobo(finance.paid)}</strong></div>
                <div><span>Outstanding</span><strong>{formatKobo(finance.outstanding)}</strong></div>
                <div><span>Due now</span><strong>{formatKobo(finance.dueNow)}</strong></div>
              </div>
            </section>
          )}

          {scope && (
            <section className="workspace-panel">
              <span>AGREED SCOPE</span>
              <div className="posho-kv">
                {scope.summary && <div><span>Summary</span><strong style={{ fontWeight: 400 }}>{scope.summary}</strong></div>}
                {scope.deliverables_summary && <div><span>Deliverables</span><strong style={{ fontWeight: 400 }}>{scope.deliverables_summary}</strong></div>}
                {scope.exclusions && <div><span>Out of scope</span><strong style={{ fontWeight: 400 }}>{scope.exclusions}</strong></div>}
              </div>
            </section>
          )}

          {visibleMilestones.length > 0 && (
            <section className="workspace-panel">
              <span>MILESTONES</span>
              <div className="posho-timeline">
                {visibleMilestones.map((milestone) => (
                  <div key={milestone.id} className="posho-timeline-item">
                    <span className="posho-timeline-dot" aria-hidden="true">•</span>
                    <div className="posho-timeline-body">
                      <strong>{milestone.title}</strong>
                      {milestone.description && <p>{milestone.description}</p>}
                      <time>
                        <StatusBadge value={milestone.status} />
                        {milestone.expected_date ? ` · Due ${formatDate(milestone.expected_date)}` : ''}
                      </time>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {visibleTasks.length > 0 && (
            <section className="workspace-panel">
              <span>SHARED NEXT STEPS</span>
              <div className="posho-ledger">
                {visibleTasks.map((task) => (
                  <article key={task.id} className="posho-ledger-item">
                    <header>
                      <strong className="posho-long-value">{task.title}</strong>
                      <StatusBadge value={task.status} />
                    </header>
                  </article>
                ))}
              </div>
            </section>
          )}

          <section className="workspace-panel">
            <span>DELIVERABLES</span>
            {visibleDeliverables.length === 0 ? (
              <p className="admin-card-description">No deliverables shared yet.</p>
            ) : (
              <div className="posho-ledger">
                {visibleDeliverables.map((deliverable) => {
                  const versions = versionsByDeliverable[deliverable.id] || [];
                  const current = versions[0];

                  return (
                    <article key={deliverable.id} className="posho-ledger-item">
                      <header>
                        <strong className="posho-long-value">{deliverable.title}</strong>
                        <StatusBadge value={deliverable.client_approval_state} />
                      </header>
                      {current && (
                        <p>
                          Current: V{current.version_number}
                          {current.original_name ? ` · ${current.original_name}` : ''}
                        </p>
                      )}
                      <p><small>{versions.length} version{versions.length === 1 ? '' : 's'} shared</small></p>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <div className="posho-modal-actions">
          <button type="button" className="button button-secondary" onClick={onClose}>
            Close preview
          </button>
        </div>
      </div>
    </div>
  );
}
