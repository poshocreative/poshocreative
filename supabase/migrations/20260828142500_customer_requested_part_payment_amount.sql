-- Customer-selected part-payment amount workflow.
--
-- The customer proposes an amount for one specific project. Management can
-- approve that exact amount or decline it. Flutterwave checkout remains the
-- authority for collecting and verifying an approved installment.

alter table public.part_payment_requests
  add column if not exists requested_amount_kobo bigint;

update public.part_payment_requests
set requested_amount_kobo = approved_amount_kobo
where requested_amount_kobo is null
  and approved_amount_kobo is not null;

alter table public.part_payment_requests
  drop constraint if exists part_payment_requests_requested_amount_check;

alter table public.part_payment_requests
  add constraint part_payment_requests_requested_amount_check
  check (
    requested_amount_kobo is null
    or requested_amount_kobo > 0
  );

comment on column public.part_payment_requests.requested_amount_kobo is
  'Installment amount proposed by the customer for Management approval.';

create or replace function public.request_project_part_payment(
  p_order_id uuid,
  p_requested_amount_kobo bigint,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_reason text;
  v_outstanding bigint;
  v_result jsonb;
  v_request_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
    and user_id = auth.uid()
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
    coalesce(v_order.quoted_amount_kobo, 0)
      - coalesce(v_order.paid_amount_kobo, 0),
    0
  );

  if v_outstanding <= 0 then
    raise exception 'There is no outstanding project balance.';
  end if;

  if p_requested_amount_kobo is null
     or p_requested_amount_kobo <= 0 then
    raise exception 'Enter the amount you want to pay.';
  end if;

  if p_requested_amount_kobo >= v_outstanding then
    raise exception 'The requested part payment must be lower than the outstanding project balance.';
  end if;

  v_reason := left(trim(coalesce(p_reason, '')), 3000);

  if char_length(v_reason) < 10 then
    v_reason := 'Customer requested a part-payment arrangement.';
  end if;

  -- Reuse the established ownership, project-state, duplicate-request, and
  -- notification logic from the canonical two-argument function.
  v_result := public.request_project_part_payment(
    p_order_id,
    v_reason
  );

  v_request_id := (v_result ->> 'request_id')::uuid;

  update public.part_payment_requests
  set requested_amount_kobo = p_requested_amount_kobo,
      updated_at = now()
  where id = v_request_id;

  update public.notification_events
  set payload = coalesce(payload, '{}'::jsonb) || jsonb_build_object(
    'requested_amount_kobo', p_requested_amount_kobo
  )
  where order_id = p_order_id
    and event_type = 'part_payment_requested'
    and payload ->> 'request_id' = v_request_id::text;

  return v_result || jsonb_build_object(
    'requested_amount_kobo', p_requested_amount_kobo
  );
end;
$$;

create or replace function public.enforce_requested_part_payment_amount()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'approved'
     and old.status = 'pending'
     and old.requested_amount_kobo is not null then
    if new.approved_amount_kobo is distinct from old.requested_amount_kobo then
      raise exception 'Approve the amount requested by the customer or decline the request.';
    end if;

    new.approved_amount_kobo := old.requested_amount_kobo;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_requested_part_payment_amount_trigger
  on public.part_payment_requests;

create trigger enforce_requested_part_payment_amount_trigger
before update of status, approved_amount_kobo
on public.part_payment_requests
for each row
execute function public.enforce_requested_part_payment_amount();

revoke all on function public.request_project_part_payment(uuid, bigint, text)
  from public, anon;

grant execute on function public.request_project_part_payment(uuid, bigint, text)
  to authenticated;

revoke execute on function public.request_project_part_payment(uuid, text)
  from authenticated;

notify pgrst, 'reload schema';
