export default function Skeleton({ lines = 3, label = 'Loading content…' }) {
  return (
    <div className="posho-skeleton" role="status" aria-label={label}>
      {Array.from({ length: lines }).map((_, index) => (
        <span key={index} className="posho-skeleton-line" aria-hidden="true" />
      ))}
    </div>
  );
}
