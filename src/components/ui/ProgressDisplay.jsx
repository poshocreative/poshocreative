export default function ProgressDisplay({ percent = 0, label = '', compact = false }) {
  const value = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));

  return (
    <div className={compact ? 'posho-progress-compact' : 'posho-progress'}>
      <div
        className="posho-progress-track posho-progress-track-light"
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label || 'Progress'}
      >
        <div className="posho-progress-fill posho-progress-fill-brand" style={{ width: `${value}%` }} />
      </div>
      <div className="posho-progress-meta">
        <span>{label || 'Progress'}</span>
        <strong>{value}%</strong>
      </div>
    </div>
  );
}
