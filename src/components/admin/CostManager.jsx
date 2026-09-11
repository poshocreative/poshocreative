import { useState } from 'react';

import { PlusCircle } from 'lucide-react';

import { useToast } from '../ui/Toast';
import { EmptyState } from '../ui/StateBlocks';
import { useEscapeClose } from '../ui/useEscapeClose';
import { runAdminOrderAction } from '../../lib/admin';
import { formatKobo } from '../../lib/money';
import { waiveProjectCost } from '../../lib/projectLifecycle';

export default function CostManager({ order, finance, onChanged }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [waiveTarget, setWaiveTarget] = useState(null);
  const [waiveReason, setWaiveReason] = useState('');
  const [form, setForm] = useState({ title: '', amount: '', description: '', due: '' });

  useEscapeClose(open && !busy, () => setOpen(false));
  useEscapeClose(Boolean(waiveTarget) && !busy, () => setWaiveTarget(null));

  const costs = order?.costs || [];
  const active = costs.filter((cost) => cost.status === 'active');
  const waived = costs.filter((cost) => cost.status === 'waived');

  const submit = async (event) => {
    event.preventDefault();

    const amountKobo = Math.round(Number(String(form.amount).replaceAll(',', '')) * 100);

    if (!form.title.trim()) {
      toast.error('Give the additional cost a clear title.');
      return;
    }

    if (!Number.isFinite(amountKobo) || amountKobo <= 0) {
      toast.error('Enter a valid cost amount greater than zero.');
      return;
    }

    try {
      setBusy(true);
      await runAdminOrderAction({
        action: 'add_project_cost',
        orderId: order.id,
        title: form.title.trim(),
        amountKobo,
        description: form.description.trim() || null,
        dueAt: form.due ? new Date(`${form.due}T12:00:00`).toISOString() : null,
      });
      toast.success(
        `Additional cost added. Project value increased by ${formatKobo(amountKobo)}.`,
      );
      setOpen(false);
      setForm({ title: '', amount: '', description: '', due: '' });
      await onChanged?.();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  const submitWaive = async () => {
    if (!waiveTarget) return;

    try {
      setBusy(true);
      await waiveProjectCost({
        orderId: order.id,
        costId: waiveTarget.id,
        reason: waiveReason,
      });
      toast.success('Additional cost waived. Totals recalculated responsibly.');
      setWaiveTarget(null);
      setWaiveReason('');
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
          <span>ADDITIONAL COSTS</span>
          <h3>Project costs</h3>
          <p className="admin-card-description">
            Legitimate later costs increase the total project value. The base
            price is never overwritten.
          </p>
        </div>
        <button type="button" className="button button-secondary" onClick={() => setOpen(true)}>
          <PlusCircle size={17} /> Add cost
        </button>
      </div>

      {active.length === 0 ? (
        <EmptyState title="No additional costs" body="Extra pages, features, revisions and expedited delivery appear here." />
      ) : (
        <div className="posho-ledger">
          {active.map((cost) => (
            <article key={cost.id} className="posho-ledger-item">
              <header>
                <strong>{cost.title}</strong>
                <strong className="amount">{formatKobo(cost.amount_kobo)}</strong>
              </header>
              {cost.description && <p>{cost.description}</p>}
              <p>
                Added {new Date(cost.created_at).toLocaleDateString('en-NG')}
                {cost.due_at ? ` · Due ${new Date(cost.due_at).toLocaleDateString('en-NG')}` : ''}
              </p>
              <button
                type="button"
                className="button button-secondary"
                onClick={() => setWaiveTarget(cost)}
              >
                Waive cost
              </button>
            </article>
          ))}
        </div>
      )}

      {waived.length > 0 && (
        <details style={{ marginTop: 12 }}>
          <summary>Waived costs ({waived.length}) — preserved for audit</summary>
          <div className="posho-ledger" style={{ marginTop: 10 }}>
            {waived.map((cost) => (
              <article key={cost.id} className="posho-ledger-item">
                <header>
                  <span className="posho-source-tag posho-source-reversal">Waived</span>
                  <strong className="amount">{formatKobo(cost.amount_kobo)}</strong>
                </header>
                <p><strong>{cost.title}</strong></p>
                {(cost.waive_reason || cost.waiver_reason) && <p>Reason: {cost.waive_reason || cost.waiver_reason}</p>}
              </article>
            ))}
          </div>
        </details>
      )}

      {open && (
        <div className="posho-modal-backdrop" onClick={() => !busy && setOpen(false)}>
          <form
            role="dialog" aria-modal="true" aria-label="Add additional cost"
            className="posho-modal" onClick={(event) => event.stopPropagation()}
            onSubmit={submit}
          >
            <div className="posho-modal-heading">
              <h3>Add additional cost</h3>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" disabled={busy}>×</button>
            </div>
            <div className="posho-form-grid">
              <label>
                Title
                <input value={form.title} maxLength={160} onChange={(e) => setForm((c) => ({ ...c, title: e.target.value }))} placeholder="Additional page" required />
              </label>
              <label>
                Amount (NGN)
                <input type="number" min="1" step="0.01" value={form.amount} onChange={(e) => setForm((c) => ({ ...c, amount: e.target.value }))} placeholder="20000" required />
              </label>
              <label>
                Due date
                <input type="date" value={form.due} onChange={(e) => setForm((c) => ({ ...c, due: e.target.value }))} />
              </label>
              <label>
                Customer-facing reason
                <textarea value={form.description} maxLength={3000} onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))} placeholder="Why this cost exists and what it covers." />
              </label>
              <div className="posho-preview-box">
                Total becomes {formatKobo((finance?.total ?? 0) + (Math.round(Number(form.amount || 0) * 100) || 0))}
              </div>
            </div>
            <div className="posho-modal-actions">
              <button type="button" className="button button-secondary" onClick={() => setOpen(false)} disabled={busy}>Cancel</button>
              <button type="submit" className="button button-primary" disabled={busy} aria-busy={busy}>
                {busy ? 'Adding…' : 'Add cost'}
              </button>
            </div>
          </form>
        </div>
      )}

      {waiveTarget && (
        <div className="posho-modal-backdrop" onClick={() => !busy && setWaiveTarget(null)}>
          <div role="dialog" aria-modal="true" aria-label="Waive cost" className="posho-modal" onClick={(event) => event.stopPropagation()}>
            <div className="posho-modal-heading">
              <h3>Waive “{waiveTarget.title}”</h3>
              <button type="button" onClick={() => setWaiveTarget(null)} aria-label="Close" disabled={busy}>×</button>
            </div>
            <p className="posho-modal-description">
              The cost stays in history with a Waived status. The total recalculates
              and must not fall below confirmed payments.
            </p>
            <div className="posho-form-grid">
              <label>
                Reason (audited)
                <textarea value={waiveReason} onChange={(e) => setWaiveReason(e.target.value)} placeholder="Client goodwill…" />
              </label>
            </div>
            <div className="posho-modal-actions">
              <button type="button" className="button button-secondary" onClick={() => setWaiveTarget(null)} disabled={busy}>Cancel</button>
              <button type="button" className="posho-button-danger" onClick={submitWaive} disabled={busy || waiveReason.trim().length < 5} aria-busy={busy}>
                {busy ? 'Waiving…' : 'Waive cost'}
              </button>
            </div>
          </div>
        </div>
      )}

    </section>
  );
}
