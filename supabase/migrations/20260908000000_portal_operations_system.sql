-- ============================================================
-- POSHO CREATIVE — PORTAL OPERATIONS SYSTEM (LOCAL MIGRATION)
-- Evolves the existing schema. Does NOT recreate tables.
-- DO NOT APPLY REMOTELY without explicit owner authorization.
--
-- Contents:
--  1. orders lifecycle columns (archive / soft-delete)
--  2. payment ledger columns (manual / adjustment / reversal)
--  3. payment_scope extension (full_balance, approved_installment,
--     manual_payment, adjustment, reversal, additional_cost)
--  4. project payment milestones (future payment schedules)
--  5. project deletion tombstones (audit before destructive delete)
--  6. paid-amount recalculation helper (provider + manual ledger)
--  7. manual payment / reversal / adjustment RPCs (admin-only)
--  8. archive / restore RPCs (admin-only)
--  9. part-payment review flexibility (admin may choose a different
--     installment from the requested amount; must stay < outstanding)
-- ============================================================

-- ------------------------------------------------------------
-- 1. ORDERS LIFECYCLE
-- ------------------------------------------------------------

alter table public.orders
  add column if not exists archived_at timestamptz null,
  add column if not exists archived_by uuid null references auth.users(id) on delete set null,
  add column if not exists deletion_reason text null;

create index if not exists orders_archived_at_idx
  on public.orders (archived_at)
  where archived_at is not null;

create index if not exists orders_active_review_idx
  on public.orders (review_decision, status)
  where archived_at is null;

comment on column public.orders.archived_at is
  'Soft-delete timestamp. Archived projects are hidden from normal active views but remain restorable.';
comment on column public.orders.deletion_reason is
  'Human-readable reason supplied by Management for archive or permanent-delete request.';

-- ------------------------------------------------------------
-- 2. PAYMENT LEDGER COLUMNS (single source of truth extension)
-- Provider rows keep provider verification. Manual rows are
-- admin-recorded financial events. Nothing mutates across types.
-- ------------------------------------------------------------

alter table public.payment_transactions
  add column if not exists payment_type text not null default 'provider',
  add column if not exists recorded_by uuid null references auth.users(id) on delete set null,
  add column if not exists manual_method text null,
  add column if not exists manual_reference text null,
  add column if not exists manual_note text null,
  add column if not exists related_payment_id uuid null references public.payment_transactions(id) on delete set null,
  add column if not exists is_reversed boolean not null default false,
  add column if not exists reversed_at timestamptz null,
  add column if not exists reversal_reason text null,
  add column if not exists balance_after_kobo bigint null,
  add column if not exists notify_customer boolean not null default true;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'payment_transactions_payment_type_check'
  ) then
    alter table public.payment_transactions
      add constraint payment_transactions_payment_type_check
      check (payment_type in ('provider', 'manual', 'adjustment', 'reversal'));
  end if;
end $$;

create index if not exists payment_transactions_ledger_idx
  on public.payment_transactions (order_id, status, payment_type)
  where is_reversed = false;

create index if not exists payment_transactions_related_idx
  on public.payment_transactions (related_payment_id)
  where related_payment_id is not null;

comment on column public.payment_transactions.payment_type is
  'provider = Flutterwave-verified. manual = admin-recorded off-platform payment. adjustment = signed correction. reversal = negation of a prior manual entry.';
comment on column public.payment_transactions.balance_after_kobo is
  'Project confirmed-paid snapshot immediately after this ledger entry was applied.';

-- ------------------------------------------------------------
-- 3. PAYMENT SCOPE EXTENSION
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
      'adjustment',
      'reversal',
      'additional_cost'
    )
  );

comment on column public.payment_transactions.payment_scope is
  'What this payment applies to. Installment scope links via part_payment_request_id.';

-- Manual rows do not need provider references; provider rows still do.
-- (No tightening here — older rows remain valid.)

-- ------------------------------------------------------------
-- 4. PAYMENT MILESTONES / SCHEDULE (future-ready)
-- ------------------------------------------------------------

create table if not exists public.project_payment_milestones (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  title text not null,
  description text null,
  amount_kobo bigint not null check (amount_kobo > 0),
  due_at timestamptz null,
  status text not null default 'pending'
    check (status in ('pending', 'due', 'paid', 'overdue', 'cancelled')),
  paid_at timestamptz null,
  payment_reference text null,
  sequence integer not null default 0,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists project_payment_milestones_order_idx
  on public.project_payment_milestones (order_id, sequence);

alter table public.project_payment_milestones enable row level security;

drop policy if exists "milestones_admin_all" on public.project_payment_milestones;
create policy "milestones_admin_all"
  on public.project_payment_milestones
  for all
  to authenticated
  using (public.has_admin_access())
  with check (public.has_admin_access());

drop policy if exists "milestones_customer_read" on public.project_payment_milestones;
create policy "milestones_customer_read"
  on public.project_payment_milestones
  for select
  to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = project_payment_milestones.order_id
        and o.user_id = auth.uid()
    )
  );

comment on table public.project_payment_milestones is
  'Optional staged payment schedule per project. Current amount-due logic prefers approved part-payment installments; milestones describe what comes next.';

-- keep updated_at fresh
drop trigger if exists project_payment_milestones_updated on public.project_payment_milestones;
create trigger project_payment_milestones_updated
  before update on public.project_payment_milestones
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 5. DELETION TOMBSTONES
-- ------------------------------------------------------------

create table if not exists public.project_deletion_log (
  id uuid primary key default gen_random_uuid(),
  order_id uuid null,
  reference text not null,
  project_title text null,
  customer_id uuid null,
  customer_email text null,
  total_value_kobo bigint not null default 0,
  confirmed_paid_kobo bigint not null default 0,
  payments_count integer not null default 0,
  files_count integer not null default 0,
  deletion_kind text not null check (deletion_kind in ('archive', 'restore', 'permanent_delete')),
  reason text not null,
  deleted_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.project_deletion_log enable row level security;

drop policy if exists "deletion_log_admin_read" on public.project_deletion_log;
create policy "deletion_log_admin_read"
  on public.project_deletion_log
  for select
  to authenticated
  using (public.has_admin_access());

comment on table public.project_deletion_log is
  'Immutable tombstone written before archive/restore/permanent-delete so financial history is never silently destroyed.';

-- ------------------------------------------------------------
-- 6. PAID RECALCULATION HELPER
-- Confirmed paid = provider successful (not reversed)
--   + manual successful (not reversed)
--   + signed adjustments (successful, not reversed)
-- Reversal rows themselves carry 0 credit; they flip is_reversed
-- on the original row instead of deleting history.
-- ------------------------------------------------------------

create or replace function public.recalc_project_paid(p_order_id uuid)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total bigint := 0;
begin
  select coalesce(sum(
    case
      when pt.payment_type = 'adjustment' then pt.amount_kobo
      when pt.payment_type = 'reversal' then 0
      else coalesce(pt.base_amount_kobo, pt.amount_kobo, 0)
    end
  ), 0)
  into v_total
  from public.payment_transactions pt
  where pt.order_id = p_order_id
    and pt.status = 'successful'
    and coalesce(pt.is_reversed, false) = false
    and pt.payment_type in ('provider', 'manual', 'adjustment');

  return greatest(v_total, 0);
end;
$$;

revoke all on function public.recalc_project_paid(uuid) from anon, authenticated;

comment on function public.recalc_project_paid(uuid) is
  'Single source of truth for confirmed paid. Sums valid ledger credits (provider base amounts + manuals + signed adjustments), excluding reversed entries.';

-- ------------------------------------------------------------
-- 7a. ADMIN RECORD MANUAL PAYMENT
-- ------------------------------------------------------------

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

  -- Idempotency: same order + same manual reference must not double-post.
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
    raise exception 'The recorded amount (%) exceeds the outstanding balance (%). Record an adjustment workflow if the total changed.', p_amount_kobo, v_outstanding;
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
      payment_status = case when v_new_paid >= v_total then 'successful' else 'processing' end,
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

revoke all on function public.admin_record_manual_payment(uuid, bigint, text, text, text, timestamptz, boolean) from anon, authenticated;
grant execute on function public.admin_record_manual_payment(uuid, bigint, text, text, text, timestamptz, boolean) to authenticated;

-- ------------------------------------------------------------
-- 7b. ADMIN REVERSE MANUAL PAYMENT (never deletes history)
-- ------------------------------------------------------------

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
    raise exception 'Provider-verified payments cannot be reversed from here. Provider transactions remain provider controlled.';
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
      payment_status = case when v_total > 0 and v_new_paid >= v_total then 'successful' else 'processing' end,
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

revoke all on function public.admin_reverse_payment(uuid, text) from anon, authenticated;
grant execute on function public.admin_reverse_payment(uuid, text) to authenticated;

-- ------------------------------------------------------------
-- 7c. ADMIN FINANCIAL ADJUSTMENT (signed correction)
-- ------------------------------------------------------------

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
    raise exception 'This adjustment would take confirmed payments above the project value. Adjust the project value first.';
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
      payment_status = case when v_new_paid >= v_total then 'successful' else 'processing' end,
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

revoke all on function public.admin_adjust_payment(uuid, bigint, text, boolean) from anon, authenticated;
grant execute on function public.admin_adjust_payment(uuid, bigint, text, boolean) to authenticated;

-- ------------------------------------------------------------
-- 8. ARCHIVE / RESTORE (admin-only, tombstoned)
-- ------------------------------------------------------------

create or replace function public.admin_archive_project(p_order_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_reason text;
  v_payments integer;
  v_files integer;
begin
  if public.has_admin_access() is not true then
    raise exception 'Administrative access is required.';
  end if;

  v_reason := nullif(trim(coalesce(p_reason, '')), '');
  if v_reason is null or char_length(v_reason) < 5 then
    raise exception 'Provide a reason before archiving this project.';
  end if;

  select * into v_order from public.orders where id = p_order_id;
  if not found then
    raise exception 'Project could not be found.';
  end if;

  if v_order.archived_at is not null then
    return jsonb_build_object('already_archived', true);
  end if;

  select count(*)::int into v_payments
  from public.payment_transactions
  where order_id = p_order_id and status = 'successful';

  select count(*)::int into v_files
  from public.order_files where order_id = p_order_id;

  update public.orders
  set archived_at = now(), archived_by = auth.uid(), deletion_reason = v_reason
  where id = p_order_id;

  insert into public.project_deletion_log (
    order_id, reference, project_title, customer_id,
    total_value_kobo, confirmed_paid_kobo, payments_count, files_count,
    deletion_kind, reason, deleted_by
  ) values (
    p_order_id, v_order.reference, v_order.project_title, v_order.customer_id,
    coalesce(v_order.quoted_amount_kobo, 0), coalesce(v_order.paid_amount_kobo, 0),
    v_payments, v_files, 'archive', v_reason, auth.uid()
  );

  insert into public.admin_activity_log (admin_user_id, order_id, action, description, metadata)
  values (
    auth.uid(), p_order_id, 'project_archived',
    'Project ' || v_order.reference || ' archived.',
    jsonb_build_object('reason', v_reason, 'payments', v_payments, 'files', v_files)
  );

  return jsonb_build_object('archived', true);
end;
$$;

revoke all on function public.admin_archive_project(uuid, text) from anon, authenticated;
grant execute on function public.admin_archive_project(uuid, text) to authenticated;

create or replace function public.admin_restore_project(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
begin
  if public.has_admin_access() is not true then
    raise exception 'Administrative access is required.';
  end if;

  select * into v_order from public.orders where id = p_order_id;
  if not found then
    raise exception 'Project could not be found.';
  end if;

  if v_order.archived_at is null then
    return jsonb_build_object('already_active', true);
  end if;

  update public.orders
  set archived_at = null, archived_by = null, deletion_reason = null
  where id = p_order_id;

  insert into public.project_deletion_log (
    order_id, reference, project_title, customer_id,
    total_value_kobo, confirmed_paid_kobo,
    deletion_kind, reason, deleted_by
  ) values (
    p_order_id, v_order.reference, v_order.project_title, v_order.customer_id,
    coalesce(v_order.quoted_amount_kobo, 0), coalesce(v_order.paid_amount_kobo, 0),
    'restore', 'Restored to the active workspace.', auth.uid()
  );

  insert into public.admin_activity_log (admin_user_id, order_id, action, description, metadata)
  values (
    auth.uid(), p_order_id, 'project_restored',
    'Project ' || v_order.reference || ' restored.',
    jsonb_build_object()
  );

  return jsonb_build_object('restored', true);
end;
$$;

revoke all on function public.admin_restore_project(uuid) from anon, authenticated;
grant execute on function public.admin_restore_project(uuid) to authenticated;

-- ------------------------------------------------------------
-- 9. PART-PAYMENT REVIEW FLEXIBILITY
-- Management may approve a DIFFERENT installment from the
-- requested amount (e.g. requested 70k, approve 90k).
-- Constraint: approved must be > 0 and < outstanding.
-- ------------------------------------------------------------

drop trigger if exists enforce_requested_part_payment_amount_trigger on public.part_payment_requests;

create or replace function public.validate_part_payment_approval()
returns trigger
language plpgsql
as $$
declare
  v_total bigint;
  v_paid bigint;
  v_outstanding bigint;
begin
  if new.status = 'approved' and old.status = 'pending' then
    if new.approved_amount_kobo is null or new.approved_amount_kobo <= 0 then
      raise exception 'Approve a valid installment amount greater than zero.';
    end if;

    select coalesce(quoted_amount_kobo, 0), coalesce(paid_amount_kobo, 0)
    into v_total, v_paid
    from public.orders where id = new.order_id;

    v_outstanding := greatest(v_total - v_paid, 0);

    if v_outstanding <= 0 then
      raise exception 'There is no outstanding balance for this project.';
    end if;

    -- Matches admin_review_part_payment: an installment must be lower
    -- than the full outstanding balance (full payment covers equality).
    if new.approved_amount_kobo >= v_outstanding then
      raise exception 'A part-payment installment must be lower than the full outstanding balance. Use full payment instead.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_part_payment_approval_trigger on public.part_payment_requests;
create trigger validate_part_payment_approval_trigger
  before update of status, approved_amount_kobo on public.part_payment_requests
  for each row execute function public.validate_part_payment_approval();

-- Hide archived projects from the customer workspace by default.
-- (Existing RLS policies remain; application queries also filter
--  archived_at IS NULL. This index keeps those queries fast.)
drop index if exists orders_customer_active_idx;
create index if not exists orders_customer_active_idx
  on public.orders (user_id, created_at desc)
  where archived_at is null;

-- Reload PostgREST schema cache.
notify pgrst, 'reload schema';
