import { useState } from 'react';

import { useToast } from '../ui/Toast';
import { usePermissions } from '../../lib/permissions';
import { runOperationsAction } from '../../lib/operations';
import { formatKobo } from '../../lib/money';

export default function BudgetPanel({ order, work, finance, onChanged }) {
  const toast = useToast();
  const { can } = usePermissions();
  const [busy, setBusy] = useState(false);
  const [budget, setBudget] = useState('');

  if (!can('finance.manage')) {
    return null;
  }

  const internalCosts = work?.internalCosts || [];
  const actualCosts = internalCosts.reduce(
    (sum, cost) => sum + Number(cost.amount_kobo || 0),
    0,
  );

  const timeMinutes = (work?.timeEntries || []).reduce(
    (sum, entry) => sum + Number(entry.minutes || 0),
    0,
  );

  const stored =
    Number(
      order?.internal_metadata
        ?.internal_budget_kobo || 0,
    ) || 0;

  const target = stored - actualCosts;
  const collected = finance?.paid ?? 0;
  const contribution = collected - actualCosts;

  const submit = async (event) => {
    event.preventDefault();

    const kobo = Math.round(Number(budget) * 100);

    if (!Number.isFinite(kobo) || kobo < 0) {
      toast.error('Enter a valid budget of zero or more.');
      return;
    }

    try {
      setBusy(true);

      await runOperationsAction({
        action: 'project_budget_save',
        order_id: order.id,
        internal_budget_kobo: kobo,
      });

      toast.success('Internal budget saved. Clients never see this.');
      setBudget('');
      await onChanged?.();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="admin-control-card">
      <span className="posho-section-label">Internal budget · management only</span>
      <h3>Budget vs actual</h3>

      <div className="posho-kv">
        <div>
          <span>Client price</span>
          <strong>{formatKobo(finance?.total ?? 0)}</strong>
        </div>

        <div>
          <span>Expected internal cost</span>
          <strong>{formatKobo(stored)}</strong>
        </div>

        <div>
          <span>Actual external costs</span>
          <strong>{formatKobo(actualCosts)}</strong>
        </div>

        <div>
          <span>Tracked time</span>
          <strong>
            {Math.floor(timeMinutes / 60)}h {timeMinutes % 60}m
          </strong>
        </div>

        <div>
          <span>Target contribution</span>
          <strong>{formatKobo(target)}</strong>
        </div>

        <div>
          <span>Current contribution</span>
          <strong>{formatKobo(contribution)}</strong>
        </div>
      </div>

      <form onSubmit={submit} className="posho-form-grid" style={{ marginTop: 12 }}>
        <label>
          Expected internal cost (NGN)
          <input
            type="number"
            min="0"
            step="0.01"
            value={budget}
            onChange={(event) => setBudget(event.target.value)}
            placeholder={stored ? String(stored / 100) : '350000'}
          />
        </label>

        <button
          type="submit"
          className="button button-secondary"
          disabled={busy}
          aria-busy={busy}
        >
          {busy ? 'Saving…' : 'Set internal budget'}
        </button>
      </form>
    </section>
  );
}
