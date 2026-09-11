import assert from 'node:assert';

import {
  deriveProjectFinance,
  formatKobo,
  getAmountDueNow,
  parseNairaInput,
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

console.log('finance-acceptance: ALL CHECKS PASSED');
