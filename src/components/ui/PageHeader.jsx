export default function PageHeader({ kicker, title, description, actions = null }) {
  return (
    <div className="posho-page-heading">
      <div>
        {kicker && <span className="posho-section-label">{kicker}</span>}
        <h1>{title}</h1>
        {description && <p className="posho-page-description">{description}</p>}
      </div>
      {actions && <div className="posho-page-actions">{actions}</div>}
    </div>
  );
}
