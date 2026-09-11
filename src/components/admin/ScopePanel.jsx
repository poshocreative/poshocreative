import { useEffect, useState } from 'react';

import { useToast } from '../ui/Toast';
import { ErrorBlock } from '../ui/StateBlocks';
import { saveProjectScope } from '../../lib/projectWork';

const FIELDS = [
  { key: 'summary', label: 'Summary', placeholder: 'What Posho Creative will deliver, in one paragraph.' },
  { key: 'deliverablesSummary', label: 'Deliverables', placeholder: '5-page website, logo suite, launch checklist…' },
  { key: 'includedRevisions', label: 'Included revisions', placeholder: 'Two structured revision rounds per deliverable.' },
  { key: 'features', label: 'Features', placeholder: 'Contact form, WhatsApp button, blog…' },
  { key: 'pages', label: 'Pages', placeholder: 'Home, About, Services, Contact…' },
  { key: 'platforms', label: 'Platforms', placeholder: 'Web, Instagram, print…' },
  { key: 'dependencies', label: 'Dependencies', placeholder: 'Client logo and copy due before design starts.' },
  { key: 'exclusions', label: 'Exclusions', placeholder: 'Ecommerce, copywriting and photography are out of scope.' },
  { key: 'clientResponsibilities', label: 'Customer responsibilities', placeholder: 'Provide content, approve designs within 3 days…' },
];

const API_KEYS = {
  summary: 'summary',
  deliverablesSummary: 'deliverablesSummary',
  includedRevisions: 'includedRevisions',
  features: 'features',
  pages: 'pages',
  platforms: 'platforms',
  dependencies: 'dependencies',
  exclusions: 'exclusions',
  clientResponsibilities: 'clientResponsibilities',
};

export default function ScopePanel({ order, work, onChanged }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(null);

  useEffect(() => {
    const scope = work?.scope;

    if (!scope) {
      setForm(null);
      return;
    }

    setForm({
      summary: scope.summary || '',
      deliverablesSummary: scope.deliverables_summary || '',
      includedRevisions: scope.included_revisions || '',
      features: scope.features || '',
      pages: scope.pages || '',
      platforms: scope.platforms || '',
      dependencies: scope.dependencies || '',
      exclusions: scope.exclusions || '',
      clientResponsibilities: scope.client_responsibilities || '',
      visibleToClient: scope.visible_to_client !== false,
    });
  }, [work?.scope]);

  if (work?.loadErrors?.scope) {
    return (
      <section className="admin-control-card">
        <span className="posho-section-label">Agreed scope</span>
        <h3>Scope baseline</h3>
        <ErrorBlock message={`Scope could not be loaded. ${work.loadErrors.scope}`} onRetry={onChanged} />
      </section>
    );
  }

  if (form === null) {
    return (
      <section className="admin-control-card">
        <span className="posho-section-label">Agreed scope</span>
        <h3>Scope baseline</h3>
        <p className="admin-card-description">
          Document what was promised. This baseline is what change requests
          are evaluated against — and it stays recoverable years later.
        </p>
        <button
          type="button"
          className="button button-secondary"
          onClick={() => setForm({
            summary: '', deliverablesSummary: '', includedRevisions: '', features: '',
            pages: '', platforms: '', dependencies: '', exclusions: '',
            clientResponsibilities: '', visibleToClient: true,
          })}
        >
          Document scope
        </button>
      </section>
    );
  }

  const set = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const submit = async (event) => {
    event.preventDefault();

    const payload = {};

    for (const field of FIELDS) {
      payload[API_KEYS[field.key]] = form[field.key].trim() || null;
    }

    payload.visibleToClient = form.visibleToClient;

    try {
      setBusy(true);
      await saveProjectScope({ orderId: order.id, scope: payload });
      toast.success('Scope baseline saved.');
      await onChanged?.();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="admin-control-card">
      <span className="posho-section-label">Agreed scope</span>
      <h3>Scope baseline</h3>
      <form onSubmit={submit} className="posho-form-grid">
        {FIELDS.map((field) => (
          <label key={field.key}>
            {field.label}
            <textarea
              value={form[field.key]}
              onChange={(e) => set(field.key, e.target.value)}
              placeholder={field.placeholder}
            />
          </label>
        ))}
        <label className="finance-checkbox-row">
          <input
            type="checkbox"
            checked={form.visibleToClient}
            onChange={(e) => set('visibleToClient', e.target.checked)}
          />
          <span>Visible to client (internal estimates stay hidden regardless)</span>
        </label>
        <button type="submit" className="button button-primary" disabled={busy} aria-busy={busy}>
          {busy ? 'Saving…' : 'Save scope baseline'}
        </button>
      </form>
    </section>
  );
}
