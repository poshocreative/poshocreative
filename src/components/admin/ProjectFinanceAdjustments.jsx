import {
  useMemo,
  useState,
} from 'react';

import Icon from '../ui/Icon';
import ConfirmDialog from '../ui/ConfirmDialog';
import { useToast } from '../ui/Toast';
import { useEscapeClose } from '../ui/useEscapeClose';
import {
  adjustProjectPrice,
  recordExternalPayment,
} from '../../lib/manualPayments';
import {
  EXTERNAL_PAYMENT_METHODS,
  formatKobo,
  manualMethodLabel,
} from '../../lib/money';

function nairaToKoboPreview(value) {
  const amount = Number(String(value || '').replaceAll(',', '').trim());

  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  return Math.round(amount * 100);
}

function formatDateTime(value) {
  if (!value) {
    return 'Date not recorded';
  }

  return new Date(value).toLocaleString('en-NG');
}

const HISTORY_FILTERS = [
  { key: 'all', label: 'All activity' },
  { key: 'online', label: 'Online payments' },
  { key: 'external', label: 'External payments' },
  { key: 'price', label: 'Price adjustments' },
];

function ledgerKind(entry) {
  if (!entry) {
    return 'manual';
  }

  if (entry.payment_scope === 'external_payment') {
    return 'external';
  }

  if (entry.payment_type === 'provider') {
    return 'online';
  }

  if (entry.payment_type === 'adjustment') {
    return 'correction';
  }

  if (entry.payment_type === 'reversal') {
    return 'correction';
  }

  return 'manual';
}

function ledgerBadge(entry) {
  const kind = ledgerKind(entry);

  if (kind === 'online') {
    return { tone: 'provider', label: 'Online Payment' };
  }

  if (kind === 'external') {
    return {
      tone: 'external',
      label: `External Payment · ${manualMethodLabel(entry.manual_method)}`,
    };
  }

  if (entry.payment_type === 'adjustment') {
    return { tone: 'adjustment', label: 'Adjustment' };
  }

  if (entry.payment_type === 'reversal') {
    return { tone: 'reversal', label: 'Reversal' };
  }

  return {
    tone: 'manual',
    label: `Manual Payment · ${manualMethodLabel(entry.manual_method)}`,
  };
}

function ledgerAmount(entry) {
  if (!entry) {
    return 0;
  }

  if (entry.payment_type === 'adjustment') {
    return Number(entry.amount_kobo || 0);
  }

  if (entry.payment_type === 'reversal') {
    return 0;
  }

  return Number(entry.base_amount_kobo ?? entry.amount_kobo ?? 0);
}

function ledgerNote(entry) {
  if (!entry) {
    return '';
  }

  return (
    entry.manual_note ||
    entry.reversal_reason ||
    entry.customer_message ||
    ''
  );
}

export default function ProjectFinanceAdjustments({
  order,
  finance,
  onChanged,
}) {
  const toast = useToast();

  const [externalOpen, setExternalOpen] = useState(false);
  const [confirmExternal, setConfirmExternal] = useState(false);
  const [priceOpen, setPriceOpen] = useState(false);
  const [confirmPrice, setConfirmPrice] = useState(false);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState('all');

  const [externalForm, setExternalForm] = useState({
    amount: '',
    method: 'bank_transfer',
    reference: '',
    note: '',
    received: '',
    notify: true,
  });

  const [priceForm, setPriceForm] = useState({
    newTotal: '',
    reason: '',
    notify: true,
  });

  const total = finance?.total ?? 0;
  const paid = finance?.paid ?? 0;
  const outstanding = finance?.outstanding ?? 0;
  const originalPrice = finance?.originalPrice ?? total;

  const externalPreview = nairaToKoboPreview(externalForm.amount);
  const pricePreview = nairaToKoboPreview(priceForm.newTotal);
  const priceNote = String(priceForm.reason || '').trim();
  const externalNote = String(externalForm.note || '').trim();

  const canRecordExternal = total > 0 && outstanding > 0;
  const canReducePrice = total > 0 && paid < total;

  useEscapeClose(externalOpen && !busy, () => setExternalOpen(false));
  useEscapeClose(priceOpen && !busy, () => setPriceOpen(false));

  const history = useMemo(() => {
    const payments = (order?.payments || []).map((entry) => ({
      kind: 'ledger',
      ledgerKind: ledgerKind(entry),
      id: `payment-${entry.id}`,
      createdAt: entry.created_at,
      entry,
    }));

    const adjustments = (finance?.priceAdjustments || []).map((adjustment) => ({
      kind: 'price',
      ledgerKind: 'price',
      id: `price-${adjustment.id}`,
      createdAt: adjustment.created_at,
      adjustment,
    }));

    return [...payments, ...adjustments].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
    );
  }, [order?.payments, finance?.priceAdjustments]);

  const counts = useMemo(() => {
    const result = { all: history.length, online: 0, external: 0, price: 0 };

    for (const item of history) {
      if (item.kind === 'price') {
        result.price += 1;
      } else if (item.ledgerKind === 'online') {
        result.online += 1;
      } else if (item.ledgerKind === 'external') {
        result.external += 1;
      }
    }

    return result;
  }, [history]);

  const visibleHistory = useMemo(() => {
    if (filter === 'online') {
      return history.filter(
        (item) => item.kind === 'ledger' && item.ledgerKind === 'online',
      );
    }

    if (filter === 'external') {
      return history.filter(
        (item) => item.kind === 'ledger' && item.ledgerKind === 'external',
      );
    }

    if (filter === 'price') {
      return history.filter((item) => item.kind === 'price');
    }

    return history;
  }, [history, filter]);

  const setExternal = (field, value) =>
    setExternalForm((current) => ({ ...current, [field]: value }));

  const setPrice = (field, value) =>
    setPriceForm((current) => ({ ...current, [field]: value }));

  const externalErrors = () => {
    if (!externalPreview) {
      return 'Enter a valid payment amount greater than zero.';
    }

    if (externalPreview > outstanding) {
      return `This exceeds the outstanding balance of ${formatKobo(outstanding)}.`;
    }

    if (externalNote.length < 10) {
      return 'Record a clear note (at least 10 characters) describing this external payment.';
    }

    return '';
  };

  const priceErrors = () => {
    if (!pricePreview) {
      return 'Enter a valid new project total greater than zero.';
    }

    if (pricePreview >= total) {
      return 'The new total must be lower than the current project total.';
    }

    if (pricePreview < paid) {
      return `The new total cannot be below the confirmed paid amount of ${formatKobo(paid)}.`;
    }

    if (priceNote.length < 10) {
      return 'Provide a clear reason (at least 10 characters) for this price change.';
    }

    return '';
  };

  const submitExternal = async () => {
    const validationError = externalErrors();

    if (validationError) {
      toast.error(validationError);
      return;
    }

    try {
      setBusy(true);

      await recordExternalPayment({
        orderId: order.id,
        amountNaira: externalForm.amount,
        method: externalForm.method,
        reference: externalForm.reference,
        note: externalNote,
        receivedAt: externalForm.received
          ? new Date(`${externalForm.received}T12:00:00`).toISOString()
          : null,
        notifyCustomer: externalForm.notify,
      });

      toast.success(
        `External payment of ${formatKobo(externalPreview)} recorded. Paid is now ${formatKobo(paid + externalPreview)}.`,
      );

      setExternalOpen(false);
      setConfirmExternal(false);
      setExternalForm({
        amount: '',
        method: 'bank_transfer',
        reference: '',
        note: '',
        received: '',
        notify: true,
      });

      await onChanged?.();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  const submitPrice = async () => {
    const validationError = priceErrors();

    if (validationError) {
      toast.error(validationError);
      return;
    }

    try {
      setBusy(true);

      await adjustProjectPrice({
        orderId: order.id,
        newTotalNaira: priceForm.newTotal,
        reason: priceNote,
        notifyCustomer: priceForm.notify,
      });

      toast.success(
        `Project total reduced to ${formatKobo(pricePreview)}. Outstanding is now ${formatKobo(Math.max(pricePreview - paid, 0))}.`,
      );

      setPriceOpen(false);
      setConfirmPrice(false);
      setPriceForm({ newTotal: '', reason: '', notify: true });

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
          <span>FINANCE ADJUSTMENTS</span>
          <h3>External payments and price changes</h3>
          <p className="admin-card-description">
            Record money received outside the website, or reduce the agreed
            project total. Every action writes an immutable ledger entry with
            a full audit trail — totals are never edited by hand.
          </p>
        </div>
        <Icon name="price_change" size={22} />
      </div>

      <div className="posho-finance-grid" style={{ marginTop: 12 }}>
        <div className="posho-finance-card">
          <span>Original price</span>
          <strong>{formatKobo(originalPrice)}</strong>
          <small>Agreed total before any reductions</small>
        </div>

        <div className="posho-finance-card">
          <span>Current project price</span>
          <strong>{formatKobo(total)}</strong>
          <small>Live total the balance is computed from</small>
        </div>

        <div className="posho-finance-card posho-finance-paid">
          <span>Paid to date</span>
          <strong>{formatKobo(paid)}</strong>
          <small>Online and external receipts combined</small>
        </div>

        <div className="posho-finance-card posho-finance-outstanding">
          <span>Outstanding balance</span>
          <strong>{formatKobo(outstanding)}</strong>
          <small>Total remaining on this project</small>
        </div>
      </div>

      <div className="finance-review-actions">
        <button
          type="button"
          className="button button-primary"
          disabled={!canRecordExternal}
          title={
            canRecordExternal
              ? 'Record money received outside the website'
              : 'There is no outstanding balance to record against'
          }
          onClick={() => setExternalOpen(true)}
        >
          <Icon name="account_balance_wallet" size={17} /> Record External Payment
        </button>

        <button
          type="button"
          className="button button-secondary"
          disabled={!canReducePrice}
          title={
            canReducePrice
              ? 'Reduce the agreed project total (owner only)'
              : 'The price cannot be reduced once the project is fully paid'
          }
          onClick={() => setPriceOpen(true)}
        >
          <Icon name="price_change" size={17} /> Reduce Project Price
        </button>
      </div>

      {!canReducePrice && total > 0 && (
        <p className="admin-card-description" style={{ marginTop: 10 }}>
          The project is fully paid, so the total can no longer be reduced.
          Corrections to paid amounts use adjustments and reversals instead.
        </p>
      )}

      <div style={{ marginTop: 18 }}>
        <span className="posho-section-label">Finance history</span>
        <h3 style={{ margin: '4px 0 10px' }}>Online, external and price changes</h3>

        <div className="project-directory-filters" role="tablist" aria-label="Filter finance history">
          {HISTORY_FILTERS.map((item) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={filter === item.key}
              className={filter === item.key ? 'active' : ''}
              onClick={() => setFilter(item.key)}
            >
              {item.label} · {counts[item.key]}
            </button>
          ))}
        </div>

        {visibleHistory.length === 0 ? (
          <p className="admin-card-description">
            {filter === 'all'
              ? 'No financial activity has been recorded for this project yet.'
              : 'Nothing in this category yet.'}
          </p>
        ) : (
          <div className="posho-ledger">
            {visibleHistory.map((item) => {
              if (item.kind === 'price') {
                const adjustment = item.adjustment;
                const reduction =
                  Number(adjustment.previous_total_kobo || 0) -
                  Number(adjustment.new_total_kobo || 0);

                return (
                  <article key={item.id} className="posho-ledger-item">
                    <header>
                      <span className="posho-source-tag posho-source-price">
                        Price Adjustment
                      </span>
                      <strong className="amount">
                        {formatKobo(adjustment.previous_total_kobo)} →{' '}
                        {formatKobo(adjustment.new_total_kobo)}
                      </strong>
                    </header>
                    <p className="posho-long-value">
                      Reduced by {formatKobo(reduction)} · {adjustment.reason || 'No reason recorded'}
                    </p>
                    <p>
                      {formatDateTime(adjustment.created_at)}
                    </p>
                  </article>
                );
              }

              const entry = item.entry;
              const badge = ledgerBadge(entry);
              const note = ledgerNote(entry);

              return (
                <article key={item.id} className="posho-ledger-item">
                  <header>
                    <span className={`posho-source-tag posho-source-${badge.tone}`}>
                      {badge.label}
                    </span>
                    <strong className="amount">{formatKobo(ledgerAmount(entry))}</strong>
                  </header>
                  <p className="posho-long-value">
                    {entry.provider_reference || entry.manual_reference || 'No reference'}
                    {note ? ` · ${note}` : ''}
                    {entry.is_reversed ? ' · Reversed' : ''}
                  </p>
                  <p>
                    {formatDateTime(entry.created_at)}
                    {entry.balance_after_kobo !== null &&
                    entry.balance_after_kobo !== undefined
                      ? ` · Paid after: ${formatKobo(entry.balance_after_kobo)}`
                      : ''}
                  </p>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {externalOpen && (
        <div className="posho-modal-backdrop" onClick={() => !busy && setExternalOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Record external payment"
            className="posho-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="posho-modal-heading">
              <h3>Record external payment</h3>
              <button type="button" onClick={() => setExternalOpen(false)} aria-label="Close" disabled={busy}>×</button>
            </div>
            <p className="posho-modal-description">
              {order?.project_title} · Outstanding {formatKobo(outstanding)} ·
              the project price does not change.
            </p>

            <div className="posho-form-grid">
              <label>
                Amount received (NGN)
                <input
                  type="number" min="1" step="0.01" inputMode="decimal"
                  value={externalForm.amount}
                  onChange={(event) => setExternal('amount', event.target.value)}
                  placeholder="e.g. 30000"
                />
              </label>
              <label>
                Payment method
                <select value={externalForm.method} onChange={(event) => setExternal('method', event.target.value)}>
                  {EXTERNAL_PAYMENT_METHODS.map((method) => (
                    <option key={method.value} value={method.value}>{method.label}</option>
                  ))}
                </select>
              </label>
              <label>
                Date received
                <input type="date" value={externalForm.received} onChange={(event) => setExternal('received', event.target.value)} />
              </label>
              <label>
                Bank / teller reference
                <input
                  value={externalForm.reference} maxLength={160}
                  onChange={(event) => setExternal('reference', event.target.value)}
                  placeholder="UBA-XXXXXXX (optional)"
                />
              </label>
              <label>
                Note (required, audited)
                <textarea
                  value={externalForm.note} maxLength={3000}
                  onChange={(event) => setExternal('note', event.target.value)}
                  placeholder="Client paid by bank transfer into the business account on…"
                />
              </label>
              <label className="finance-checkbox-row">
                <input type="checkbox" checked={externalForm.notify} onChange={(event) => setExternal('notify', event.target.checked)} />
                <span>Notify customer about this payment</span>
              </label>

              {externalPreview && (
                <div className="posho-preview-box" role="status">
                  After recording: Paid {formatKobo(paid + externalPreview)} ·
                  Remaining {formatKobo(Math.max(outstanding - externalPreview, 0))} ·
                  Project total stays {formatKobo(total)}
                </div>
              )}
            </div>

            <div className="posho-modal-actions">
              <button type="button" className="button button-secondary" onClick={() => setExternalOpen(false)} disabled={busy}>
                Cancel
              </button>
              <button
                type="button"
                className="button button-primary"
                disabled={busy || !externalPreview}
                aria-busy={busy}
                onClick={() => setConfirmExternal(true)}
              >
                {externalPreview ? `Record ${formatKobo(externalPreview)} payment` : 'Record payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {priceOpen && (
        <div className="posho-modal-backdrop" onClick={() => !busy && setPriceOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Reduce project price"
            className="posho-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="posho-modal-heading">
              <h3>Reduce project price</h3>
              <button type="button" onClick={() => setPriceOpen(false)} aria-label="Close" disabled={busy}>×</button>
            </div>
            <p className="posho-modal-description">
              Current total {formatKobo(total)} · Paid to date {formatKobo(paid)} ·
              this changes the price, not the payments.
            </p>

            <div className="posho-form-grid">
              <label>
                New project total (NGN)
                <input
                  type="number" min="1" step="0.01" inputMode="decimal"
                  value={priceForm.newTotal}
                  onChange={(event) => setPrice('newTotal', event.target.value)}
                  placeholder={`Below ${formatKobo(total)}, at or above ${formatKobo(paid)}`}
                />
              </label>
              <label>
                Reason (required, audited)
                <textarea
                  value={priceForm.reason} maxLength={2000}
                  onChange={(event) => setPrice('reason', event.target.value)}
                  placeholder="Scope reduced after client review…"
                />
              </label>
              <label className="finance-checkbox-row">
                <input type="checkbox" checked={priceForm.notify} onChange={(event) => setPrice('notify', event.target.checked)} />
                <span>Notify customer about this price change</span>
              </label>

              {pricePreview && (
                <div className="posho-preview-box" role="status">
                  Reduction {formatKobo(Math.max(total - pricePreview, 0))} ·
                  New balance {formatKobo(Math.max(pricePreview - paid, 0))}
                  {pricePreview <= paid ? ' · Project becomes fully paid' : ''}
                </div>
              )}
            </div>

            <div className="posho-modal-actions">
              <button type="button" className="button button-secondary" onClick={() => setPriceOpen(false)} disabled={busy}>
                Cancel
              </button>
              <button
                type="button"
                className="button button-primary"
                disabled={busy || !pricePreview}
                aria-busy={busy}
                onClick={() => setConfirmPrice(true)}
              >
                {pricePreview ? `Set total to ${formatKobo(pricePreview)}` : 'Reduce price'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmExternal}
        title={`Record ${externalPreview ? formatKobo(externalPreview) : 'external payment'}`}
        description={`This creates an immutable external-payment entry. Paid becomes ${formatKobo(paid + (externalPreview || 0))} while the project total stays ${formatKobo(total)}.`}
        confirmLabel="Record payment"
        busy={busy}
        busyLabel="Recording…"
        onClose={() => !busy && setConfirmExternal(false)}
        onConfirm={submitExternal}
      />

      <ConfirmDialog
        open={confirmPrice}
        title={`Reduce total to ${pricePreview ? formatKobo(pricePreview) : 'new total'}`}
        description={`The original price of ${formatKobo(originalPrice)} stays preserved in history. Outstanding becomes ${pricePreview ? formatKobo(Math.max(pricePreview - paid, 0)) : '—'}. This is a price change, not a payment.`}
        confirmLabel="Reduce price"
        busy={busy}
        busyLabel="Saving…"
        onClose={() => !busy && setConfirmPrice(false)}
        onConfirm={submitPrice}
      />
    </section>
  );
}
