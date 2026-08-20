-- ============================================================
-- POSHO CREATIVE
-- ORDER REVIEW WORKFLOW
--
-- Every new customer request must be reviewed by Management
-- before payment or production begins.
-- ============================================================

-- ============================================================
-- REVIEW STATE
-- ============================================================

alter table public.orders
add column if not exists review_decision text
not null
default 'pending';

alter table public.orders
drop constraint if exists orders_review_decision_check;

alter table public.orders
add constraint orders_review_decision_check
check (
  review_decision in (
    'pending',
    'approved',
    'declined'
  )
);

alter table public.orders
add column if not exists reviewed_at timestamptz;

alter table public.orders
add column if not exists reviewed_by uuid
references auth.users(id)
on delete set null;

alter table public.orders
add column if not exists decline_reason text;

create index if not exists
orders_review_decision_idx
on public.orders (
  review_decision
);

create index if not exists
orders_reviewed_at_idx
on public.orders (
  reviewed_at desc
);

-- ============================================================
-- BACKFILL EXISTING PRODUCTION ORDERS
--
-- Existing projects which already progressed beyond review
-- must not suddenly become blocked after this deployment.
-- ============================================================

update public.orders
set
  review_decision =
    case
      when status = 'new'
        then 'pending'

      when status = 'under_review'
        and current_quote_id is null
        and coalesce(
          paid_amount_kobo,
          0
        ) = 0
        then 'pending'

      else 'approved'
    end,

  reviewed_at =
    case
      when status = 'new'
        then null

      when status = 'under_review'
        and current_quote_id is null
        and coalesce(
          paid_amount_kobo,
          0
        ) = 0
        then null

      else coalesce(
        last_admin_activity_at,
        updated_at,
        created_at
      )
    end;

-- ============================================================
-- NEW ORDER REVIEW GATE
--
-- This is intentionally database-side.
-- Even if another client creates an order later,
-- every new request begins in review.
-- ============================================================

create or replace function
public.prepare_new_order_for_management_review()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.review_decision :=
    'pending';

  new.reviewed_at :=
    null;

  new.reviewed_by :=
    null;

  new.decline_reason :=
    null;

  new.status :=
    'new';

  new.payment_status :=
    'pending';

  new.quoted_amount_kobo :=
    null;

  new.current_quote_id :=
    null;

  new.customer_action_required :=
    false;

  new.customer_action_label :=
    null;

  return new;
end;
$$;

drop trigger if exists
orders_require_management_review
on public.orders;

create trigger
orders_require_management_review
before insert
on public.orders
for each row
execute function
public.prepare_new_order_for_management_review();

comment on column
public.orders.review_decision is
'Management review state for a customer project request.';

comment on column
public.orders.decline_reason is
'Professional customer-facing reason when Management declines a project request.';