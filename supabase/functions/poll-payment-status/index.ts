import { withSupabase } from 'npm:@supabase/server@^1';
import { flutterwaveRequest } from '../_shared/flutterwave.ts';

const AUTO_CANCEL_AFTER_MS = 5 * 60 * 1000;

async function checkFlutterwaveCharge(payment) {
  try {
    if (payment.provider_transaction_id?.startsWith('chg_')) {
      const result = await flutterwaveRequest(
        `/charges/${encodeURIComponent(payment.provider_transaction_id)}`,
      );
      return result?.data || null;
    }

    if (payment.virtual_account_id) {
      const result = await flutterwaveRequest(
        `/charges?virtual_account_id=${encodeURIComponent(payment.virtual_account_id)}`,
      );
      const charges = Array.isArray(result?.data) ? result.data : [];
      return charges.find((item) => item.reference === payment.provider_reference) || charges[0] || null;
    }

    if (payment.provider_reference) {
      const result = await flutterwaveRequest(
        `/transactions?tx_ref=${encodeURIComponent(payment.provider_reference)}`,
      );
      const transactions = Array.isArray(result?.data) ? result.data : [];
      return transactions[0] || null;
    }
  } catch (error) {
    console.error('poll-payment-status flutterwave check:', error?.message);
  }
  return null;
}

function providerStatusToLocal(charge) {
  const raw = (charge?.status || '').trim().toLowerCase();

  if (['succeeded', 'successful'].includes(raw)) {
    return 'successful';
  }

  if (raw === 'failed') {
    return 'failed';
  }

  if (['voided', 'cancelled'].includes(raw)) {
    return 'cancelled';
  }

  return null;
}

async function autoCancelPayment(admin, payment, reason) {
  if (payment.provider_transaction_id?.startsWith('chg_')) {
    try {
      await flutterwaveRequest(`/charges/${payment.provider_transaction_id}/void`, { method: 'POST' });
    } catch (voidError) {
      console.error('poll-payment-status auto-cancel void:', voidError?.message);
    }
  }

  const now = new Date().toISOString();

  await admin
    .from('payment_transactions')
    .update({
      status: 'cancelled',
      attempt_stage: 'cancelled',
      failure_code: 'AUTO_CANCELLED_TIMEOUT',
      customer_message: reason,
      last_checked_at: now,
      completed_at: now,
    })
    .eq('id', payment.id);

  await admin.from('payment_attempt_diagnostics').insert({
    payment_id: payment.id,
    event_type: 'auto_cancel_timeout',
    stage: 'cancelled',
    internal_message: reason,
  });
}

async function markSuccessful(admin, payment, charge) {
  const now = new Date().toISOString();

  const normalizedFees = Array.isArray(charge?.fees)
    ? charge.fees.map((f) => ({ type: f?.type || 'provider_fee', amount: Number(f?.amount || 0) }))
    : [];

  const providerFee = normalizedFees.reduce((sum, f) => sum + Math.round(Number(f.amount || 0) * 100), 0);

  const customerBearsFee = payment.customer_bears_fee !== false;
  const actualCustomerTotal = Number(payment.amount_kobo) + (customerBearsFee ? providerFee : 0);

  await admin
    .from('payment_transactions')
    .update({
      status: 'successful',
      provider_status: 'succeeded',
      provider_response_code: charge?.processor_response?.code || charge?.issuer_response?.code || null,
      provider_transaction_id: charge?.id || payment.provider_transaction_id,
      actual_provider_fee_kobo: providerFee,
      actual_customer_total_kobo: actualCustomerTotal,
      provider_fees: normalizedFees,
      provider_payload: {
        id: charge?.id || null,
        reference: charge?.reference || null,
        amount: charge?.amount ?? null,
        currency: charge?.currency || null,
        status: charge?.status || null,
        customer_id: charge?.customer?.id || charge?.customer_id || null,
      },
      attempt_stage: 'completed',
      customer_message: null,
      failure_code: null,
      verified_at: now,
      last_checked_at: now,
      completed_at: now,
    })
    .eq('id', payment.id);

  await admin.from('payment_attempt_diagnostics').insert({
    payment_id: payment.id,
    event_type: 'poll_verified',
    stage: 'completed',
    provider_status: 'succeeded',
    internal_message: 'Payment confirmed by automatic background poll.',
  });

  const { data: order } = await admin
    .from('orders')
    .select('id, reference, customer_id, quoted_amount_kobo')
    .eq('id', payment.order_id)
    .maybeSingle();

  if (order) {
    const { data: allPaid } = await admin
      .from('payment_transactions')
      .select('amount_kobo, base_amount_kobo, payment_type, status, is_reversed')
      .eq('order_id', order.id)
      .eq('status', 'successful');

    const totalPaid = (allPaid || []).reduce((sum, row) => {
      if (row.is_reversed === true) return sum;
      if (row.payment_type === 'reversal') return sum;
      if (row.payment_type === 'adjustment') return sum + Number(row.amount_kobo || 0);
      const credit = Number(row.base_amount_kobo ?? row.amount_kobo ?? 0);
      return sum + (Number.isFinite(credit) && credit > 0 ? Math.round(credit) : 0);
    }, 0);

    const quoteAmount = Number(order.quoted_amount_kobo || 0);
    const fullyPaid = quoteAmount > 0 && totalPaid >= quoteAmount;

    await admin
      .from('orders')
      .update({
        paid_amount_kobo: totalPaid,
        payment_status: fullyPaid ? 'successful' : 'processing',
        customer_action_required: !fullyPaid,
        customer_action_label: fullyPaid ? null : 'Payment received — remaining balance outstanding',
        ...(fullyPaid && !['completed', 'cancelled'].includes(order.status) ? { status: 'paid' } : {}),
      })
      .eq('id', order.id);

    await admin.from('notification_events').insert({
      order_id: order.id,
      customer_id: order.customer_id,
      channel: 'internal',
      event_type: 'payment_received',
      status: 'pending',
      payload: {
        payment_id: payment.id,
        amount_kobo: Number(payment.amount_kobo),
        reference: payment.provider_reference,
        project_fully_paid: fullyPaid,
        remaining_balance_kobo: Math.max(quoteAmount - totalPaid, 0),
        source: 'background_poll',
      },
    });

    return { fullyPaid, orderReference: order.reference };
  }

  return { fullyPaid: false, orderReference: null };
}

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    if (req.method !== 'POST') {
      return Response.json({ success: false, message: 'Method not allowed.' }, { status: 405 });
    }

    try {
      const userId = ctx.user?.id;

      if (!userId) {
        return Response.json({ success: false, message: 'Authentication required.' }, { status: 401 });
      }

      const { data: pendingPayments, error: fetchError } = await ctx.supabase
        .from('payment_transactions')
        .select(`
          id, order_id, provider_reference, provider_transaction_id, virtual_account_id,
          provider_customer_id, payment_method, amount_kobo, customer_bears_fee, currency,
          status, attempt_stage, created_at,
          orders!inner ( id, customer_id )
        `)
        .in('status', ['pending', 'processing'])
        .eq('orders.customer_id', userId)
        .order('created_at', { ascending: true });

      if (fetchError) {
        throw fetchError;
      }

      if (!pendingPayments?.length) {
        return Response.json({ success: true, updated: [], cancelled: [], confirmed: [] });
      }

      const now = Date.now();
      const updated = [];
      const cancelled = [];
      const confirmed = [];

      for (const payment of pendingPayments) {
        const createdAt = new Date(payment.created_at).getTime();
        const ageMs = now - createdAt;

        if (ageMs > AUTO_CANCEL_AFTER_MS) {
          const reason = 'This payment was not confirmed within 5 minutes and has been automatically cancelled. No money was charged.';
          await autoCancelPayment(ctx.supabaseAdmin, payment, reason);
          cancelled.push({ id: payment.id, status: 'cancelled', message: reason });
          continue;
        }

        const charge = await checkFlutterwaveCharge(payment);

        if (!charge) {
          await ctx.supabaseAdmin
            .from('payment_transactions')
            .update({ last_checked_at: new Date().toISOString() })
            .eq('id', payment.id);

          updated.push({ id: payment.id, status: 'pending', message: 'Flutterwave has not confirmed this payment yet.' });
          continue;
        }

        const localStatus = providerStatusToLocal(charge);

        if (localStatus === 'successful') {
          const result = await markSuccessful(ctx.supabaseAdmin, payment, charge);
          confirmed.push({
            id: payment.id,
            status: 'successful',
            orderReference: result.orderReference,
            fullyPaid: result.fullyPaid,
            message: 'Payment confirmed.',
          });
          continue;
        }

        if (localStatus === 'failed' || localStatus === 'cancelled') {
          const nowIso = new Date().toISOString();

          await ctx.supabaseAdmin
            .from('payment_transactions')
            .update({
              status: localStatus,
              provider_status: (charge.status || '').trim().toLowerCase(),
              attempt_stage: localStatus,
              customer_message: localStatus === 'failed'
                ? 'This payment was not completed. You can try again.'
                : 'This payment was cancelled.',
              last_checked_at: nowIso,
              completed_at: nowIso,
            })
            .eq('id', payment.id);

          updated.push({ id: payment.id, status: localStatus, message: localStatus === 'failed' ? 'Payment failed.' : 'Payment cancelled.' });
          continue;
        }

        await ctx.supabaseAdmin
          .from('payment_transactions')
          .update({ last_checked_at: new Date().toISOString() })
          .eq('id', payment.id);

        updated.push({ id: payment.id, status: 'pending', message: 'Flutterwave has not confirmed this payment yet.' });
      }

      return Response.json({ success: true, updated, cancelled, confirmed });
    } catch (error) {
      console.error('poll-payment-status:', error);

      return Response.json(
        { success: false, message: error instanceof Error ? error.message : 'Payment polling failed.' },
        { status: 500 },
      );
    }
  }),
};
