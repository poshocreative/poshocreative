-- FIX: Cast CASE expression text to payment_status enum type
-- Multiple RPCs assign text literals to the enum column without an
-- explicit cast, causing: column "payment_status" is of type
-- payment_status but expression is of type text

-- 7a. admin_record_manual_payment (fix line 356)
create or replace function public.admin_record_manual_payment(
  p_order_id uuid,
  p_amount_kobo bigint,
  p_method text,
  p_reference text default null,
  p_note text default null,
  p_received_at timestamptz default null,
  p_notify_customer boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_total bigint;
  v_paid bigint;
  v_outstanding bigint;
  v_new_paid bigint;
  v_payment_id uuid;
  v_method text;
  v_ref text;
begin
  if public.has_admin_access() is not true then
    raise exception 'Administrative access is required.';
  end if;

  if p_amount_kobo is null or p_amount_kobo <= 0 then
    raise exception 'Enter a valid payment amount greater than zero.';
  end if;

  v_method := lower(trim(coalesce(p_method, '')));
  if v_method not in ('bank_transfer', 'cash', 'pos', 'external_transfer', 'correction', 'other') then
    raise exception 'Choose a valid payment method.';
  end if;

  v_ref := nullif(trim(coalesce(p_reference, '')), '');
  if v_ref is not null and char_length(v_ref) > 160 then
    raise exception 'The payment reference is too long.';
  end if;

  if p_note is not null and char_length(p_note) > 3000 then
    raise exception 'The payment note is too long.';
  end if;

  if v_ref is not null and exists (
    select 1 from public.payment_transactions
    where order_id = p_order_id
      and payment_type = 'manual'
      and lower(coalesce(manual_reference, '')) = lower(v_ref)
      and status = 'successful'
      and coalesce(is_reversed, false) = false
  ) then
    raise exception 'A manual payment with this reference already exists for this project.';
  end if;

  select * into v_order from public.orders where id = p_order_id;
  if not found then
    raise exception 'Project could not be found.';
  end if;

  if v_order.review_decision is distinct from 'approved' then
    raise exception 'Only approved projects can receive payments.';
  end if;

  if v_order.archived_at is not null then
    raise exception 'Archived projects cannot receive new payments. Restore the project first.';
  end if;

  v_total := coalesce(v_order.quoted_amount_kobo, 0);
  if v_total <= 0 then
    raise exception 'Set the project price before recording a payment.';
  end if;

  v_paid := public.recalc_project_paid(p_order_id);
  v_outstanding := greatest(v_total - v_paid, 0);

  if p_amount_kobo > v_outstanding then
    raise exception 'The recorded amount (%) exceeds the outstanding balance (%).', p_amount_kobo, v_outstanding;
  end if;

  v_new_paid := v_paid + p_amount_kobo;

  insert into public.payment_transactions (
    order_id, provider, provider_reference, amount_kobo, base_amount_kobo,
    currency, status, payment_scope, payment_type, payment_method,
    manual_method, manual_reference, manual_note, recorded_by,
    notify_customer, attempt_stage, verified_at, completed_at,
    balance_after_kobo,
    payment_metadata
  ) values (
    p_order_id, 'manual',
    'MANUAL-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16)),
    p_amount_kobo, p_amount_kobo,
    coalesce(v_order.currency, 'NGN'), 'successful', 'manual_payment', 'manual',
    v_method, v_method, v_ref, nullif(trim(coalesce(p_note, '')), ''),
    auth.uid(), coalesce(p_notify_customer, true), 'completed',
    coalesce(p_received_at, now()), now(),
    v_new_paid,
    jsonb_build_object(
      'source', 'manual_payment',
      'received_at', coalesce(p_received_at, now()),
      'recorded_via', 'admin_record_manual_payment'
    )
  ) returning id into v_payment_id;

  update public.orders
  set paid_amount_kobo = v_new_paid,
      payment_status = (case when v_new_paid >= v_total then 'successful' else 'processing' end)::public.payment_status,
      customer_action_required = v_new_paid < v_total,
      customer_action_label = case
        when v_new_paid >= v_total then null
        else 'Payment received — remaining balance outstanding'
      end,
      last_admin_activity_at = now()
  where id = p_order_id;

  insert into public.admin_activity_log (admin_user_id, order_id, action, description, metadata)
  values (
    auth.uid(), p_order_id, 'manual_payment_recorded',
    'Manual payment of ' || p_amount_kobo || ' kobo recorded (' || v_method || ').',
    jsonb_build_object(
      'payment_id', v_payment_id,
      'amount_kobo', p_amount_kobo,
      'method', v_method,
      'reference', v_ref,
      'paid_before_kobo', v_paid,
      'paid_after_kobo', v_new_paid,
      'outstanding_before_kobo', v_outstanding
    )
  );

  if coalesce(p_notify_customer, true) then
    insert into public.notification_events (order_id, customer_id, channel, event_type, status, payload)
    values (
      p_order_id, v_order.customer_id, 'internal', 'manual_payment_recorded', 'pending',
      jsonb_build_object(
        'reference', v_order.reference,
        'project_title', v_order.project_title,
        'amount_kobo', p_amount_kobo,
        'method', v_method,
        'payment_reference', v_ref,
        'paid_after_kobo', v_new_paid,
        'outstanding_after_kobo', greatest(v_total - v_new_paid, 0)
      )
    );
  end if;

  return jsonb_build_object(
    'payment_id', v_payment_id,
    'amount_kobo', p_amount_kobo,
    'paid_after_kobo', v_new_paid,
    'outstanding_after_kobo', greatest(v_total - v_new_paid, 0),
    'fully_paid', v_new_paid >= v_total
  );
end;
$$;

-- 7b. admin_reverse_payment (fix line 493)
create or replace function public.admin_reverse_payment(
  p_payment_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payment_transactions%rowtype;
  v_order public.orders%rowtype;
  v_total bigint;
  v_new_paid bigint;
  v_reversal_id uuid;
  v_reason text;
begin
  if public.has_admin_access() is not true then
    raise exception 'Administrative access is required.';
  end if;

  v_reason := nullif(trim(coalesce(p_reason, '')), '');
  if v_reason is null or char_length(v_reason) < 10 then
    raise exception 'Provide a clear reason (at least 10 characters) before reversing a payment.';
  end if;

  select * into v_payment from public.payment_transactions where id = p_payment_id;
  if not found then
    raise exception 'Payment could not be found.';
  end if;

  if v_payment.payment_type = 'provider' then
    raise exception 'Provider-verified payments cannot be reversed from here.';
  end if;

  if v_payment.status is distinct from 'successful' then
    raise exception 'Only confirmed payments can be reversed.';
  end if;

  if coalesce(v_payment.is_reversed, false) = true then
    raise exception 'This payment has already been reversed.';
  end if;

  select * into v_order from public.orders where id = v_payment.order_id;
  if not found then
    raise exception 'Project could not be found.';
  end if;

  update public.payment_transactions
  set is_reversed = true,
      reversed_at = now(),
      reversal_reason = v_reason
  where id = p_payment_id;

  insert into public.payment_transactions (
    order_id, provider, provider_reference, amount_kobo, base_amount_kobo,
    currency, status, payment_scope, payment_type, payment_method,
    manual_method, manual_reference, manual_note, recorded_by,
    related_payment_id, attempt_stage, verified_at, completed_at,
    payment_metadata
  ) values (
    v_payment.order_id, 'manual',
    'REVERSAL-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16)),
    0, 0,
    coalesce(v_payment.currency, 'NGN'), 'successful', 'reversal', 'reversal',
    coalesce(v_payment.manual_method, 'correction'), coalesce(v_payment.manual_method, 'correction'),
    null, v_reason, auth.uid(),
    p_payment_id, 'completed', now(), now(),
    jsonb_build_object('source', 'payment_reversal', 'reversed_payment_id', p_payment_id)
  ) returning id into v_reversal_id;

  v_total := coalesce(v_order.quoted_amount_kobo, 0);
  v_new_paid := public.recalc_project_paid(v_payment.order_id);

  update public.payment_transactions
  set balance_after_kobo = v_new_paid
  where id = v_reversal_id;

  update public.orders
  set paid_amount_kobo = v_new_paid,
      payment_status = (case when v_total > 0 and v_new_paid >= v_total then 'successful' else 'processing' end)::public.payment_status,
      last_admin_activity_at = now()
  where id = v_payment.order_id;

  insert into public.admin_activity_log (admin_user_id, order_id, action, description, metadata)
  values (
    auth.uid(), v_payment.order_id, 'payment_reversed',
    'Payment ' || coalesce(v_payment.manual_reference, v_payment.provider_reference) || ' reversed.',
    jsonb_build_object(
      'payment_id', p_payment_id,
      'reversal_id', v_reversal_id,
      'reason', v_reason,
      'paid_after_kobo', v_new_paid
    )
  );

  insert into public.notification_events (order_id, customer_id, channel, event_type, status, payload)
  values (
    v_payment.order_id, v_order.customer_id, 'internal', 'payment_adjusted', 'pending',
    jsonb_build_object(
      'reference', v_order.reference,
      'project_title', v_order.project_title,
      'kind', 'reversal',
      'reason', v_reason,
      'paid_after_kobo', v_new_paid
    )
  );

  return jsonb_build_object(
    'reversal_id', v_reversal_id,
    'paid_after_kobo', v_new_paid
  );
end;
$$;

-- 7c. admin_adjust_payment (fix line 602)
create or replace function public.admin_adjust_payment(
  p_order_id uuid,
  p_amount_kobo bigint,
  p_reason text,
  p_notify_customer boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_total bigint;
  v_paid bigint;
  v_new_paid bigint;
  v_reason text;
  v_payment_id uuid;
begin
  if public.has_admin_access() is not true then
    raise exception 'Administrative access is required.';
  end if;

  if p_amount_kobo is null or p_amount_kobo = 0 then
    raise exception 'Enter a non-zero adjustment amount.';
  end if;

  v_reason := nullif(trim(coalesce(p_reason, '')), '');
  if v_reason is null or char_length(v_reason) < 10 then
    raise exception 'Provide a clear reason (at least 10 characters) for this adjustment.';
  end if;

  select * into v_order from public.orders where id = p_order_id;
  if not found then
    raise exception 'Project could not be found.';
  end if;

  v_total := coalesce(v_order.quoted_amount_kobo, 0);
  v_paid := public.recalc_project_paid(p_order_id);
  v_new_paid := v_paid + p_amount_kobo;

  if v_new_paid < 0 then
    raise exception 'This adjustment would take confirmed payments below zero.';
  end if;

  if v_new_paid > v_total then
    raise exception 'This adjustment would take confirmed payments above the project value.';
  end if;

  insert into public.payment_transactions (
    order_id, provider, provider_reference, amount_kobo, base_amount_kobo,
    currency, status, payment_scope, payment_type, payment_method,
    manual_method, manual_note, recorded_by, notify_customer,
    attempt_stage, verified_at, completed_at, balance_after_kobo,
    payment_metadata
  ) values (
    p_order_id, 'manual',
    'ADJUST-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16)),
    p_amount_kobo, p_amount_kobo,
    coalesce(v_order.currency, 'NGN'), 'successful', 'adjustment', 'adjustment',
    'correction', 'correction', v_reason, auth.uid(),
    coalesce(p_notify_customer, true), 'completed', now(), now(), v_new_paid,
    jsonb_build_object('source', 'financial_adjustment')
  ) returning id into v_payment_id;

  update public.orders
  set paid_amount_kobo = v_new_paid,
      payment_status = (case when v_new_paid >= v_total then 'successful' else 'processing' end)::public.payment_status,
      last_admin_activity_at = now()
  where id = p_order_id;

  insert into public.admin_activity_log (admin_user_id, order_id, action, description, metadata)
  values (
    auth.uid(), p_order_id, 'payment_adjusted',
    'Financial adjustment of ' || p_amount_kobo || ' kobo recorded.',
    jsonb_build_object(
      'payment_id', v_payment_id,
      'amount_kobo', p_amount_kobo,
      'reason', v_reason,
      'paid_before_kobo', v_paid,
      'paid_after_kobo', v_new_paid
    )
  );

  if coalesce(p_notify_customer, true) then
    insert into public.notification_events (order_id, customer_id, channel, event_type, status, payload)
    values (
      p_order_id, v_order.customer_id, 'internal', 'payment_adjusted', 'pending',
      jsonb_build_object(
        'reference', v_order.reference,
        'project_title', v_order.project_title,
        'kind', 'adjustment',
        'amount_kobo', p_amount_kobo,
        'reason', v_reason,
        'paid_after_kobo', v_new_paid
      )
    );
  end if;

  return jsonb_build_object(
    'payment_id', v_payment_id,
    'paid_after_kobo', v_new_paid,
    'outstanding_after_kobo', greatest(v_total - v_new_paid, 0)
  );
end;
$$;
