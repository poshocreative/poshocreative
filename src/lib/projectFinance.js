import {
  supabase,
} from './supabase';

function financeError(error, fallback) {
  return new Error(error?.message || fallback);
}

export const PART_PAYMENT_UNAVAILABLE_MESSAGE =
  'Part-payment arrangements are temporarily unavailable while Management completes a payment update. Full secure payment is still available.';

function isPartPaymentSchemaUnavailable(error) {
  const code = String(error?.code || '').toUpperCase();
  const message = String(error?.message || '').toLowerCase();

  return (
    ['42P01', '42703', '42883', 'PGRST202', 'PGRST205'].includes(code) ||
    message.includes('part_payment_requests') ||
    message.includes('request_project_part_payment') ||
    message.includes('admin_review_part_payment') ||
    message.includes('schema cache')
  );
}

export async function getPartPaymentState(orderId) {
  if (!orderId) {
    return {
      available: true,
      requests: [],
    };
  }

  const { data, error } = await supabase
    .from('part_payment_requests')
    .select(`
      id,
      order_id,
      reason,
      requested_amount_kobo,
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
    if (isPartPaymentSchemaUnavailable(error)) {
      return {
        available: false,
        requests: [],
      };
    }

    throw financeError(error, 'Part-payment requests could not be loaded.');
  }

  return {
    available: true,
    requests: data || [],
  };
}

export async function getPartPaymentRequests(orderId) {
  const state = await getPartPaymentState(orderId);
  return state.requests;
}

export async function requestProjectPartPayment({
  orderId,
  requestedAmountKobo,
  reason = '',
}) {
  const { data, error } = await supabase.rpc(
    'request_project_part_payment',
    {
      p_order_id: orderId,
      p_requested_amount_kobo: requestedAmountKobo,
      p_reason: reason.trim(),
    },
  );

  if (error) {
    if (isPartPaymentSchemaUnavailable(error)) {
      throw new Error(PART_PAYMENT_UNAVAILABLE_MESSAGE);
    }

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
    if (isPartPaymentSchemaUnavailable(error)) {
      throw new Error(PART_PAYMENT_UNAVAILABLE_MESSAGE);
    }

    throw financeError(
      error,
      'The part-payment decision could not be saved.',
    );
  }

  return data;
}
