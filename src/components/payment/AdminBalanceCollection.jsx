import {
  useMemo,
  useState,
} from 'react';

import {
  BadgePlus,
  CalendarClock,
  CircleDollarSign,
  Send,
} from 'lucide-react';

import {
  runAdminOrderAction,
} from '../../lib/admin';

import {
  formatMoney,
} from '../../lib/orders';

function toIsoDate(value) {
  return value
    ? new Date(`${value}T23:59:59`).toISOString()
    : null;
}

export default function AdminBalanceCollection({
  orderId,
  projectValueKobo,
  paidKobo,
  outstandingKobo,
  costs = [],
  onUpdated,
}) {
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [cost, setCost] = useState({
    title: '',
    amount: '',
    description: '',
    dueAt: '',
  });
  const [balanceRequest, setBalanceRequest] = useState({
    note: '',
    dueAt: '',
  });

  const activeCosts = useMemo(
    () => costs.filter((item) => item.status === 'active'),
    [costs],
  );

  const additionalTotal = useMemo(
    () => activeCosts.reduce(
      (total, item) => total + Number(item.amount_kobo || 0),
      0,
    ),
    [activeCosts],
  );

  const addCost = async (event) => {
    event.preventDefault();

    const amountKobo = Math.round(Number(cost.amount) * 100);
    if (cost.title.trim().length < 3) {
      setError('Give the additional cost a clear title.');
      return;
    }
    if (!Number.isFinite(amountKobo) || amountKobo <= 0) {
      setError('Enter a valid additional cost.');
      return;
    }

    try {
      setBusy('cost');
      setError('');
      setSuccess('');

      await runAdminOrderAction({
        action: 'add_project_cost',
        orderId,
        title: cost.title.trim(),
        amountKobo,
        description: cost.description.trim(),
        dueAt: toIsoDate(cost.dueAt),
      });

      setCost({
        title: '',
        amount: '',
        description: '',
        dueAt: '',
      });
      setSuccess('The additional cost is now visible and payable by the customer.');
      await onUpdated?.();
    } catch (actionError) {
      setError(actionError.message);
    } finally {
      setBusy('');
    }
  };

  const requestBalance = async (event) => {
    event.preventDefault();

    try {
      setBusy('balance');
      setError('');
      setSuccess('');

      await runAdminOrderAction({
        action: 'request_remaining_payment',
        orderId,
        note: balanceRequest.note.trim(),
        dueAt: toIsoDate(balanceRequest.dueAt),
      });

      setBalanceRequest({
        note: '',
        dueAt: '',
      });
      setSuccess('The customer has been asked to pay the current remaining balance.');
      await onUpdated?.();
    } catch (actionError) {
      setError(actionError.message);
    } finally {
      setBusy('');
    }
  };

  return (
    <section className="admin-control-card admin-balance-collection">
      <div className="finance-request-heading">
        <div>
          <span>NEXT PAYMENT</span>
          <h2>Collect the project balance</h2>
          <p className="admin-card-description">
            The first installment is confirmed. Request the remaining balance,
            or add an approved extra cost before asking the customer to pay.
          </p>
        </div>
        <CircleDollarSign size={23} />
      </div>

      <div className="finance-collection-summary">
        <div>
          <span>Project value</span>
          <strong>{formatMoney(projectValueKobo)}</strong>
        </div>
        <div>
          <span>Confirmed paid</span>
          <strong>{formatMoney(paidKobo)}</strong>
        </div>
        <div className="is-balance">
          <span>Current balance</span>
          <strong>{formatMoney(outstandingKobo)}</strong>
        </div>
        <div>
          <span>Extra costs</span>
          <strong>{formatMoney(additionalTotal)}</strong>
        </div>
      </div>

      <div className="finance-collection-grid">
        <form onSubmit={requestBalance} className="finance-collection-panel">
          <div className="finance-collection-panel-heading">
            <Send size={18} />
            <div>
              <strong>Request remaining payment</strong>
              <span>Send the current balance to the customer.</span>
            </div>
          </div>

          <label>
            <span>Payment due date</span>
            <input
              type="date"
              value={balanceRequest.dueAt}
              onChange={(event) => setBalanceRequest((current) => ({
                ...current,
                dueAt: event.target.value,
              }))}
            />
          </label>

          <label>
            <span>Customer note</span>
            <textarea
              value={balanceRequest.note}
              maxLength="3000"
              onChange={(event) => setBalanceRequest((current) => ({
                ...current,
                note: event.target.value,
              }))}
              placeholder="Explain what this balance covers and when it is needed."
            />
          </label>

          <button type="submit" className="button button-primary" disabled={Boolean(busy)}>
            <CalendarClock size={16} />
            {busy === 'balance' ? 'Sending request...' : 'Request current balance'}
          </button>
        </form>

        <form onSubmit={addCost} className="finance-collection-panel">
          <div className="finance-collection-panel-heading">
            <BadgePlus size={18} />
            <div>
              <strong>Add an extra project cost</strong>
              <span>The amount is added to the project total.</span>
            </div>
          </div>

          <div className="finance-collection-fields">
            <label>
              <span>Cost title</span>
              <input
                type="text"
                maxLength="160"
                required
                value={cost.title}
                onChange={(event) => setCost((current) => ({
                  ...current,
                  title: event.target.value,
                }))}
                placeholder="e.g. Additional design revision"
              />
            </label>
            <label>
              <span>Amount in Naira</span>
              <input
                type="number"
                min="1"
                step="0.01"
                required
                value={cost.amount}
                onChange={(event) => setCost((current) => ({
                  ...current,
                  amount: event.target.value,
                }))}
                placeholder="25000"
              />
            </label>
          </div>

          <label>
            <span>Description</span>
            <textarea
              value={cost.description}
              maxLength="3000"
              onChange={(event) => setCost((current) => ({
                ...current,
                description: event.target.value,
              }))}
              placeholder="Explain why this additional cost is required."
            />
          </label>

          <label>
            <span>Payment due date</span>
            <input
              type="date"
              value={cost.dueAt}
              onChange={(event) => setCost((current) => ({
                ...current,
                dueAt: event.target.value,
              }))}
            />
          </label>

          <button type="submit" className="button button-primary" disabled={Boolean(busy)}>
            <BadgePlus size={16} />
            {busy === 'cost' ? 'Adding cost...' : 'Add cost and notify customer'}
          </button>
        </form>
      </div>

      {activeCosts.length > 0 && (
        <div className="finance-cost-history">
          <strong>Active additional costs</strong>
          {activeCosts.map((item) => (
            <div key={item.id}>
              <span>{item.title}</span>
              <strong>{formatMoney(item.amount_kobo)}</strong>
            </div>
          ))}
        </div>
      )}

      {success && <div className="finance-success-message">{success}</div>}
      {error && <div className="finance-error-message">{error}</div>}
    </section>
  );
}
