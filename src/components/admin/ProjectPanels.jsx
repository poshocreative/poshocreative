import { useState } from 'react';

import { EmptyState, ErrorBlock } from '../ui/StateBlocks';
import { useToast } from '../ui/Toast';
import {
  getProjectFileUrl,
  openProjectFile,
  updateAdminProjectProgress,
} from '../../lib/projectOperations';

const PRESETS = [
  { value: 0, label: 'Awaiting start' },
  { value: 10, label: 'Planning' },
  { value: 25, label: 'Foundation' },
  { value: 50, label: 'Production' },
  { value: 75, label: 'Review and refinement' },
  { value: 90, label: 'Final checks' },
  { value: 100, label: 'Completed' },
];

export function ProgressPublisher({ order, onChanged }) {
  const toast = useToast();
  const [percent, setPercent] = useState(String(order?.progress_percent ?? 0));
  const [label, setLabel] = useState(order?.progress_label || '');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const numeric = Number(percent);
  const valid =
    Number.isFinite(numeric) && numeric >= 0 && numeric <= 100;

  const publish = async (event) => {
    event.preventDefault();

    if (!valid) {
      toast.error('Enter a progress percentage between 0 and 100.');
      return;
    }

    if (label.trim().length < 3) {
      toast.error('Add a short milestone name (at least 3 characters).');
      return;
    }

    if (message.trim().length < 10) {
      toast.error('Write a detailed customer update (at least 10 characters).');
      return;
    }

    try {
      setBusy(true);
      await updateAdminProjectProgress({
        orderId: order.id,
        progressPercent: Math.round(numeric),
        label: label.trim(),
        message: message.trim(),
      });
      toast.success('Progress published. The customer has been notified.');
      setMessage('');
      await onChanged?.();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="admin-control-card">
      <span className="posho-section-label">Progress management</span>
      <h3>Publish customer-facing progress</h3>

      <div className="finance-review-grid" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '12px 0' }}>
        {PRESETS.map((preset) => (
          <button
            key={preset.value}
            type="button"
            className="button button-secondary"
            onClick={() => {
              setPercent(String(preset.value));
              setLabel(preset.label);
            }}
          >
            {preset.value}% · {preset.label}
          </button>
        ))}
      </div>

      <form onSubmit={publish} className="posho-form-grid">
        <label>
          Percentage (0–100)
          <input
            type="number" min="0" max="100" step="1"
            value={percent}
            onChange={(event) => setPercent(event.target.value)}
          />
        </label>
        <label>
          Milestone
          <input value={label} maxLength={120} onChange={(event) => setLabel(event.target.value)} placeholder="Production" />
        </label>
        <label>
          Customer update
          <textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="What changed, what is next, and anything the customer should review." />
        </label>
        <button type="submit" className="button button-primary" disabled={busy} aria-busy={busy}>
          {busy ? 'Publishing…' : 'Publish progress'}
        </button>
      </form>
    </section>
  );
}

export function ProgressHistory({ updates, loadError }) {
  if (loadError) {
    return <ErrorBlock message={`Progress history could not be loaded securely. ${loadError}`} />;
  }

  if (!updates || updates.length === 0) {
    return <EmptyState title="No progress published yet" body="Published milestones appear here with timestamps." />;
  }

  return (
    <div className="posho-timeline">
      {updates.map((update) => (
        <div key={update.id} className="posho-timeline-item">
          <span className="posho-timeline-dot">{Number(update.progress_percent ?? 0)}%</span>
          <div className="posho-timeline-body">
            <strong>{update.label || 'Progress update'}</strong>
            <p>{update.message}</p>
            <time>{new Date(update.created_at).toLocaleString('en-NG')}</time>
          </div>
        </div>
      ))}
    </div>
  );
}

export function FilesPanel({ files, loadError }) {
  const toast = useToast();
  const [busyId, setBusyId] = useState('');

  if (loadError) {
    return <ErrorBlock message={`Project files could not be loaded securely. ${loadError}`} />;
  }

  if (!files || files.length === 0) {
    return <EmptyState title="No project files yet" body="Client references and project assets for this project appear here." />;
  }

  const open = async (file) => {
    try {
      setBusyId(file.id);
      await openProjectFile(file);
    } catch (error) {
      toast.error(error.message || 'This file could not be opened securely.');
    } finally {
      setBusyId('');
    }
  };

  const download = async (file) => {
    try {
      setBusyId(file.id);
      const url = await getProjectFileUrl(file, { download: true });
      const link = document.createElement('a');
      link.href = url;
      link.download = file.original_name || 'project-file';
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      toast.error(error.message || 'This file could not be downloaded securely.');
    } finally {
      setBusyId('');
    }
  };

  return (
    <div className="posho-ledger">
      {files.map((file) => (
        <article key={file.id} className="posho-ledger-item">
          <header>
            <span className="posho-source-tag posho-source-manual">
              {String(file.file_role || 'reference').replaceAll('_', ' ')}
            </span>
            <small>{file.mime || ''}</small>
          </header>
          <strong className="posho-long-value">{file.original_name || 'Project file'}</strong>
          <p>
            {file.size_bytes ? `${(Number(file.size_bytes) / 1024).toFixed(1)} KB · ` : ''}
            Uploaded {file.created_at ? new Date(file.created_at).toLocaleDateString('en-NG') : 'recently'}
          </p>
          <div className="finance-review-actions">
            <button type="button" className="button button-secondary" onClick={() => open(file)} disabled={busyId === file.id}>
              {busyId === file.id ? 'Preparing file…' : 'Preview'}
            </button>
            <button type="button" className="button button-secondary" onClick={() => download(file)} disabled={busyId === file.id}>
              Download
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
