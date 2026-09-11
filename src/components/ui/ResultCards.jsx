import { ArrowRight } from 'lucide-react';

import Link from '../PortalLink';
import MoneyDisplay from './MoneyDisplay';
import StatusBadge from './StatusBadge';

export function ProjectCard({ to, reference, title, subtitle, status, meta = [] }) {
  return (
    <Link to={to} className="posho-result-card">
      <div>
        <small className="posho-long-value">{reference}</small>
        <strong className="posho-long-value">{title}</strong>
        {subtitle && <span className="posho-long-value">{subtitle}</span>}
        {meta.length > 0 && (
          <span className="posho-result-meta">
            {meta.map((entry) => (
              <em key={entry.label}>
                {entry.label} <MoneyDisplay kobo={entry.kobo} />
              </em>
            ))}
          </span>
        )}
      </div>
      <span className="posho-result-side">
        {status && <StatusBadge value={status} />}
        <ArrowRight size={17} aria-hidden="true" />
      </span>
    </Link>
  );
}

export function ClientCard({ name, email, company, stats, action = null }) {
  return (
    <article className="posho-ledger-item">
      <header>
        <strong className="posho-long-value">{name || 'Unnamed client'}</strong>
      </header>
      <p className="posho-long-value">{email}</p>
      {company && <p className="posho-long-value">{company}</p>}
      {stats && <p>{stats}</p>}
      {action}
    </article>
  );
}

export default ProjectCard;
