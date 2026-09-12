-- ============================================================
-- PROJECT FINANCE ADJUSTMENTS
-- Two audited admin capabilities backed by immutable ledgers:
--   1. External payments  (client paid outside the website)
--   2. Project price reductions (contract value lowered by Management)
-- Money rules live in security-definer RPCs only. The frontend
-- never writes financial totals directly.
-- ============================================================

-- ------------------------------------------------------------
-- 1. PAYMENT SCOPE: recognise external payments distinctly
-- ------------------------------------------------------------

alter table public.payment_transactions
  drop constraint if exists payment_transactions_payment_scope_check;

alter table public.payment_transactions
  add constraint payment_transactions_payment_scope_check
  check (
    payment_scope is null or payment_scope in (
      'full_balance',
      'approved_installment',
      'manual_payment',
      'external_payment',
      'adjustment',
      'reversal',
      'additional_cost'
    )
  );

comment on column public.payment_transactions.payment_scope is
  'What this payment applies to. external_payment = admin-recorded off-platform receipt, kept separate from Flutterwave rows.';

-- ------------------------------------------------------------
-- 2. PRICE ADJUSTMENT LEDGER (immutable, append-only)
-- ------------------------------------------------------------

create table if not exists public.project_price_adjustments (
  id uuid primary key default gen_random_uuid(),

  order_id uuid not null
    references public.orders(id)
    on delete cascade,

  previous_total_kobo bigint not null check (previous_total_kobo >= 0),
  new_total_kobo bigint not null check (new_total_kobo > 0),
  adjustment_kobo bigint not null,

  previous_base_kobo bigint not null default 0 check (previous_base_kobo >= 0),
  new_base_kobo bigint not null default 0 check (new_base_kobo >= 0),

  reason text not null,

  recorded_by uuid null
    references auth.users(id)
    on delete set null,

  created_at timestamptz not null default now(),

  check (new_total_kobo < previous_total_kobo)
);

comment on table public.project_price_adjustments is
  'Immutable ledger of Management-approved project price reductions. Original and intermediate prices are preserved here forever; orders.quoted_amount_kobo only ever holds the current live total.';

create index if not exists project_price_adjustments_order_idx
  on public.project_price_adjustments (order_id, created_at);

alter table public.project_price_adjustments enable row level security;

drop policy if exists "price_adjustments_admin_all" on public.project_price_adjustments;
create policy "price_adjustments_admin_all"
  on public.project_price_adjustments
  for select
  to authenticated
  using (public.has_admin_access());

drop policy if exists "price_adjustments_team_read" on public.project_price_adjustments;
create policy "price_adjustments_team_read"
  on public.project_price_adjustments
  for select
  to authenticated
  using (public.has_capability('finance.manage'));

drop policy if exists "price_adjustments_customer_read" on public.project_price_adjustments;
create policy "price_adjustments_customer_read"
  on public.project_price_adjustments
  for select
  to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = project_price_adjustments.order_id
        and o.user_id = auth.uid()
    )
  );

-- No insert / update / delete policies: rows are written only by the
-- security-definer RPC below, so history can never be edited or removed.

-- ------------------------------------------------------------
-- 3. RECORD EXTERNAL PAYMENT (security definer)
-- Off-platform receipts: bank transfer, cash, POS, external transfer.
-- Distinct scope + reference prefix keep them separate from
-- Flutterwave rows while sharing the manual ledger mechanics
-- (recalc, reversal, balance_after) with the existing system.
-- ------------------------------------------------------------

create or replace function public.admin_record_external_payment(
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
  v_note text;
begin
  if public.has_admin_access() is not true then
    raise exception 'Administrative access is required.';
  end if;

  if p_amount_kobo is null or p_amount_kobo <= 0 then
    raise exception 'Enter a valid payment amount greater than zero.';
  end if;

  v_method := lower(trim(coalesce(p_method, '')));
  if v_method not in ('bank_transfer', 'cash', 'pos', 'external_transfer', 'other') then
    raise exception 'Choose a valid external payment method.';
  end if;

  v_note := nullif(trim(coalesce(p_note, '')), '');
  if v_note is null or char_length(v_note) < 10 then
    raise exception 'Record a clear note (at least 10 characters) describing this external payment.';
  end if;
  if char_length(v_note) > 3000 then
    raise exception 'The payment note is too long.';
  end if;

  v_ref := nullif(trim(coalesce(p_reference, '')), '');
  if v_ref is not null and char_length(v_ref) > 160 then
    raise exception 'The payment reference is too long.';
  end if;

  -- Idempotency across both off-platform scopes so the same bank
  -- reference cannot be recorded twice through either action.
  if v_ref is not null and exists (
    select 1 from public.payment_transactions
    where order_id = p_order_id
      and payment_type = 'manual'
      and lower(coalesce(manual_reference, '')) = lower(v_ref)
      and status = 'successful'
      and coalesce(is_reversed, false) = false
  ) then
    raise exception 'A payment with this reference already exists for this project.';
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
    raise exception 'The recorded amount exceeds the outstanding balance. Reduce the project price first if the total changed.';
  end if;
  v_new_paid := v_paid + p_amount_kobo;

  insert into public.payment_transactions (
    order_id, provider, provider_reference, amount_kobo, base_amount_kobo,
    currency, status, payment_scope, payment_type, payment_method,
    manual_method, manual_reference, manual_note, recorded_by,
    notify_customer, attempt_stage, verified_at, completed_at,
    balance_after_kobo, payment_metadata
  ) values (
    p_order_id, 'manual',
    'EXTERNAL-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16)),
    p_amount_kobo, p_amount_kobo,
    coalesce(v_order.currency, 'NGN'), 'successful', 'external_payment', 'manual',
    v_method, v_method, v_ref, v_note,
    auth.uid(), coalesce(p_notify_customer, true), 'completed',
    coalesce(p_received_at, now()), now(), v_new_paid,
    jsonb_build_object(
      'source', 'external_payment',
      'received_at', coalesce(p_received_at, now()),
      'recorded_via', 'admin_record_external_payment'
    )
  ) returning id into v_payment_id;

  update public.orders
  set paid_amount_kobo = v_new_paid,
    payment_status = case when v_new_paid >= v_total then 'successful' else 'processing' end,
    customer_action_required = v_new_paid < v_total,
    customer_action_label = case when v_new_paid >= v_total then null
      else 'Payment received — remaining balance outstanding' end,
    last_admin_activity_at = now()
  where id = p_order_id;

  insert into public.admin_activity_log (admin_user_id, order_id, action, description, metadata)
  values (
    auth.uid(), p_order_id, 'external_payment_recorded',
    'External payment of ' || p_amount_kobo || ' kobo recorded (' || v_method || ').',
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
      p_order_id, v_order.customer_id, 'internal', 'external_payment_recorded', 'pending',
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

revoke all on function public.admin_record_external_payment(uuid, bigint, text, text, text, timestamptz, boolean) from anon, authenticated;
grant execute on function public.admin_record_external_payment(uuid, bigint, text, text, text, timestamptz, boolean) to authenticated;

comment on function public.admin_record_external_payment(uuid, bigint, text, text, text, timestamptz, boolean) is
  'Records an off-platform (bank transfer, cash, POS) receipt as an immutable manual-ledger entry with the external_payment scope. Never touches Flutterwave rows.';

-- ------------------------------------------------------------
-- 4. REDUCE PROJECT PRICE (security definer, owner-level)
-- Lowers the agreed project total while preserving every
-- historical price in project_price_adjustments. The new total
-- can never drop below confirmed paid, and additional costs
-- are preserved by shrinking the base price, never the extras.
-- ------------------------------------------------------------

create or replace function public.admin_adjust_project_price(
  p_order_id uuid,
  p_new_total_kobo bigint,
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
  v_current_total bigint;
  v_current_base bigint;
  v_paid bigint;
  v_extras bigint;
  v_new_base bigint;
  v_reason text;
  v_adjustment_id uuid;
begin
  if public.has_admin_access() is not true then
    raise exception 'Administrative access is required.';
  end if;

  select * into v_order from public.orders where id = p_order_id;
  if not found then
    raise exception 'Project could not be found.';
  end if;
  if v_order.review_decision is distinct from 'approved' then
    raise exception 'Only approved projects can have their price adjusted.';
  end if;
  if v_order.archived_at is not null then
    raise exception 'Archived projects cannot have their price adjusted. Restore the project first.';
  end if;
  if v_order.status = 'cancelled' then
    raise exception 'The price of a cancelled project cannot be adjusted.';
  end if;

  v_current_total := coalesce(v_order.quoted_amount_kobo, 0);
  if v_current_total <= 0 then
    raise exception 'Set the project price before adjusting it.';
  end if;

  if p_new_total_kobo is null or p_new_total_kobo <= 0 then
    raise exception 'Enter a valid new project total greater than zero.';
  end if;

  v_reason := nullif(trim(coalesce(p_reason, '')), '');
  if v_reason is null or char_length(v_reason) < 10 then
    raise exception 'Provide a clear reason (at least 10 characters) for this price change.';
  end if;
  if char_length(v_reason) > 2000 then
    raise exception 'The reason is too long.';
  end if;

  v_paid := public.recalc_project_paid(p_order_id);

  if p_new_total_kobo >= v_current_total then
    raise exception 'The new total must be lower than the current project total. Use Additional Project Costs for increases.';
  end if;

  if p_new_total_kobo < v_paid then
    raise exception 'The new total cannot be below the confirmed paid amount. Paid to date is already locked in.';
  end if;

  select coalesce(sum(amount_kobo), 0) into v_extras
  from public.project_cost_items
  where order_id = p_order_id and status = 'active';

  v_current_base := coalesce(v_order.base_project_price_kobo, greatest(v_current_total - v_extras, 0));
  v_new_base := p_new_total_kobo - v_extras;
  if v_new_base < 0 then
    raise exception 'Active additional costs already exceed the proposed total. Waive costs before reducing the price this far.';
  end if;

  -- Bypass the quoted-total guard: this RPC is the audited path.
  perform set_config('posho.finance_write', '1', true);

  insert into public.project_price_adjustments (
    order_id, previous_total_kobo, new_total_kobo,
    adjustment_kobo, previous_base_kobo, new_base_kobo,
    reason, recorded_by
  ) values (
    p_order_id, v_current_total, p_new_total_kobo,
    p_new_total_kobo - v_current_total, v_current_base, v_new_base,
    v_reason, auth.uid()
  ) returning id into v_adjustment_id;

  update public.orders
  set base_project_price_kobo = v_new_base,
    quoted_amount_kobo = p_new_total_kobo,
    payment_status = case
      when v_paid >= p_new_total_kobo then 'successful'
      when v_paid > 0 then 'processing'
      else 'pending'
    end,
    customer_action_required = p_new_total_kobo > v_paid,
    customer_action_label = case when p_new_total_kobo > v_paid then
      'Project price updated — remaining balance outstanding' else null end,
    last_admin_activity_at = now()
  where id = p_order_id;

  insert into public.admin_activity_log (admin_user_id, order_id, action, description, metadata)
  values (
    auth.uid(), p_order_id, 'project_price_adjusted',
    'Project total reduced from ' || v_current_total || ' kobo to ' || p_new_total_kobo || ' kobo.',
    jsonb_build_object(
      'adjustment_id', v_adjustment_id,
      'previous_total_kobo', v_current_total,
      'new_total_kobo', p_new_total_kobo,
      'adjustment_kobo', p_new_total_kobo - v_current_total,
      'previous_base_kobo', v_current_base,
      'new_base_kobo', v_new_base,
      'active_extras_kobo', v_extras,
      'paid_kobo', v_paid,
      'outstanding_after_kobo', greatest(p_new_total_kobo - v_paid, 0),
      'reason', v_reason
    )
  );

  if coalesce(p_notify_customer, true) then
    insert into public.notification_events (order_id, customer_id, channel, event_type, status, payload)
    values (
      p_order_id, v_order.customer_id, 'internal', 'project_price_adjusted', 'pending',
      jsonb_build_object(
        'reference', v_order.reference,
        'project_title', v_order.project_title,
        'previous_total_kobo', v_current_total,
        'new_total_kobo', p_new_total_kobo,
        'reason', v_reason,
        'outstanding_after_kobo', greatest(p_new_total_kobo - v_paid, 0)
      )
    );
  end if;

  return jsonb_build_object(
    'adjustment_id', v_adjustment_id,
    'previous_total_kobo', v_current_total,
    'new_total_kobo', p_new_total_kobo,
    'adjustment_kobo', p_new_total_kobo - v_current_total,
    'paid_kobo', v_paid,
    'outstanding_after_kobo', greatest(p_new_total_kobo - v_paid, 0),
    'fully_paid', v_paid >= p_new_total_kobo
  );
end;
$$;

revoke all on function public.admin_adjust_project_price(uuid, bigint, text, boolean) from anon, authenticated;
grant execute on function public.admin_adjust_project_price(uuid, bigint, text, boolean) to authenticated;

comment on function public.admin_adjust_project_price(uuid, bigint, text, boolean) is
  'Owner-level project price reduction. Preserves every historical price in project_price_adjustments; the new total can never fall below confirmed paid.';
