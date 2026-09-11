import StatusBadge from '../ui/StatusBadge';
import { EmptyState, ErrorBlock } from '../ui/StateBlocks';

function formatDate(value) {
  if (!value) return '';
  const date = value.length <= 10 ? new Date(`${value}T12:00:00`) : new Date(value);
  return date.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function MilestonesView({ work, onChanged }) {
  const milestones = work?.milestones || [];
  const tasks = (work?.tasks || []).filter((task) => task.client_visible === true);
  const scope = work?.scope || null;
  const loadError = work?.loadErrors?.milestones || work?.loadErrors?.tasks;

  const showScope = scope && (
    scope.summary || scope.deliverables_summary || scope.included_revisions ||
    scope.features || scope.pages || scope.platforms ||
    scope.dependencies || scope.exclusions || scope.client_responsibilities
  );

  return (
    <>
      {showScope && (
        <section className="workspace-panel">
          <div className="workspace-panel-heading">
            <div>
              <span>AGREED SCOPE</span>
              <h3>What was promised</h3>
            </div>
          </div>
          <div className="project-info-content">
            {scope.summary && <div><span>Summary</span><p>{scope.summary}</p></div>}
            {scope.deliverables_summary && <div><span>Deliverables</span><p>{scope.deliverables_summary}</p></div>}
            {scope.included_revisions && <div><span>Included revisions</span><p>{scope.included_revisions}</p></div>}
            {scope.features && <div><span>Features</span><p>{scope.features}</p></div>}
            {scope.pages && <div><span>Pages</span><p>{scope.pages}</p></div>}
            {scope.platforms && <div><span>Platforms</span><p>{scope.platforms}</p></div>}
            {scope.dependencies && <div><span>Dependencies</span><p>{scope.dependencies}</p></div>}
            {scope.exclusions && <div><span>Out of scope</span><p>{scope.exclusions}</p></div>}
            {scope.client_responsibilities && <div><span>Your responsibilities</span><p>{scope.client_responsibilities}</p></div>}
          </div>
        </section>
      )}

      <section className="workspace-panel">
        <div className="workspace-panel-heading">
          <div>
            <span>ROADMAP</span>
            <h3>Milestones</h3>
          </div>
        </div>
        {loadError ? (
          <ErrorBlock message={`Milestones could not be loaded. ${loadError}`} onRetry={onChanged} />
        ) : milestones.length === 0 ? (
          <EmptyState title="No milestones shared yet" body="Delivery stages appear here as work progresses." />
        ) : (
          <div className="posho-timeline">
            {milestones.map((milestone) => (
              <div key={milestone.id} className="posho-timeline-item">
                <span className="posho-timeline-dot" aria-hidden="true">•</span>
                <div className="posho-timeline-body">
                  <strong>{milestone.title}</strong>
                  {milestone.description && <p>{milestone.description}</p>}
                  <time>
                    <StatusBadge value={milestone.status} />
                    {milestone.expected_date ? ` · Due ${formatDate(milestone.expected_date)}` : ''}
                    {milestone.completed_date ? ` · Done ${formatDate(milestone.completed_date)}` : ''}
                  </time>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {tasks.length > 0 && (
        <section className="workspace-panel">
          <div className="workspace-panel-heading">
            <div>
              <span>SHARED STEPS</span>
              <h3>What needs us</h3>
            </div>
          </div>
          <div className="posho-ledger">
            {tasks.map((task) => (
              <article key={task.id} className="posho-ledger-item">
                <header>
                  <strong className="posho-long-value">{task.title}</strong>
                  <StatusBadge value={task.status} />
                </header>
                {task.due_at && <p>Due {formatDate(task.due_at)}</p>}
              </article>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
