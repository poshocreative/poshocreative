-- Repair installations where the project-finance migration was recorded but
-- PostgREST cannot see the part-payment relation. This migration is deliberately
-- idempotent so it is safe on installations where the relation already exists.

create table if not exists public.part_payment_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  requested_by uuid references auth.users(id) on delete set null,
  reason text not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'declined', 'expired', 'fulfilled', 'cancelled')),
  approved_amount_kobo bigint
    check (approved_amount_kobo is null or approved_amount_kobo > 0),
  approval_expires_at timestamptz,
  balance_due_at timestamptz,
  allow_work_to_start boolean not null default false,
  admin_note text,
  decline_reason text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  fulfilled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists part_payment_requests_order_created_idx
  on public.part_payment_requests (order_id, created_at desc);

create index if not exists part_payment_requests_status_idx
  on public.part_payment_requests (status, created_at desc);

create unique index if not exists part_payment_requests_one_open_request_idx
  on public.part_payment_requests (order_id)
  where status in ('pending', 'approved');

drop trigger if exists part_payment_requests_set_updated_at
  on public.part_payment_requests;

create trigger part_payment_requests_set_updated_at
before update on public.part_payment_requests
for each row execute function public.set_updated_at();

alter table public.payment_transactions
  add column if not exists part_payment_request_id uuid
  references public.part_payment_requests(id) on delete set null;

alter table public.payment_transactions
  add column if not exists payment_scope text not null default 'full_balance';

alter table public.payment_transactions
  drop constraint if exists payment_transactions_payment_scope_check;

alter table public.payment_transactions
  add constraint payment_transactions_payment_scope_check
  check (payment_scope in ('full_balance', 'approved_installment'));

create index if not exists payment_transactions_part_payment_request_idx
  on public.payment_transactions (part_payment_request_id)
  where part_payment_request_id is not null;

alter table public.part_payment_requests enable row level security;

revoke insert, update, delete on public.part_payment_requests
  from anon, authenticated;
grant select on public.part_payment_requests to authenticated;

drop policy if exists "Customers can read own part payment requests"
  on public.part_payment_requests;
create policy "Customers can read own part payment requests"
  on public.part_payment_requests for select to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = part_payment_requests.order_id
        and o.user_id = auth.uid()
    )
  );

drop policy if exists "Admins can read part payment requests"
  on public.part_payment_requests;
create policy "Admins can read part payment requests"
  on public.part_payment_requests for select to authenticated
  using (public.has_admin_access());

create or replace function public.request_project_part_payment(
  p_order_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_reason text;
  v_request_id uuid;
  v_outstanding bigint;
  v_now timestamptz := now();
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  v_reason := left(trim(coalesce(p_reason, '')), 3000);
  if char_length(v_reason) < 10 then
    raise exception 'Please explain why you are requesting a part-payment arrangement.';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id and user_id = auth.uid()
  for update;

  if not found then
    raise exception 'Project could not be found.' using errcode = '42501';
  end if;
  if v_order.review_decision <> 'approved' then
    raise exception 'Part payment can only be requested for an approved project.';
  end if;
  if v_order.status in ('completed', 'cancelled') then
    raise exception 'This project is not open for a part-payment request.';
  end if;

  v_outstanding := greatest(
    coalesce(v_order.quoted_amount_kobo, 0) - coalesce(v_order.paid_amount_kobo, 0),
    0
  );
  if v_outstanding <= 0 then
    raise exception 'There is no outstanding project balance.';
  end if;

  update public.part_payment_requests
  set status = 'expired', updated_at = v_now
  where order_id = v_order.id
    and status = 'approved'
    and approval_expires_at is not null
    and approval_expires_at <= v_now;

  if exists (
    select 1 from public.part_payment_requests
    where order_id = v_order.id and status in ('pending', 'approved')
  ) then
    raise exception 'This project already has an active part-payment request.';
  end if;

  insert into public.part_payment_requests (
    order_id, customer_id, requested_by, reason, status
  ) values (
    v_order.id, v_order.customer_id, auth.uid(), v_reason, 'pending'
  ) returning id into v_request_id;

  insert into public.notification_events (
    order_id, customer_id, channel, event_type, status, payload
  ) values (
    v_order.id,
    v_order.customer_id,
    'internal',
    'part_payment_requested',
    'pending',
    jsonb_build_object(
      'reference', v_order.reference,
      'project_title', v_order.project_title,
      'request_id', v_request_id,
      'message', 'Your part-payment request has been submitted for Management review.'
    )
  );

  return jsonb_build_object(
    'success', true,
    'request_id', v_request_id,
    'status', 'pending',
    'outstanding_balance_kobo', v_outstanding
  );
end;
$$;

create or replace function public.admin_review_part_payment(
  p_request_id uuid,
  p_decision text,
  p_approved_amount_kobo bigint default null,
  p_approval_expires_at timestamptz default null,
  p_balance_due_at timestamptz default null,
  p_admin_note text default null,
  p_allow_work_to_start boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.part_payment_requests%rowtype;
  v_order public.orders%rowtype;
  v_decision text := lower(trim(coalesce(p_decision, '')));
  v_note text := nullif(left(trim(coalesce(p_admin_note, '')), 3000), '');
  v_outstanding bigint;
  v_now timestamptz := now();
  v_expiry timestamptz;
  v_balance_due timestamptz;
begin
  if not public.has_admin_access() then
    raise exception 'Administrative access is required.' using errcode = '42501';
  end if;
  if v_decision not in ('approve', 'decline') then
    raise exception 'Choose Approve or Decline.';
  end if;

  select * into v_request
  from public.part_payment_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Part-payment request could not be found.';
  end if;
  if v_request.status <> 'pending' then
    raise exception 'This request has already been reviewed.';
  end if;

  select * into v_order from public.orders
  where id = v_request.order_id
  for update;

  if not found then
    raise exception 'Project could not be found.';
  end if;

  v_outstanding := greatest(
    coalesce(v_order.quoted_amount_kobo, 0) - coalesce(v_order.paid_amount_kobo, 0),
    0
  );
  if v_outstanding <= 0 then
    raise exception 'There is no outstanding balance on this project.';
  end if;

  if v_decision = 'decline' then
    if char_length(coalesce(v_note, '')) < 5 then
      raise exception 'Provide a clear reason for declining this request.';
    end if;

    update public.part_payment_requests
    set status = 'declined',
        decline_reason = v_note,
        admin_note = v_note,
        reviewed_by = auth.uid(),
        reviewed_at = v_now,
        updated_at = v_now
    where id = v_request.id;

    insert into public.notification_events (
      order_id, customer_id, channel, event_type, status, payload
    ) values (
      v_order.id,
      v_order.customer_id,
      'internal',
      'part_payment_declined',
      'pending',
      jsonb_build_object(
        'reference', v_order.reference,
        'project_title', v_order.project_title,
        'request_id', v_request.id,
        'reason', v_note
      )
    );

    return jsonb_build_object('success', true, 'status', 'declined');
  end if;

  if p_approved_amount_kobo is null or p_approved_amount_kobo <= 0 then
    raise exception 'Enter the installment amount Management is approving.';
  end if;
  if p_approved_amount_kobo >= v_outstanding then
    raise exception 'A part-payment installment must be lower than the full outstanding balance.';
  end if;

  v_expiry := coalesce(p_approval_expires_at, v_now + interval '7 days');
  if v_expiry <= v_now then
    raise exception 'The part-payment approval expiry must be in the future.';
  end if;

  v_balance_due := coalesce(p_balance_due_at, v_expiry + interval '30 days');
  if v_balance_due < v_expiry then
    raise exception 'The remaining-balance due date cannot be earlier than the installment approval expiry.';
  end if;

  update public.part_payment_requests
  set status = 'approved',
      approved_amount_kobo = p_approved_amount_kobo,
      approval_expires_at = v_expiry,
      balance_due_at = v_balance_due,
      allow_work_to_start = coalesce(p_allow_work_to_start, false),
      admin_note = v_note,
      decline_reason = null,
      reviewed_by = auth.uid(),
      reviewed_at = v_now,
      updated_at = v_now
  where id = v_request.id;

  update public.orders
  set customer_action_required = true,
      customer_action_label = 'Part-payment installment approved',
      last_admin_activity_at = v_now
  where id = v_order.id;

  insert into public.notification_events (
    order_id, customer_id, channel, event_type, status, payload
  ) values (
    v_order.id,
    v_order.customer_id,
    'internal',
    'part_payment_approved',
    'pending',
    jsonb_build_object(
      'reference', v_order.reference,
      'project_title', v_order.project_title,
      'request_id', v_request.id,
      'approved_amount_kobo', p_approved_amount_kobo,
      'approval_expires_at', v_expiry,
      'balance_due_at', v_balance_due,
      'allow_work_to_start', coalesce(p_allow_work_to_start, false),
      'message', v_note
    )
  );

  return jsonb_build_object(
    'success', true,
    'status', 'approved',
    'approved_amount_kobo', p_approved_amount_kobo,
    'approval_expires_at', v_expiry,
    'balance_due_at', v_balance_due
  );
end;
$$;

create or replace function public.handle_verified_part_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.part_payment_requests%rowtype;
begin
  if new.part_payment_request_id is null
     or new.status <> 'successful'
     or old.status = 'successful' then
    return new;
  end if;

  select * into v_request
  from public.part_payment_requests
  where id = new.part_payment_request_id
  for update;

  if found and v_request.status = 'approved' then
    update public.part_payment_requests
    set status = 'fulfilled', fulfilled_at = now(), updated_at = now()
    where id = v_request.id;
  end if;

  return new;
end;
$$;

drop trigger if exists verified_part_payment_trigger
  on public.payment_transactions;
create trigger verified_part_payment_trigger
after update of status on public.payment_transactions
for each row
when (
  new.status = 'successful'
  and old.status is distinct from new.status
  and new.part_payment_request_id is not null
)
execute function public.handle_verified_part_payment();

revoke all on function public.request_project_part_payment(uuid, text)
  from public, anon;
grant execute on function public.request_project_part_payment(uuid, text)
  to authenticated;

revoke all on function public.admin_review_part_payment(
  uuid, text, bigint, timestamptz, timestamptz, text, boolean
) from public, anon;
grant execute on function public.admin_review_part_payment(
  uuid, text, bigint, timestamptz, timestamptz, text, boolean
) to authenticated;

comment on table public.part_payment_requests is
  'Customer requests and Management approvals for controlled project installment payments.';

-- Ask PostgREST to rebuild its relation/function cache immediately after commit.
notify pgrst, 'reload schema';
