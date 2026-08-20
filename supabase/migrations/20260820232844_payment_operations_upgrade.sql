-- ============================================================
-- POSHO CREATIVE
-- PAYMENT OPERATIONS UPGRADE
-- ============================================================

-- ============================================================
-- NORMALISED PAYMENT ATTEMPT STATE
-- ============================================================

alter table public.payment_transactions
add column if not exists attempt_stage text
not null
default 'created';

alter table public.payment_transactions
add column if not exists provider_status text;

alter table public.payment_transactions
add column if not exists provider_response_code text;

alter table public.payment_transactions
add column if not exists failure_code text;

alter table public.payment_transactions
add column if not exists customer_message text;

alter table public.payment_transactions
add column if not exists payment_method_id text;

alter table public.payment_transactions
add column if not exists provider_customer_id text;

alter table public.payment_transactions
add column if not exists last_checked_at timestamptz;

alter table public.payment_transactions
add column if not exists completed_at timestamptz;

create index if not exists
payment_transactions_order_created_idx
on public.payment_transactions (
  order_id,
  created_at desc
);

create index if not exists
payment_transactions_provider_status_idx
on public.payment_transactions (
  provider_status
);

create index if not exists
payment_transactions_attempt_stage_idx
on public.payment_transactions (
  attempt_stage
);

-- ============================================================
-- ADMIN-ONLY PAYMENT DIAGNOSTICS
--
-- Technical provider responses belong here.
-- Customers must never be shown internal gateway errors.
-- ============================================================

create table if not exists
public.payment_attempt_diagnostics (
  id uuid primary key
    default gen_random_uuid(),

  payment_id uuid not null
    references public.payment_transactions(id)
    on delete cascade,

  event_type text not null,

  stage text,

  provider_status text,

  provider_code text,

  internal_message text,

  payload jsonb
    not null
    default '{}'::jsonb,

  created_at timestamptz
    not null
    default now()
);

create index if not exists
payment_attempt_diagnostics_payment_idx
on public.payment_attempt_diagnostics (
  payment_id,
  created_at desc
);

create index if not exists
payment_attempt_diagnostics_event_idx
on public.payment_attempt_diagnostics (
  event_type
);

alter table
public.payment_attempt_diagnostics
enable row level security;

revoke all
on public.payment_attempt_diagnostics
from anon;

grant select
on public.payment_attempt_diagnostics
to authenticated;

drop policy if exists
"Admins can read payment diagnostics"
on public.payment_attempt_diagnostics;

create policy
"Admins can read payment diagnostics"
on public.payment_attempt_diagnostics
for select
to authenticated
using (
  public.is_admin()
);

-- ============================================================
-- BACKFILL EXISTING ATTEMPTS
-- ============================================================

update public.payment_transactions
set attempt_stage =
  case
    when status = 'successful'
      then 'completed'

    when status = 'failed'
      then 'failed'

    when status = 'cancelled'
      then 'cancelled'

    when status = 'processing'
      then 'processing'

    else 'awaiting_confirmation'
  end
where attempt_stage = 'created';

update public.payment_transactions
set completed_at =
  coalesce(
    verified_at,
    updated_at,
    created_at
  )
where status = 'successful'
  and completed_at is null;

update public.payment_transactions
set customer_message =
  'This payment attempt was not completed. You can try again or choose another payment method.'
where status = 'failed'
  and customer_message is null;

comment on table
public.payment_attempt_diagnostics is
'Admin-only technical audit trail for Posho Creative payment attempts.';

comment on column
public.payment_transactions.customer_message is
'Safe customer-facing explanation of the current payment attempt state.';

comment on column
public.payment_transactions.provider_status is
'Latest status reported by the external payment provider.';