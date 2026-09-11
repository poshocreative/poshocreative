import { useState } from 'react';

import { useToast } from '../ui/Toast';
import { runOperationsAction } from '../../lib/operations';

const FIELDS = [
  { key: 'went_well', label: 'What went well?' },
  { key: 'delays', label: 'What caused delay?' },
  { key: 'scope_accuracy', label: 'Was scope accurate?' },
  { key: 'pricing_accuracy', label: 'Was pricing accurate?' },
  { key: 'revision_issues', label: 'Revision issues?' },
  { key: 'learnings', label: 'What should change next time?' },
];

export default function PostmortemPanel({ order, work, onChanged }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(null);

  const existing = work?.postmortem || null;
  const draft = form || {
    went_well: existing?.went_well || '',
    delays: existing?.delays || '',
    scope_accuracy: existing?.scope_accuracy || '',
    pricing_accuracy: existing?.pricing_accuracy || '',
    revision_issues: existing?.revision_issues || '',
    learnings: existing?.learnings || '',
  };

  const set = (field, value) =>
    setForm((current) => ({
      ...(current || {
        went_well: existing?.went_well || '',
        delays: existing?.delays || '',
        scope_accuracy: existing?.scope_accuracy || '',
        pricing_accuracy: existing?.pricing_accuracy || '',
        revision_issues: existing?.revision_issues || '',
        learnings: existing?.learnings || '',
      }),
      [field]: value,
    }));

  const submit = async (event) => {
    event.preventDefault();

    try {
      setBusy(true);

      await runOperationsAction({
        action: 'postmortem_save',
        order_id: order.id,
        went_well: draft.went_well.trim(),
        delays: draft.delays.trim(),
        scope_accuracy: draft.scope_accuracy.trim(),
        pricing_accuracy: draft.pricing_accuracy.trim(),
        revision_issues: draft.revision_issues.trim(),
        learnings: draft.learnings.trim(),
      });

      toast.success('Private postmortem saved. It stays internal.');
      setForm(null);
      await onChanged?.();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="admin-control-card">
      <span className="posho-section-label">Private learning · management only</span>
      <h3>Project postmortem</h3>

      <p className="admin-card-description">
        Honest notes for better templates and pricing next time. Never shown
        to clients.
      </p>

      <form onSubmit={submit} className="posho-form-grid">
        {FIELDS.map((field) => (
          <label key={field.key}>
            <span>{field.label}</span>

            <textarea
              value={draft[field.key]}
              onChange={(event) => set(field.key, event.target.value)}
              maxLength={5000}
              rows={2}
            />
          </label>
        ))}

        <button
          type="submit"
          className="button button-secondary"
          disabled={busy}
          aria-busy={busy}
        >
          {busy ? 'Saving…' : existing ? 'Update postmortem' : 'Save postmortem'}
        </button>
      </form>
    </section>
  );
}
