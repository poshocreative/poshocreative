import { supabase } from './supabase';
import { toUserError } from './errors';
import {
  deriveProjectFinance,
  getAmountDueNow,
  safeKobo,
} from './money';

/**
 * Canonical project finance snapshot.
 * total = base + active additional costs
 * paid  = confirmed ledger (orders.paid_amount_kobo, recalculated server-side)
 */
export function buildFinanceSnapshot({
  order,
  costs = [],
  partRequests = [],
  milestones = [],
  priceAdjustments = [],
} = {}) {
  const base = safeKobo(
    order?.base_project_price_kobo ??
      order?.quoted_amount_kobo ??
      0,
  );

  const activeCosts = (costs || []).filter(
    (cost) => cost.status === 'active',
  );

  const additional = activeCosts.reduce(
    (sum, cost) => sum + safeKobo(cost.amount_kobo),
    0,
  );

  const waived = (costs || [])
    .filter((cost) => cost.status === 'waived')
    .reduce((sum, cost) => sum + safeKobo(cost.amount_kobo), 0);

  // Prefer explicit base when present; otherwise fall back to quoted total.
  const quotedTotal = safeKobo(order?.quoted_amount_kobo);
  const computedTotal = base + additional;
  const total = quotedTotal > 0 ? quotedTotal : computedTotal;
  const resolvedBase = quotedTotal > 0 ? Math.max(quotedTotal - additional, 0) : base;

  const paid = safeKobo(order?.paid_amount_kobo);
  const outstanding = Math.max(total - paid, 0);

  const now = new Date();
  const approvedRequest =
    (partRequests || []).find(
      (request) =>
        request.status === 'approved' &&
        Number(request.approved_amount_kobo) > 0 &&
        (!request.approval_expires_at ||
          new Date(request.approval_expires_at) > now),
    ) || null;

  const pendingRequest =
    (partRequests || []).find(
      (request) => request.status === 'pending',
    ) || null;

  const dueNow = getAmountDueNow({
    outstandingKobo: outstanding,
    approvedRequest,
  });

  const nextMilestone =
    (milestones || [])
      .filter((milestone) => ['pending', 'due', 'overdue'].includes(milestone.status))
      .sort((a, b) => (a.sequence || 0) - (b.sequence || 0))[0] || null;

  // Original agreed total = the previous total of the earliest price
  // adjustment, otherwise the current live total (never adjusted).
  const sortedAdjustments = [...(priceAdjustments || [])].sort(
    (a, b) => new Date(a.created_at) - new Date(b.created_at),
  );

  const originalPrice =
    sortedAdjustments.length > 0
      ? safeKobo(sortedAdjustments[0].previous_total_kobo, total)
      : total;

  return {
    base: resolvedBase,
    additional,
    waived,
    total,
    originalPrice,
    priceAdjustments: sortedAdjustments,
    paid,
    outstanding,
    dueNow,
    approvedRequest,
    pendingRequest,
    nextMilestone,
    fullyPaid: total > 0 && paid >= total,
    hasPrice: total > 0,
    activeCosts,
    derived: deriveProjectFinance({
      baseKobo: resolvedBase,
      additionalKobo: additional,
      paidKobo: paid,
    }),
  };
}

export async function getProjectCosts(orderId) {
  if (!orderId) {
    return [];
  }

  const { data, error } = await supabase
    .from('project_cost_items')
    .select(
      'id,order_id,title,description,amount_kobo,status,due_at,created_by,waived_at,waived_by,waive_reason,created_at',
    )
    .eq('order_id', orderId)
    .order('created_at', { ascending: true });

  if (error) {
    throw await toUserError(error, 'Additional project costs could not be loaded.');
  }

  return data || [];
}

export async function getProjectMilestones(orderId) {
  if (!orderId) {
    return [];
  }

  const { data, error } = await supabase
    .from('project_payment_milestones')
    .select('*')
    .eq('order_id', orderId)
    .order('sequence', { ascending: true });

  if (error) {
    // Milestones are additive; older environments without the table
    // should degrade gracefully instead of breaking finance.
    if (String(error.code) === '42P01') {
      return [];
    }

    throw await toUserError(error, 'The payment schedule could not be loaded.');
  }

  return data || [];
}

export async function getProjectLedger(orderId) {
  if (!orderId) {
    return [];
  }

  const fullSelect = `id,order_id,provider,provider_reference,provider_transaction_id,
       amount_kobo,base_amount_kobo,estimated_fee_kobo,estimated_customer_total_kobo,
       actual_provider_fee_kobo,actual_customer_total_kobo,currency,status,
       payment_scope,payment_type,payment_method,manual_method,manual_reference,
       manual_note,recorded_by,related_payment_id,is_reversed,reversed_at,
       reversal_reason,balance_after_kobo,notify_customer,part_payment_request_id,
       verified_at,completed_at,created_at`;

  const legacySelect = `id,order_id,provider,provider_reference,provider_transaction_id,
       amount_kobo,base_amount_kobo,estimated_fee_kobo,estimated_customer_total_kobo,
       actual_provider_fee_kobo,actual_customer_total_kobo,currency,status,
       payment_scope,payment_method,part_payment_request_id,
       verified_at,completed_at,created_at`;

  const attempt = await supabase
    .from('payment_transactions')
    .select(fullSelect)
    .eq('order_id', orderId)
    .order('created_at', { ascending: false });

  if (!attempt.error) {
    return attempt.data || [];
  }

  const message = String(attempt.error.message || '');

  if (attempt.error.code === '42703' || message.includes('column')) {
    const fallback = await supabase
      .from('payment_transactions')
      .select(legacySelect)
      .eq('order_id', orderId)
      .order('created_at', { ascending: false });

    if (fallback.error) {
      throw await toUserError(fallback.error, 'The payment ledger could not be loaded securely.');
    }

    return fallback.data || [];
  }

  throw await toUserError(attempt.error, 'The payment ledger could not be loaded securely.');
}
