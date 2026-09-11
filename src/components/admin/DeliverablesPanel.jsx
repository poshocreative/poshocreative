import { useRef, useState } from 'react';


import Icon from '../ui/Icon';
import { useToast } from '../ui/Toast';
import { EmptyState, ErrorBlock } from '../ui/StateBlocks';
import StatusBadge from '../ui/StatusBadge';
import { useEscapeClose } from '../ui/useEscapeClose';
import {
  prepareDeliverableFiles,
  publishDeliverable,
  uploadDeliverableFiles,
} from '../../lib/projectWork';

const ACCEPTED_TYPES = '.png,.jpg,.jpeg,.webp,.pdf,.doc,.docx';

export default function DeliverablesPanel({ order, work, onChanged }) {
  const toast = useToast();
  const fileInput = useRef(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [form, setForm] = useState({
    deliverableId: '',
    title: '',
    description: '',
    notes: '',
    final: false,
    visibleToClient: true,
  });

  useEscapeClose(publishOpen && !busy, () => setPublishOpen(false));

  const deliverables = work?.deliverables || [];
  const versionsByDeliverable = work?.versionsByDeliverable || {};
  const loadError = work?.loadErrors?.deliverables || work?.loadErrors?.versions;

  const set = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const openNew = () => {
    setForm({
      deliverableId: '', title: '', description: '', notes: '', final: false, visibleToClient: true,
    });
    setSelectedFiles([]);
    setStage('');
    setPublishOpen(true);
  };

  const openNewVersion = (deliverable) => {
    setForm({
      deliverableId: deliverable.id,
      title: deliverable.title,
      description: deliverable.description || '',
      notes: '',
      final: false,
      visibleToClient: deliverable.visible_to_client !== false,
    });
    setSelectedFiles([]);
    setStage('');
    setPublishOpen(true);
  };

  const onFilesChosen = (event) => {
    const files = Array.from(event.target.files || []).slice(0, 6);
    setSelectedFiles(files);
  };

  const submit = async (event) => {
    event.preventDefault();

    if (!form.deliverableId && !form.title.trim()) {
      toast.error('Give the deliverable a clear title.');
      return;
    }

    if (selectedFiles.length === 0) {
      toast.error('Choose at least one file to publish.');
      return;
    }

    const oversized = selectedFiles.find((file) => file.size > 10 * 1024 * 1024);

    if (oversized) {
      toast.error(`“${oversized.name}” exceeds the 10 MB limit.`);
      return;
    }

    try {
      setBusy(true);
      setStage('Preparing secure upload…');

      const uploads = await prepareDeliverableFiles({
        orderId: order.id,
        files: selectedFiles.map((file) => ({
          name: file.name,
          size: file.size,
          type: file.type,
        })),
      });

      const fileIds = await uploadDeliverableFiles({
        uploads,
        fileList: selectedFiles,
        onStageChange: setStage,
      });

      setStage('Publishing version…');

      const result = await publishDeliverable({
        orderId: order.id,
        deliverableId: form.deliverableId || undefined,
        title: form.title.trim(),
        description: form.description.trim(),
        fileIds,
        notes: form.notes.trim(),
        final: form.final,
        visibleToClient: form.visibleToClient,
      });

      toast.success(`Version ${result.versionNumber} published. The client has been notified.`);
      setPublishOpen(false);
      setSelectedFiles([]);
      if (fileInput.current) fileInput.current.value = '';
      await onChanged?.();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
      setStage('');
    }
  };

  return (
    <section className="admin-control-card">
      <div className="finance-request-heading">
        <div>
          <span>DELIVERY</span>
          <h3>Deliverables</h3>
          <p className="admin-card-description">
            Each publish creates a new version — history is never replaced.
            The client approves or requests revision per version.
          </p>
        </div>
        <button type="button" className="button button-secondary" onClick={openNew}>
          <Icon name="add_circle" size={17} /> Publish deliverable
        </button>
      </div>

      {loadError ? (
        <ErrorBlock message={`Deliverables could not be loaded. ${loadError}`} onRetry={onChanged} />
      ) : deliverables.length === 0 ? (
        <EmptyState title="No deliverables published" body="Published files appear here with full version history." />
      ) : (
        <div className="posho-ledger">
          {deliverables.map((deliverable) => {
            const versions = versionsByDeliverable[deliverable.id] || [];

            return (
              <article key={deliverable.id} className="posho-ledger-item">
                <header>
                  <strong className="posho-long-value">{deliverable.title}</strong>
                  <StatusBadge value={deliverable.client_approval_state} />
                </header>
                {deliverable.description && <p>{deliverable.description}</p>}
                <p>
                  <StatusBadge value={deliverable.status} />
                  {' · '}
                  {versions.length} version{versions.length === 1 ? '' : 's'}
                  {deliverable.visible_to_client === false ? ' · Hidden from client' : ''}
                </p>
                {versions.map((version) => (
                  <div key={version.id} className="posho-version-row" style={{ marginTop: 8 }}>
                    <div>
                      <strong>V{version.version_number} · </strong>
                      <span className="posho-long-value">{version.original_name || 'Deliverable file'}</span>
                      <br />
                      <small>
                        <StatusBadge value={version.approval_state} />
                        {' · '}
                        {new Date(version.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </small>
                      {version.notes && <p style={{ margin: '4px 0 0' }}>{version.notes}</p>}
                      {version.client_feedback && (
                        <p style={{ margin: '4px 0 0' }}><strong>Client feedback:</strong> {version.client_feedback}</p>
                      )}
                    </div>
                  </div>
                ))}
                <div className="finance-review-actions" style={{ marginTop: 8 }}>
                  <button type="button" className="button button-secondary" onClick={() => openNewVersion(deliverable)}>
                    <Icon name="upload_file" size={15} /> Publish V{(versions[0]?.version_number || 0) + 1}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {publishOpen && (
        <div className="posho-modal-backdrop" onClick={() => !busy && setPublishOpen(false)}>
          <form role="dialog" aria-modal="true" aria-label="Publish deliverable" className="posho-modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
            <div className="posho-modal-heading">
              <h3>{form.deliverableId ? `Publish new version — ${form.title}` : 'Publish deliverable'}</h3>
              <button type="button" onClick={() => setPublishOpen(false)} aria-label="Close" disabled={busy}><Icon name="close" size={19} /></button>
            </div>
            <div className="posho-form-grid">
              {!form.deliverableId && (
                <>
                  <label>
                    Title
                    <input value={form.title} maxLength={160} onChange={(e) => set('title', e.target.value)} placeholder="Homepage design" required />
                  </label>
                  <label>
                    Description
                    <textarea value={form.description} maxLength={3000} onChange={(e) => set('description', e.target.value)} placeholder="What is included." />
                  </label>
                </>
              )}
              <label>
                Files (up to 6, 10 MB each)
                <input ref={fileInput} type="file" multiple accept={ACCEPTED_TYPES} onChange={onFilesChosen} />
              </label>
              {selectedFiles.length > 0 && (
                <div className="posho-preview-box">
                  {selectedFiles.map((file) => (
                    <div key={file.name} className="posho-long-value">{file.name} · {(file.size / 1024).toFixed(0)} KB</div>
                  ))}
                </div>
              )}
              <label>
                Version notes
                <textarea value={form.notes} maxLength={3000} onChange={(e) => set('notes', e.target.value)} placeholder="What changed in this version." />
              </label>
              <label className="finance-checkbox-row">
                <input type="checkbox" checked={form.final} onChange={(e) => set('final', e.target.checked)} />
                <span>Mark files as final deliverables</span>
              </label>
              <label className="finance-checkbox-row">
                <input type="checkbox" checked={form.visibleToClient} onChange={(e) => set('visibleToClient', e.target.checked)} />
                <span>Visible to client</span>
              </label>
              {stage && <div className="posho-preview-box" role="status">{stage}</div>}
            </div>
            <div className="posho-modal-actions">
              <button type="button" className="button button-secondary" onClick={() => setPublishOpen(false)} disabled={busy}>Cancel</button>
              <button type="submit" className="button button-primary" disabled={busy || selectedFiles.length === 0} aria-busy={busy}>
                {busy ? 'Publishing…' : 'Publish version'}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
