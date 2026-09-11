import { useMemo, useState } from 'react';


import Icon from '../ui/Icon';
import ConfirmDialog from '../ui/ConfirmDialog';
import { useToast } from '../ui/Toast';
import { useEscapeClose } from '../ui/useEscapeClose';
import {
  adjustLedgerPayment,
  recordManualPayment,
  reverseLedgerPayment,
} from '../../lib/manualPayments';
import { formatKobo, MANUAL_PAYMENT_METHODS, paymentSourceLabel } from '../../lib/money';

function nairaInputToPreview(value) {
  const amount = Number(String(value).replaceAll(',', '').trim());
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.round(amount * 100);
}

export default function ManualPaymentPanel({ order, finance, onChanged }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [reverseTarget, setReverseTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirmRecord, setConfirmRecord] = useState(false);
  const [form, setForm] = useState({
    amount: '',
    method: 'bank_transfer',
    reference: '',
    note: '',
    received: '',
    notify: true,
  });
  const [adjust, setAdjust] = useState({ amount: '', negative: true, reason: '' });

  const outstanding = finance?.outstanding ?? 0;
  const paid = finance?.paid ?? 0;
  const previewKobo = nairaInputToPreview(form.amount);

  useEscapeClose(open && !busy, () => setOpen(false));
  useEscapeClose(adjustOpen && !busy, () => setAdjustOpen(false));

  const manualEntries = useMemo(
    () =>
      (order?.payments || []).filter((entry) =>
        ['manual', 'adjustment', 'reversal'].includes(entry.payment_type),
      ),
    [order?.payments],
  );

  const set = (field, value) =>
    setForm((current) => ({ ...current, [field]: value }));

  const submitRecord = async () => {
    if (!previewKobo) {
      toast.error('Enter a valid payment amount greater than zero.');
      return;
    }

    if (previewKobo > outstanding) {
      toast.error(
        `This exceeds the outstanding balance of ${formatKobo(outstanding)}.`,
      );
      return;
    }

    try {
      setBusy(true);
      await recordManualPayment({
        orderId: order.id,
        amountNaira: form.amount,
        method: form.method,
        reference: form.reference,
        note: form.note,
        receivedAt: form.received ? new Date(`${form.received}T12:00:00`).toISOString() : null,
        notifyCustomer: form.notify,
      });
      toast.success(`Manual payment of ${formatKobo(previewKobo)} recorded.`);
      setOpen(false);
      setConfirmRecord(false);
      setForm({ amount: '', method: 'bank_transfer', reference: '', note: '', received: '', notify: true });
      await onChanged?.();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  const submitAdjust = async () => {
    try {
      setBusy(true);
      await adjustLedgerPayment({
        orderId: order.id,
        amountNaira: adjust.amount,
        negative: adjust.negative,
        reason: adjust.reason,
        notifyCustomer: true,
      });
      toast.success('Financial adjustment recorded with a full audit trail.');
      setAdjustOpen(false);
      setAdjust({ amount: '', negative: true, reason: '' });
      await onChanged?.();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  const submitReverse = async () => {
    if (!reverseTarget) return;

    try {
      setBusy(true);
      await reverseLedgerPayment({
        paymentId: reverseTarget.id,
        reason: reverseTarget.reason,
      });
      toast.success('Payment reversed. The original entry is preserved in history.');
      setReverseTarget(null);
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
          <span>FINANCIAL CONTROL</span>
          <h3>Record payment</h3>
          <p className="admin-card-description">
            Record bank transfers, cash, POS and corrections as immutable ledger
            entries. Provider-verified payments are never edited here.
          </p>
        </div>
        <Icon name="handshake" size={22} />
      </div>

      <div className="finance-balance-strip">
        <span>Outstanding</span>
        <strong>{formatKobo(outstanding)}</strong>
      </div>

      <div className="finance-review-actions">
        <button type="button" className="button button-primary" onClick={() => setOpen(true)}>
          <Icon name="verified" size={17} /> Record manual payment
        </button>
        <button type="button" className="button button-secondary" onClick={() => setAdjustOpen(true)}>
          <Icon name="tune" size={17} /> Adjustment
        </button>
      </div>

      {manualEntries.length > 0 && (
        <div className="posho-ledger" style={{ marginTop: 14 }}>
          {manualEntries.map((entry) => (
            <article key={entry.id} className="posho-ledger-item">
              <header>
                <span className={`posho-source-tag posho-source-${entry.payment_type}`}>
                  {paymentSourceLabel(entry)}
                </span>
                <strong className="amount">{formatKobo(entry.amount_kobo)}</strong>
              </header>
              <p className="posho-long-value">
                {entry.manual_reference ? `Ref: ${entry.manual_reference} · ` : ''}
                {entry.manual_note || entry.reversal_reason || 'No note'}
              </p>
              <p>
                {new Date(entry.created_at).toLocaleString('en-NG')}
                {entry.is_reversed ? ' · Reversed' : ''}
                {entry.balance_after_kobo !== null && entry.balance_after_kobo !== undefined
                  ? ` · Balance after: ${formatKobo(entry.balance_after_kobo)}`
                  : ''}
              </p>
              {entry.payment_type === 'manual' &&
                entry.status === 'successful' &&
                !entry.is_reversed && (
                  <button
                    type="button"
                    className="button button-secondary"
                    onClick={() => setReverseTarget({ id: entry.id, reason: '' })}
                  >
                    <Icon name="restart_alt" size={15} /> Reverse
                  </button>
                )}
            </article>
          ))}
        </div>
      )}

      {open && (
        <div className="posho-modal-backdrop" onClick={() => !busy && setOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Record manual payment"
            className="posho-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="posho-modal-heading">
              <h3>Manual payment</h3>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" disabled={busy}>×</button>
            </div>
            <p className="posho-modal-description">
              {order?.project_title} · Outstanding {formatKobo(outstanding)}
            </p>

            <div className="posho-form-grid">
              <label>
                Amount (NGN)
                <input
                  type="number" min="1" step="0.01" inputMode="decimal"
                  value={form.amount}
                  onChange={(event) => set('amount', event.target.value)}
                  placeholder="e.g. 75000"
                />
              </label>
              <label>
                Method
                <select value={form.method} onChange={(event) => set('method', event.target.value)}>
                  {MANUAL_PAYMENT_METHODS.map((method) => (
                    <option key={method.value} value={method.value}>{method.label}</option>
                  ))}
                </select>
              </label>
              <label>
                Date received
                <input type="date" value={form.received} onChange={(event) => set('received', event.target.value)} />
              </label>
              <label>
                External / bank reference
                <input value={form.reference} maxLength={160} onChange={(event) => set('reference', event.target.value)} placeholder="UBA-XXXXXXX" />
              </label>
              <label>
                Note
                <textarea value={form.note} maxLength={3000} onChange={(event) => set('note', event.target.value)} placeholder="Payment confirmed through business account." />
              </label>
              <label className="finance-checkbox-row">
                <input type="checkbox" checked={form.notify} onChange={(event) => set('notify', event.target.checked)} />
                <span>Notify customer about this payment</span>
              </label>

              {previewKobo && (
                <div className="posho-preview-box" role="status">
                  After recording: Paid {formatKobo(paid + previewKobo)} · Remaining{' '}
                  {formatKobo(Math.max(outstanding - previewKobo, 0))}
                </div>
              )}
            </div>

            <div className="posho-modal-actions">
              <button type="button" className="button button-secondary" onClick={() => setOpen(false)} disabled={busy}>
                Cancel
              </button>
              <button
                type="button"
                className="button button-primary"
                disabled={busy || !previewKobo}
                aria-busy={busy}
                onClick={() => setConfirmRecord(true)}
              >
                {busy ? 'Recording…' : previewKobo ? `Record ${formatKobo(previewKobo)} payment` : 'Record payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {adjustOpen && (
        <div className="posho-modal-backdrop" onClick={() => !busy && setAdjustOpen(false)}>
          <div role="dialog" aria-modal="true" aria-label="Financial adjustment" className="posho-modal" onClick={(event) => event.stopPropagation()}>
            <div className="posho-modal-heading">
              <h3>Financial adjustment</h3>
              <button type="button" onClick={() => setAdjustOpen(false)} aria-label="Close" disabled={busy}>×</button>
            </div>
            <p className="posho-modal-description">
              Corrections use signed adjustments. Original entries are never edited.
            </p>
            <div className="posho-form-grid">
              <label>
                Adjustment amount (NGN)
                <input type="number" min="0.01" step="0.01" value={adjust.amount} onChange={(event) => setAdjust((c) => ({ ...c, amount: event.target.value }))} />
              </label>
              <label>
                Direction
                <select value={adjust.negative ? 'down' : 'up'} onChange={(event) => setAdjust((c) => ({ ...c, negative: event.target.value === 'down' }))}>
                  <option value="down">Reduce confirmed paid</option>
                  <option value="up">Increase confirmed paid</option>
                </select>
              </label>
              <label>
                Reason (audited)
                <textarea value={adjust.reason} onChange={(event) => setAdjust((c) => ({ ...c, reason: event.target.value }))} placeholder="Recorded against wrong project…" />
              </label>
            </div>
            <div className="posho-modal-actions">
              <button type="button" className="button button-secondary" onClick={() => setAdjustOpen(false)} disabled={busy}>Cancel</button>
              <button type="button" className="button button-primary" onClick={submitAdjust} disabled={busy} aria-busy={busy}>
                {busy ? 'Saving…' : 'Record adjustment'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(reverseTarget)}
        title="Reverse this payment"
        description="The original entry stays in history. A reversal entry is created with your reason, and totals recalculate."
        confirmLabel="Reverse payment"
        tone="danger"
        busy={busy}
        busyLabel="Reversing…"
        onClose={() => !busy && setReverseTarget(null)}
        onConfirm={submitReverse}
      />

      <ConfirmDialog
        open={confirmRecord}
        title={`Record ${previewKobo ? formatKobo(previewKobo) : 'payment'}`}
        description={`This creates an immutable ledger entry. Paid becomes ${formatKobo(paid + (previewKobo || 0))}.`}
        confirmLabel="Record payment"
        busy={busy}
        busyLabel="Recording…"
        onClose={() => !busy && setConfirmRecord(false)}
        onConfirm={submitRecord}
      />
    </section>
  );
}
