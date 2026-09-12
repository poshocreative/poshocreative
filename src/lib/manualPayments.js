import { supabase } from './supabase';
import { toUserError } from './errors';
import { parseNairaInput } from './money';

const MANUAL_METHODS = new Set([
  'bank_transfer',
  'cash',
  'pos',
  'external_transfer',
  'correction',
  'other',
]);

export async function recordManualPayment({
  orderId,
  amountNaira,
  method,
  reference = '',
  note = '',
  receivedAt = null,
  notifyCustomer = true,
}) {
  const amountKobo = parseNairaInput(amountNaira);

  if (!amountKobo) {
    throw new Error('Enter a valid payment amount greater than zero.');
  }

  if (!MANUAL_METHODS.has(method)) {
    throw new Error('Choose a valid payment method.');
  }

  const { data, error } = await supabase.functions.invoke(
    'admin-order-action',
    {
      body: {
        action: 'record_manual_payment',
        orderId,
        amountKobo,
        method,
        reference: String(reference || '').trim() || null,
        note: String(note || '').trim() || null,
        receivedAt,
        notifyCustomer,
      },
    },
  );

  if (error) {
    throw await toUserError(error, 'The manual payment could not be recorded.');
  }

  if (!data?.success) {
    throw new Error(data?.message || 'The manual payment could not be recorded.');
  }

  return data.payment;
}

export async function reverseLedgerPayment({ paymentId, reason }) {
  const cleanReason = String(reason || '').trim();

  if (cleanReason.length < 10) {
    throw new Error(
      'Provide a clear reason (at least 10 characters) before reversing a payment.',
    );
  }

  // orderId is required by the edge function router; load it first.
  const { data: payment, error: lookupError } = await supabase
    .from('payment_transactions')
    .select('id,order_id')
    .eq('id', paymentId)
    .maybeSingle();

  if (lookupError || !payment) {
    throw new Error('The payment could not be found.');
  }

  const { data, error } = await supabase.functions.invoke(
    'admin-order-action',
    {
      body: {
        action: 'reverse_payment',
        orderId: payment.order_id,
        paymentId,
        reason: cleanReason,
      },
    },
  );

  if (error) {
    throw await toUserError(error, 'The payment could not be reversed.');
  }

  if (!data?.success) {
    throw new Error(data?.message || 'The payment could not be reversed.');
  }

  return data.reversal;
}

export async function adjustLedgerPayment({
  orderId,
  amountNaira,
  negative = false,
  reason,
  notifyCustomer = true,
}) {
  const magnitude = parseNairaInput(amountNaira);

  if (!magnitude) {
    throw new Error('Enter a valid adjustment amount greater than zero.');
  }

  const cleanReason = String(reason || '').trim();

  if (cleanReason.length < 10) {
    throw new Error(
      'Provide a clear reason (at least 10 characters) for this adjustment.',
    );
  }

  const signedKobo = negative ? -magnitude : magnitude;

  const { data, error } = await supabase.functions.invoke(
    'admin-order-action',
    {
      body: {
        action: 'adjust_payment',
        orderId,
        amountKobo: signedKobo,
        reason: cleanReason,
        notifyCustomer,
      },
    },
  );

  if (error) {
    throw await toUserError(error, 'The adjustment could not be recorded.');
  }

  if (!data?.success) {
    throw new Error(data?.message || 'The adjustment could not be recorded.');
  }

  return data.adjustment;
}

const EXTERNAL_METHODS = new Set([
  'bank_transfer',
  'cash',
  'pos',
  'external_transfer',
  'other',
]);

export async function recordExternalPayment({
  orderId,
  amountNaira,
  method,
  reference = '',
  note = '',
  receivedAt = null,
  notifyCustomer = true,
}) {
  const amountKobo = parseNairaInput(amountNaira);

  if (!amountKobo) {
    throw new Error('Enter a valid payment amount greater than zero.');
  }

  if (!EXTERNAL_METHODS.has(method)) {
    throw new Error('Choose a valid external payment method.');
  }

  const cleanNote = String(note || '').trim();

  if (cleanNote.length < 10) {
    throw new Error(
      'Record a clear note (at least 10 characters) describing this external payment.',
    );
  }

  const { data, error } = await supabase.functions.invoke(
    'admin-order-action',
    {
      body: {
        action: 'record_external_payment',
        orderId,
        amountKobo,
        method,
        reference: String(reference || '').trim() || null,
        note: cleanNote,
        receivedAt,
        notifyCustomer,
      },
    },
  );

  if (error) {
    throw await toUserError(error, 'The external payment could not be recorded.');
  }

  if (!data?.success) {
    throw new Error(data?.message || 'The external payment could not be recorded.');
  }

  return data.payment;
}

export async function adjustProjectPrice({
  orderId,
  newTotalNaira,
  reason,
  notifyCustomer = true,
}) {
  const newTotalKobo = parseNairaInput(newTotalNaira);

  if (!newTotalKobo) {
    throw new Error('Enter a valid new project total greater than zero.');
  }

  const cleanReason = String(reason || '').trim();

  if (cleanReason.length < 10) {
    throw new Error(
      'Provide a clear reason (at least 10 characters) for this price change.',
    );
  }

  const { data, error } = await supabase.functions.invoke(
    'admin-order-action',
    {
      body: {
        action: 'adjust_project_price',
        orderId,
        newTotalKobo,
        reason: cleanReason,
        notifyCustomer,
      },
    },
  );

  if (error) {
    throw await toUserError(error, 'The project price could not be adjusted.');
  }

  if (!data?.success) {
    throw new Error(data?.message || 'The project price could not be adjusted.');
  }

  return data.adjustment;
}
