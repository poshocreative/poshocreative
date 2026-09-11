import BrandLoader from '../BrandLoader';

export function EmptyState({ title, body, action = null }) {
  return (
    <div className="posho-empty-state" role="status">
      <strong>{title}</strong>
      {body && <p>{body}</p>}
      {action}
    </div>
  );
}

export function ErrorBlock({ message, onRetry, retryLabel = 'Try again' }) {
  return (
    <div className="posho-error-block" role="alert">
      <strong>Something could not be loaded</strong>
      <p>{message || 'Please try again shortly.'}</p>
      {onRetry && (
        <button type="button" className="button button-secondary" onClick={onRetry}>
          {retryLabel}
        </button>
      )}
    </div>
  );
}

export function LoadingBlock({ label = 'Loading…' }) {
  return <BrandLoader label={label} />;
}

export function FieldError({ message }) {
  if (!message) {
    return null;
  }

  return (
    <p className="posho-field-error" role="alert">
      {message}
    </p>
  );
}
