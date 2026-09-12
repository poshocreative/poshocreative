/**
 * Canonical money helpers — single source of truth for Naira/Kobo math.
 *
 * Rule: amounts are stored and transported in KOBO (integers).
 * Only format to Naira at the display boundary via formatKobo().
 */

export function toKobo(nairaValue) {
  const amount = Number(nairaValue);

  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  return Math.round(amount * 100);
}

export function koboToNaira(kobo) {
  const amount = Number(kobo);

  if (!Number.isFinite(amount)) {
    return 0;
  }

  return amount / 100;
}

const nairaFormatter = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  maximumFractionDigits: 0,
});

export function formatKobo(kobo) {
  const amount = Number(kobo);

  if (!Number.isFinite(amount)) {
    return '₦0';
  }

  return nairaFormatter.format(amount / 100);
}

/** Backwards-compatible alias used across older modules. */
export const formatMoney = formatKobo;

export function parseNairaInput(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const amount = Number(String(value).replaceAll(',', '').trim());

  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  return Math.round(amount * 100);
}

export function safeKobo(value, fallback = 0) {
  const amount = Number(value);

  if (!Number.isFinite(amount) || amount < 0) {
    return fallback;
  }

  return Math.round(amount);
}

/**
 * Canonical project finance derivation.
 * total = base + active additional costs
 * outstanding = max(total - paid, 0)
 */
export function deriveProjectFinance({
  baseKobo = 0,
  additionalKobo = 0,
  paidKobo = 0,
} = {}) {
  const base = safeKobo(baseKobo);
  const additional = safeKobo(additionalKobo);
  const total = base + additional;
  const paid = safeKobo(paidKobo);
  const outstanding = Math.max(total - paid, 0);

  return { base, additional, total, paid, outstanding };
}

/**
 * Amount due now: approved unexpired installment wins, else full outstanding.
 */
export function getAmountDueNow({ outstandingKobo = 0, approvedRequest = null } = {}) {
  const outstanding = safeKobo(outstandingKobo);

  if (
    approvedRequest &&
    approvedRequest.status === 'approved' &&
    Number(approvedRequest.approved_amount_kobo) > 0 &&
    (!approvedRequest.approval_expires_at ||
      new Date(approvedRequest.approval_expires_at) > new Date())
  ) {
    return Math.min(Number(approvedRequest.approved_amount_kobo), outstanding);
  }

  return outstanding;
}

/** Ledger credit for a provider transaction (fees never credited). */
export function providerLedgerCredit(transaction) {
  if (!transaction) {
    return 0;
  }

  const base = Number(
    transaction.base_amount_kobo ?? transaction.amount_kobo ?? 0,
  );

  return Number.isFinite(base) && base > 0 ? Math.round(base) : 0;
}

/** Whether a ledger row counts toward confirmed paid. */
export function isConfirmedLedgerEntry(entry) {
  if (!entry || entry.status !== 'successful') {
    return false;
  }

  if (entry.is_reversed === true) {
    return false;
  }

  return true;
}

export function sumConfirmedPaid(entries = []) {
  return (entries || [])
    .filter(isConfirmedLedgerEntry)
    .reduce((sum, entry) => {
      if (entry.payment_type === 'reversal') {
        return sum;
      }

      if (entry.payment_type === 'adjustment') {
        return sum + Number(entry.amount_kobo || 0);
      }

      return sum + providerLedgerCredit(entry);
    }, 0);
}

export const MANUAL_PAYMENT_METHODS = [
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'cash', label: 'Cash' },
  { value: 'pos', label: 'POS' },
  { value: 'external_transfer', label: 'External transfer' },
  { value: 'correction', label: 'Correction' },
  { value: 'other', label: 'Other' },
];

/** Methods allowed for off-platform receipts (corrections use adjustments). */
export const EXTERNAL_PAYMENT_METHODS = [
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'cash', label: 'Cash' },
  { value: 'pos', label: 'POS' },
  { value: 'external_transfer', label: 'External transfer' },
  { value: 'other', label: 'Other' },
];

export function manualMethodLabel(value) {
  return (
    MANUAL_PAYMENT_METHODS.find((method) => method.value === value)?.label ||
    'Manual payment'
  );
}

export function paymentSourceLabel(entry) {
  if (!entry) {
    return 'Payment';
  }

  if (entry.payment_scope === 'external_payment') {
    return `External Payment · ${manualMethodLabel(entry.manual_method)}`;
  }

  if (entry.payment_type === 'manual') {
    return `Manually recorded · ${manualMethodLabel(entry.manual_method)}`;
  }

  if (entry.payment_type === 'adjustment') {
    return 'Adjustment';
  }

  if (entry.payment_type === 'reversal') {
    return 'Reversal';
  }

  return 'Provider verified';
}
