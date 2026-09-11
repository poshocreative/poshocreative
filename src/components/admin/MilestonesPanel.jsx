import { useEffect, useState } from 'react';


import Icon from '../ui/Icon';
import { useToast } from '../ui/Toast';
import { EmptyState, ErrorBlock } from '../ui/StateBlocks';
import StatusBadge from '../ui/StatusBadge';
import { useEscapeClose } from '../ui/useEscapeClose';
import { deleteMilestone, saveMilestone } from '../../lib/projectWork';
import { supabase } from '../../lib/supabase';

const MILESTONE_STATUSES = ['pending', 'active', 'blocked', 'done', 'cancelled'];

const emptyForm = {
  milestoneId: '',
  title: '',
  description: '',
  sequence: '',
  status: 'pending',
  expectedDate: '',
  clientVisible: true,
};

export default function MilestonesPanel({ order, work, onChanged }) {
  const toast = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [templateBusy, setTemplateBusy] = useState(false);

  useEscapeClose(formOpen && !busy, () => setFormOpen(false));
  useEscapeClose(Boolean(deleteTarget) && !busy, () => setDeleteTarget(null));

  const milestones = work?.milestones || [];
  const loadError = work?.loadErrors?.milestones;
  const [template, setTemplate] = useState([]);
  const [templateMissing, setTemplateMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadTemplate() {
      if (!order?.service_slug) {
        setTemplate([]);
        setTemplateMissing(true);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('service_milestone_templates')
          .select('title,description,sequence,default_duration_days')
          .eq('service_slug', order.service_slug)
          .order('sequence', { ascending: true });

        if (error) throw error;

        if (!cancelled) {
          setTemplate(data || []);
          setTemplateMissing((data || []).length === 0);
        }
      } catch {
        if (!cancelled) {
          setTemplate([]);
          setTemplateMissing(true);
        }
      }
    }

    loadTemplate();

    return () => {
      cancelled = true;
    };
  }, [order?.service_slug]);

  const set = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const openNew = () => {
    setForm({ ...emptyForm, sequence: String(milestones.length + 1) });
    setFormOpen(true);
  };

  const openEdit = (milestone) => {
    setForm({
      milestoneId: milestone.id,
      title: milestone.title || '',
      description: milestone.description || '',
      sequence: String(milestone.sequence ?? ''),
      status: milestone.status || 'pending',
      expectedDate: milestone.expected_date || '',
      clientVisible: milestone.client_visible !== false,
    });
    setFormOpen(true);
  };

  const submit = async (event) => {
    event.preventDefault();

    if (!form.title.trim()) {
      toast.error('Give the milestone a clear title.');
      return;
    }

    try {
      setBusy(true);
      await saveMilestone({
        orderId: order.id,
        milestone: {
          milestoneId: form.milestoneId || undefined,
          title: form.title.trim(),
          description: form.description.trim(),
          sequence: form.sequence === '' ? 0 : Number(form.sequence),
          status: form.status,
          expectedDate: form.expectedDate || null,
          clientVisible: form.clientVisible,
        },
      });
      toast.success(form.milestoneId ? 'Milestone updated.' : 'Milestone added.');
      setFormOpen(false);
      setForm(emptyForm);
      await onChanged?.();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    try {
      setBusy(true);
      await deleteMilestone({ orderId: order.id, milestoneId: deleteTarget.id });
      toast.success('Milestone removed.');
      setDeleteTarget(null);
      await onChanged?.();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  const applyTemplate = async () => {
    if (template.length === 0) return;

    try {
      setTemplateBusy(true);
      let sequence = milestones.length;
      const today = new Date();

      for (const item of template) {
        sequence += 1;

        const expected = new Date(today);
        expected.setDate(
          expected.getDate() + Number(item.default_duration_days || 0),
        );

        await saveMilestone({
          orderId: order.id,
          milestone: {
            title: item.title,
            description: item.description,
            sequence,
            status: 'pending',
            expectedDate: expected.toISOString().slice(0, 10),
            clientVisible: true,
          },
        });
      }

      toast.success(`${template.length} milestones added from the service template.`);
      await onChanged?.();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setTemplateBusy(false);
    }
  };

  const markDone = async (milestone) => {
    try {
      setBusy(true);
      await saveMilestone({
        orderId: order.id,
        milestone: {
          milestoneId: milestone.id,
          title: milestone.title,
          description: milestone.description || '',
          sequence: milestone.sequence ?? 0,
          status: 'done',
          expectedDate: milestone.expected_date || null,
          clientVisible: milestone.client_visible !== false,
        },
      });
      toast.success(`Milestone “${milestone.title}” completed. The client has been notified.`);
      await onChanged?.();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="admin-control-card">
      <div className="finance-request-heading">
        <div>
          <span>WORK PLAN</span>
          <h3>Milestones</h3>
          <p className="admin-card-description">
            Structured delivery stages. Client-visible milestones appear in the
            client workspace; completing one notifies the client.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {milestones.length === 0 && template.length > 0 && (
            <button type="button" className="button button-secondary" onClick={applyTemplate} disabled={templateBusy} aria-busy={templateBusy}>
              {templateBusy ? 'Applying…' : 'Apply service template'}
            </button>
          )}
          {milestones.length === 0 && templateMissing && (
            <small className="admin-card-description">
              No milestone template is configured for this service yet — define one in Services.
            </small>
          )}
          <button type="button" className="button button-secondary" onClick={openNew}>
            <Icon name="add_circle" size={17} /> Add milestone
          </button>
        </div>
      </div>

      {loadError ? (
        <ErrorBlock message={`Milestones could not be loaded. ${loadError}`} onRetry={onChanged} />
      ) : milestones.length === 0 ? (
        <EmptyState title="No milestones yet" body="Break delivery into reviewable stages, or apply the service template to start faster." />
      ) : (
        <div className="posho-timeline">
          {milestones.map((milestone) => (
            <div key={milestone.id} className="posho-timeline-item">
              <span className="posho-timeline-dot" aria-hidden="true">•</span>
              <div className="posho-timeline-body">
                <strong className="posho-long-value">{milestone.sequence ? `${milestone.sequence}. ` : ''}{milestone.title}</strong>
                {milestone.description && <p>{milestone.description}</p>}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 6 }}>
                  <StatusBadge value={milestone.status} />
                  {milestone.client_visible === false && <StatusBadge value="internal" label="Internal" />}
                  {milestone.expected_date && (
                    <time>Due {new Date(`${milestone.expected_date}T12:00:00`).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}</time>
                  )}
                  {milestone.completed_date && (
                    <time>Done {new Date(`${milestone.completed_date}T12:00:00`).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}</time>
                  )}
                </div>
                <div className="finance-review-actions" style={{ marginTop: 8 }}>
                  {milestone.status !== 'done' && (
                    <button type="button" className="button button-secondary" onClick={() => markDone(milestone)} disabled={busy}>
                      <Icon name="check_circle" size={15} /> Mark done
                    </button>
                  )}
                  <button type="button" className="button button-secondary" onClick={() => openEdit(milestone)}>
                    <Icon name="edit" size={15} /> Edit
                  </button>
                  <button type="button" className="button button-secondary" onClick={() => setDeleteTarget(milestone)}>
                    <Icon name="delete" size={15} /> Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {formOpen && (
        <div className="posho-modal-backdrop" onClick={() => !busy && setFormOpen(false)}>
          <form role="dialog" aria-modal="true" aria-label={form.milestoneId ? 'Edit milestone' : 'Add milestone'} className="posho-modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
            <div className="posho-modal-heading">
              <h3>{form.milestoneId ? 'Edit milestone' : 'Add milestone'}</h3>
              <button type="button" onClick={() => setFormOpen(false)} aria-label="Close" disabled={busy}><Icon name="close" size={19} /></button>
            </div>
            <div className="posho-form-grid">
              <label>
                Title
                <input value={form.title} maxLength={160} onChange={(e) => set('title', e.target.value)} placeholder="Design" required />
              </label>
              <label>
                Description
                <textarea value={form.description} maxLength={3000} onChange={(e) => set('description', e.target.value)} placeholder="What this stage covers." />
              </label>
              <label>
                Sequence
                <input type="number" min="0" step="1" value={form.sequence} onChange={(e) => set('sequence', e.target.value)} />
              </label>
              <label>
                Status
                <select value={form.status} onChange={(e) => set('status', e.target.value)}>
                  {MILESTONE_STATUSES.map((status) => (
                    <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>
                  ))}
                </select>
              </label>
              <label>
                Expected date
                <input type="date" value={form.expectedDate} onChange={(e) => set('expectedDate', e.target.value)} />
              </label>
              <label className="finance-checkbox-row">
                <input type="checkbox" checked={form.clientVisible} onChange={(e) => set('clientVisible', e.target.checked)} />
                <span>Visible to client</span>
              </label>
            </div>
            <div className="posho-modal-actions">
              <button type="button" className="button button-secondary" onClick={() => setFormOpen(false)} disabled={busy}>Cancel</button>
              <button type="submit" className="button button-primary" disabled={busy} aria-busy={busy}>
                {busy ? 'Saving…' : 'Save milestone'}
              </button>
            </div>
          </form>
        </div>
      )}

      {deleteTarget && (
        <div className="posho-modal-backdrop" onClick={() => !busy && setDeleteTarget(null)}>
          <div role="dialog" aria-modal="true" aria-label="Remove milestone" className="posho-modal" onClick={(e) => e.stopPropagation()}>
            <div className="posho-modal-heading">
              <h3>Remove milestone</h3>
              <button type="button" onClick={() => setDeleteTarget(null)} aria-label="Close" disabled={busy}><Icon name="close" size={19} /></button>
            </div>
            <p className="posho-modal-description">
              Remove “{deleteTarget.title}”? Linked tasks keep their history but lose the milestone link.
            </p>
            <div className="posho-modal-actions">
              <button type="button" className="button button-secondary" onClick={() => setDeleteTarget(null)} disabled={busy}>Cancel</button>
              <button type="button" className="posho-button-danger" onClick={confirmDelete} disabled={busy} aria-busy={busy}>
                {busy ? 'Removing…' : 'Remove milestone'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
