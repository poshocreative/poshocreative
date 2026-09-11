export default function Timeline({ items = [] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="posho-timeline">
      {items.map((item) => (
        <div key={item.id} className="posho-timeline-item">
          <span className="posho-timeline-dot" aria-hidden="true">
            {item.marker || '•'}
          </span>
          <div className="posho-timeline-body">
            <strong>{item.title}</strong>
            {item.body && <p>{item.body}</p>}
            {(item.at || item.meta) && (
              <time>
                {item.at ? new Date(item.at).toLocaleString('en-NG') : ''}
                {item.at && item.meta ? ' · ' : ''}
                {item.meta || ''}
              </time>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
