import { useState } from 'react';


import Icon from '../ui/Icon';
import { useToast } from '../ui/Toast';
import { usePermissions } from '../../lib/permissions';
import { EmptyState, ErrorBlock } from '../ui/StateBlocks';
import ConfirmDialog from '../ui/ConfirmDialog';
import { useEscapeClose } from '../ui/useEscapeClose';
import { formatKobo } from '../../lib/money';
import { deleteInternalCost, recordInternalCost } from '../../lib/projectWork';

const CATEGORIES = ['software', 'freelancer', 'hosting', 'domain', 'stock_asset', 'advertising', 'contractor', 'miscellaneous'];

function formatDate(value) {
  if (!value) return 'Not set';
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function InternalCostsPanel({ order, work, finance, onChanged }) {
  const toast = useToast();
  const { can } = usePermissions();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState(null);
  const [form, setForm] = useState({ title: '', category: 'miscellaneous', amount: '', incurredAt: '', note: '' });

  useEscapeClose(open && !busy, () => setOpen(false));

  if (!can('finance.manage')) {
    return (
      <section className="admin-control-card">
        <span className="posho-section-label">Profitability</span>
        <h3>Internal costs</h3>
        <p className="admin-card-description">
          Margin details are restricted to Finance and Owner roles.
        </p>
      </section>
    );
  }

  const costs = work?.internalCosts || [];
  const loadError = work?.loadErrors?.internalCosts;
  const totalCosts = costs.reduce((sum, cost) => sum + Number(cost.amount_kobo || 0), 0);
  const contribution = (finance?.total ?? 0) - totalCosts;

  const set = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const submit = async (event) => {
    event.preventDefault();

    if (!form.title.trim()) {
      toast.error('Describe the internal cost.');
      return;
    }

    const amountKobo = Math.round(Number(String(form.amount).replaceAll(',', '')) * 100);

    if (!Number.isFinite(amountKobo) || amountKobo <= 0) {
      toast.error('Enter a valid cost amount greater than zero.');
      return;
    }

    try {
      setBusy(true);
      await recordInternalCost({
        orderId: order.id,
        cost: {
          title: form.title.trim(),
          category: form.category,
          amountKobo,
          incurredAt: form.incurredAt || null,
          note: form.note.trim(),
        },
      });
      toast.success('Internal cost recorded. It stays management-only.');
      setOpen(false);
      setForm({ title: '', category: 'miscellaneous', amount: '', incurredAt: '', note: '' });
      await onChanged?.();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  const confirmRemove = async () => {
    if (!removing) return;

    try {
      setBusy(true);
      await deleteInternalCost({ orderId: order.id, costId: removing.id });
      toast.success('Internal cost removed.');
      setRemoving(null);
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
          <span>PROFITABILITY</span>
          <h3>Internal costs</h3>
          <p className="admin-card-description">
            Delivery costs for margin tracking. Never shown to clients.
          </p>
        </div>
        <button type="button" className="button button-secondary" onClick={() => setOpen(true)}>
          <Icon name="add_circle" size={17} /> Record cost
        </button>
      </div>

      <div className="posho-kv">
        <div><span>Project value</span><strong>{formatKobo(finance?.total ?? 0)}</strong></div>
        <div><span>Internal costs</span><strong>{formatKobo(totalCosts)}</strong></div>
        <div><span>Gross contribution</span><strong>{formatKobo(contribution)}</strong></div>
      </div>

      {loadError ? (
        <ErrorBlock message={`Internal costs could not be loaded. ${loadError}`} onRetry={onChanged} />
      ) : costs.length === 0 ? (
        <EmptyState title="No internal costs recorded" body="Track software, freelancers, hosting and other delivery costs here." />
      ) : (
        <div className="posho-ledger" style={{ marginTop: 10 }}>
          {costs.map((cost) => (
            <article key={cost.id} className="posho-ledger-item">
              <header>
                <strong className="posho-long-value">{cost.title}</strong>
                <strong>{formatKobo(cost.amount_kobo)}</strong>
              </header>
              <p>{String(cost.category || 'miscellaneous').replaceAll('_', ' ')} · {formatDate(cost.incurred_at)}</p>
              {cost.note && <p>{cost.note}</p>}
              <div className="finance-review-actions">
                <button type="button" className="button button-secondary" onClick={() => setRemoving(cost)}>
                  <Icon name="delete" size={15} /> Remove
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {open && (
        <div className="posho-modal-backdrop" onClick={() => !busy && setOpen(false)}>
          <form role="dialog" aria-modal="true" aria-label="Record internal cost" className="posho-modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
            <div className="posho-modal-heading">
              <h3>Record internal cost</h3>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" disabled={busy}><Icon name="close" size={19} /></button>
            </div>
            <div className="posho-form-grid">
              <label>
                Description
                <input value={form.title} maxLength={160} onChange={(e) => set('title', e.target.value)} placeholder="Freelance illustrator" required />
              </label>
              <label>
                Category
                <select value={form.category} onChange={(e) => set('category', e.target.value)}>
                  {CATEGORIES.map((category) => (
                    <option key={category} value={category}>{category.replaceAll('_', ' ')}</option>
                  ))}
                </select>
              </label>
              <label>
                Amount (NGN)
                <input type="number" min="1" step="0.01" value={form.amount} onChange={(e) => set('amount', e.target.value)} placeholder="45000" required />
              </label>
              <label>
                Date incurred
                <input type="date" value={form.incurredAt} onChange={(e) => set('incurredAt', e.target.value)} />
              </label>
              <label>
                Note
                <textarea value={form.note} maxLength={2000} onChange={(e) => set('note', e.target.value)} placeholder="Internal reference." />
              </label>
            </div>
            <div className="posho-modal-actions">
              <button type="button" className="button button-secondary" onClick={() => setOpen(false)} disabled={busy}>Cancel</button>
              <button type="submit" className="button button-primary" disabled={busy} aria-busy={busy}>
                {busy ? 'Saving…' : 'Record cost'}
              </button>
            </div>
          </form>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(removing)}
        title="Remove internal cost"
        description={`Remove “${removing?.title}” from margin tracking?`}
        confirmLabel="Remove"
        busy={busy}
        busyLabel="Removing…"
        onClose={() => !busy && setRemoving(null)}
        onConfirm={confirmRemove}
      />
    </section>
  );
}
