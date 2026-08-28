import {
  supabase,
} from './supabase';

function financeError(error, fallback) {
  return new Error(error?.message || fallback);
}

export async function getPartPaymentRequests(orderId) {
  if (!orderId) {
    return [];
  }

  const { data, error } = await supabase
    .from('part_payment_requests')
    .select(`
      id,
      order_id,
      reason,
      status,
      approved_amount_kobo,
      approval_expires_at,
      balance_due_at,
      allow_work_to_start,
      admin_note,
      decline_reason,
      reviewed_at,
      fulfilled_at,
      created_at,
      updated_at
    `)
    .eq('order_id', orderId)
    .order('created_at', { ascending: false });

  if (error) {
    throw financeError(error, 'Part-payment requests could not be loaded.');
  }

  return data || [];
}

export async function requestProjectPartPayment({ orderId, reason }) {
  const { data, error } = await supabase.rpc(
    'request_project_part_payment',
    {
      p_order_id: orderId,
      p_reason: reason.trim(),
    },
  );

  if (error) {
    throw financeError(
      error,
      'Your part-payment request could not be submitted.',
    );
  }

  return data;
}

export async function reviewProjectPartPayment({
  requestId,
  decision,
  approvedAmountKobo = null,
  approvalExpiresAt = null,
  balanceDueAt = null,
  adminNote = '',
  allowWorkToStart = false,
}) {
  const { data, error } = await supabase.rpc(
    'admin_review_part_payment',
    {
      p_request_id: requestId,
      p_decision: decision,
      p_approved_amount_kobo: approvedAmountKobo,
      p_approval_expires_at: approvalExpiresAt,
      p_balance_due_at: balanceDueAt,
      p_admin_note: adminNote.trim() || null,
      p_allow_work_to_start: Boolean(allowWorkToStart),
    },
  );

  if (error) {
    throw financeError(
      error,
      'The part-payment decision could not be saved.',
    );
  }

  return data;
}

