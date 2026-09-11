import { formatKobo } from '../../lib/money';

/**
 * Financial summary with deliberate hierarchy:
 * Amount Due Now carries the strongest action emphasis.
 */
export default function FinanceCards({
  baseKobo = 0,
  additionalKobo = 0,
  totalKobo = 0,
  paidKobo = 0,
  outstandingKobo = 0,
  dueNowKobo = null,
  dueLabel = 'Amount due now',
  action = null,
}) {
  const due = dueNowKobo === null || dueNowKobo === undefined
    ? outstandingKobo
    : dueNowKobo;

  return (
    <div className="posho-finance-grid">
      <div className="posho-finance-card">
        <span>Project value</span>
        <strong>{formatKobo(totalKobo)}</strong>
        <small>
          Base {formatKobo(baseKobo)}
          {additionalKobo > 0 ? ` · Additional ${formatKobo(additionalKobo)}` : ''}
        </small>
      </div>

      <div className="posho-finance-card posho-finance-paid">
        <span>Confirmed paid</span>
        <strong>{formatKobo(paidKobo)}</strong>
        <small>Provider verified and manually recorded payments</small>
      </div>

      <div className="posho-finance-card posho-finance-outstanding">
        <span>Outstanding balance</span>
        <strong>{formatKobo(outstandingKobo)}</strong>
        <small>Total remaining on this project</small>
      </div>

      <div className="posho-finance-card posho-finance-due">
        <span>{dueLabel}</span>
        <strong>{formatKobo(due)}</strong>
        {action && <div className="posho-finance-due-action">{action}</div>}
      </div>
    </div>
  );
}
