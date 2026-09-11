export default function ActionCard({ title, body, actions = null, tone = 'default' }) {
  return (
    <div className={`posho-action-item posho-action-${tone}`}>
      <div>
        <strong>{title}</strong>
        {body && <p>{body}</p>}
        {actions && <div className="posho-action-buttons">{actions}</div>}
      </div>
    </div>
  );
}
