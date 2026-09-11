export default function MetricCard({ icon: Icon, label, value, detail, tone = 'neutral' }) {
  return (
    <article className={`posho-metric-card posho-metric-${tone}`}>
      {Icon && (
        <span className="posho-metric-icon" aria-hidden="true">
          <Icon size={19} />
        </span>
      )}
      <span className="posho-metric-label">{label}</span>
      <strong className="posho-long-value">{value}</strong>
      {detail && <small>{detail}</small>}
    </article>
  );
}
