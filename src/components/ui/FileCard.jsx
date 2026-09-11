import { FileText } from 'lucide-react';

export function fileKindLabel(file) {
  if (!file) {
    return 'File';
  }

  const role = String(file.file_role || 'reference').replaceAll('_', ' ');
  const mime = file.mime_type || file.mime || '';

  if (mime.startsWith('image/')) {
    return `${role} · image`;
  }

  if (mime === 'application/pdf') {
    return `${role} · PDF`;
  }

  return role;
}

export default function FileCard({ file, onPreview, onDownload, busy = false }) {
  const name =
    file.original_name || file.name || 'Project file';

  return (
    <article className="posho-ledger-item">
      <header>
        <span className="posho-source-tag posho-source-manual">
          {String(file.file_role || 'reference').replaceAll('_', ' ')}
        </span>
        <small className="posho-long-value">{fileKindLabel(file)}</small>
      </header>
      <strong className="posho-long-value" title={name}>
        <FileText size={15} aria-hidden="true" /> {name}
      </strong>
      <p>
        {file.size_bytes ? `${(Number(file.size_bytes) / 1024).toFixed(1)} KB · ` : ''}
        {file.created_at ? new Date(file.created_at).toLocaleDateString('en-NG') : ''}
      </p>
      {(onPreview || onDownload) && (
        <div className="finance-review-actions">
          {onPreview && (
            <button type="button" className="button button-secondary" onClick={() => onPreview(file)} disabled={busy}>
              {busy ? 'Preparing file…' : 'Preview'}
            </button>
          )}
          {onDownload && (
            <button type="button" className="button button-secondary" onClick={() => onDownload(file)} disabled={busy}>
              Download
            </button>
          )}
        </div>
      )}
    </article>
  );
}
