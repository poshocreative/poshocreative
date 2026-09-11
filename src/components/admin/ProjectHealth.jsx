import StatusBadge from '../ui/StatusBadge';

import {
  HEALTH_LABELS,
  scoreProjectHealth,
} from '../../lib/health';

export default function ProjectHealth({
  order,
  work,
}) {
  const health = scoreProjectHealth(
    order,
    {
      tasks: work?.tasks || [],
      revisions: work?.revisions || [],
      changes: work?.changeRequests || [],
      timeEntries: work?.timeEntries || [],
    },
  );

  return (
    <section className="admin-control-card">
      <div className="finance-request-heading">
        <div>
          <span>
            PROJECT HEALTH
          </span>

          <h3>
            {HEALTH_LABELS[health.level]}
          </h3>

          <p className="admin-card-description">
            Rule-based and explainable — every
            signal is listed below.
          </p>
        </div>

        <StatusBadge
          value={health.level}
          label={HEALTH_LABELS[health.level]}
        />
      </div>

      {health.reasons.length === 0 ? (
        <p className="admin-card-description">
          No risks detected. Deadlines,
          blockers, payments and budget
          burn all look healthy.
        </p>
      ) : (
        <ul>
          {health.reasons.map(
            (
              reason,
              index,
            ) => (
              <li
                key={index}
                className="posho-long-value"
              >
                {reason}
              </li>
            ),
          )}
        </ul>
      )}
    </section>
  );
}
