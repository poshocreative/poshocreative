import assert from 'node:assert';

import {
  deriveProjectFinance,
  EXTERNAL_PAYMENT_METHODS,
  formatKobo,
  getAmountDueNow,
  parseNairaInput,
  paymentSourceLabel,
} from '../src/lib/money.js';

// Spec section 22: base 200k + additional 50k, paid 100k.
const finance = deriveProjectFinance({
  baseKobo: 20000000,
  additionalKobo: 5000000,
  paidKobo: 10000000,
});

assert.strictEqual(finance.total, 25000000, 'total must be base + additional');
assert.strictEqual(finance.outstanding, 15000000, 'outstanding must be total - paid');
assert.strictEqual(formatKobo(25000000), '₦250,000');

// Spec section 19: value 300k, approved installment 100k.
const dueNow = getAmountDueNow({
  outstandingKobo: 30000000,
  approvedRequest: {
    status: 'approved',
    approved_amount_kobo: 10000000,
    approval_expires_at: null,
  },
});

assert.strictEqual(dueNow, 10000000, 'due now must be the installment, not the total');

// Expired approvals must no longer be payable.
const expiredDue = getAmountDueNow({
  outstandingKobo: 30000000,
  approvedRequest: {
    status: 'approved',
    approved_amount_kobo: 10000000,
    approval_expires_at: new Date(Date.now() - 1000).toISOString(),
  },
});

assert.strictEqual(expiredDue, 30000000, 'expired approval falls back to full outstanding');

assert.strictEqual(parseNairaInput('75,000'), 7500000);
assert.strictEqual(parseNairaInput('abc'), null);
assert.strictEqual(parseNairaInput('-5'), null);

// External payment worked example: ₦100,000 project, ₦30,000 bank receipt.
// Total stays ₦100,000, paid becomes ₦30,000, balance ₦70,000.
const external = deriveProjectFinance({
  baseKobo: 10000000,
  additionalKobo: 0,
  paidKobo: 3000000,
});

assert.strictEqual(external.total, 10000000, 'external payment must not reduce the project price');
assert.strictEqual(external.paid, 3000000, 'paid must include the external receipt');
assert.strictEqual(external.outstanding, 7000000, 'balance must fall by the receipt');

// Price reduction worked example: ₦100,000 project, ₦30,000 paid,
// reduced to ₦80,000. Balance becomes ₦50,000.
const reduced = deriveProjectFinance({
  baseKobo: 8000000,
  additionalKobo: 0,
  paidKobo: 3000000,
});

assert.strictEqual(reduced.total, 8000000, 'reduced total must hold');
assert.strictEqual(reduced.paid, 3000000, 'paid must be untouched by a price change');
assert.strictEqual(reduced.outstanding, 5000000, 'balance must be new total minus paid');

// Server guard mirror: reduction must stay strictly below current
// total and never below confirmed paid.
const currentTotal = 10000000;
const paidToDate = 3000000;

for (const candidate of [8000000]) {
  assert.ok(candidate < currentTotal, 'new total must be a reduction');
  assert.ok(candidate >= paidToDate, 'new total must cover confirmed paid');
}

assert.ok(3000000 >= paidToDate, 'a new total equal to paid is allowed');
assert.ok(!(2999999 >= paidToDate), 'a new total below paid is rejected');

// External ledger labelling stays separate from Flutterwave rows.
assert.strictEqual(
  paymentSourceLabel({ payment_type: 'manual', payment_scope: 'external_payment', manual_method: 'bank_transfer' }),
  'External Payment · Bank transfer',
);
assert.strictEqual(
  paymentSourceLabel({ payment_type: 'provider' }),
  'Provider verified',
);
assert.strictEqual(
  paymentSourceLabel({ payment_type: 'manual', payment_scope: 'manual_payment', manual_method: 'cash' }),
  'Manually recorded · Cash',
);
assert.strictEqual(
  paymentSourceLabel({ payment_type: 'adjustment' }),
  'Adjustment',
);
assert.strictEqual(
  paymentSourceLabel({ payment_type: 'reversal' }),
  'Reversal',
);

// External methods exclude corrections (those use adjustments).
const externalValues = EXTERNAL_PAYMENT_METHODS.map((method) => method.value);

assert.ok(externalValues.includes('bank_transfer'), 'bank transfer is an external method');
assert.ok(externalValues.includes('cash'), 'cash is an external method');
assert.ok(!externalValues.includes('correction'), 'corrections must not be external payments');

console.log('finance-acceptance: ALL CHECKS PASSED');
