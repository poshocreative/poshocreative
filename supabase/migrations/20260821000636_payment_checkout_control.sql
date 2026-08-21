-- ============================================================
-- POSHO CREATIVE
-- PAYMENT CHECKOUT CONTROL + PROVIDER FEE ACCOUNTING
-- ============================================================

-- ============================================================
-- PAYMENT METHOD OPERATIONS CONTROL
-- ============================================================

create table if not exists
public.payment_method_settings (
  method_key text primary key,

  display_name text not null,

  description text
    not null
    default '',

  enabled boolean
    not null
    default false,

  currency text
    not null
    default 'NGN',

  sort_order integer
    not null
    default 100,

  updated_by uuid
    references auth.users(id)
    on delete set null,

  created_at timestamptz
    not null
    default now(),

  updated_at timestamptz
    not null
    default now(),

  constraint
    payment_method_settings_method_key_check
  check (
    method_key in (
      'bank_transfer',
      'opay'
    )
  )
);

insert into
public.payment_method_settings (
  method_key,
  display_name,
  description,
  enabled,
  currency,
  sort_order
)
values
(
  'bank_transfer',
  'Bank transfer',
  'Pay securely using a temporary bank account created for this transaction.',
  true,
  'NGN',
  10
),
(
  'opay',
  'OPay',
  'Continue to OPay to authorise the transaction.',
  false,
  'NGN',
  20
)
on conflict (
  method_key
)
do nothing;

drop trigger if exists
payment_method_settings_set_updated_at
on public.payment_method_settings;

create trigger
payment_method_settings_set_updated_at
before update
on public.payment_method_settings
for each row
execute function
public.set_updated_at();

-- ============================================================
-- PAYMENT FEE ACCOUNTING
--
-- amount_kobo remains the amount owed to Posho Creative.
-- Provider/customer processing fees are tracked separately.
-- ============================================================

alter table
public.payment_transactions
add column if not exists
base_amount_kobo bigint;

alter table
public.payment_transactions
add column if not exists
estimated_fee_kobo bigint;

alter table
public.payment_transactions
add column if not exists
estimated_customer_total_kobo bigint;

alter table
public.payment_transactions
add column if not exists
actual_provider_fee_kobo bigint;

alter table
public.payment_transactions
add column if not exists
actual_customer_total_kobo bigint;

alter table
public.payment_transactions
add column if not exists
provider_fees jsonb
not null
default '[]'::jsonb;

alter table
public.payment_transactions
add column if not exists
fee_quoted_at timestamptz;

alter table
public.payment_transactions
add column if not exists
customer_bears_fee boolean
not null
default true;

-- ============================================================
-- BACKFILL EXISTING PAYMENT ATTEMPTS
-- ============================================================

update public.payment_transactions
set
  base_amount_kobo =
    coalesce(
      base_amount_kobo,
      amount_kobo
    )
where base_amount_kobo is null;

update public.payment_transactions
set
  estimated_fee_kobo =
    coalesce(
      estimated_fee_kobo,
      0
    )
where estimated_fee_kobo is null;

update public.payment_transactions
set
  estimated_customer_total_kobo =
    coalesce(
      estimated_customer_total_kobo,
      base_amount_kobo,
      amount_kobo
    )
where estimated_customer_total_kobo is null;

-- ============================================================
-- INDEXES
-- ============================================================

create index if not exists
payment_method_settings_enabled_idx
on public.payment_method_settings (
  enabled,
  sort_order
);

create index if not exists
payment_transactions_fee_quoted_at_idx
on public.payment_transactions (
  fee_quoted_at desc
);

-- ============================================================
-- SECURITY
-- ============================================================

alter table
public.payment_method_settings
enable row level security;

revoke all
on public.payment_method_settings
from anon;

grant select, update
on public.payment_method_settings
to authenticated;

drop policy if exists
"Admins can read payment method settings"
on public.payment_method_settings;

create policy
"Admins can read payment method settings"
on public.payment_method_settings
for select
to authenticated
using (
  public.is_admin()
);

drop policy if exists
"Admins can update payment method settings"
on public.payment_method_settings;

create policy
"Admins can update payment method settings"
on public.payment_method_settings
for update
to authenticated
using (
  public.is_admin()
)
with check (
  public.is_admin()
);

-- ============================================================
-- COMMENTS
-- ============================================================

comment on table
public.payment_method_settings is
'Management-controlled payment methods available to Posho Creative customers.';

comment on column
public.payment_transactions.base_amount_kobo is
'Amount owed to Posho Creative excluding payment provider fees.';

comment on column
public.payment_transactions.estimated_fee_kobo is
'Processing fee quoted by the payment provider before payment.';

comment on column
public.payment_transactions.estimated_customer_total_kobo is
'Expected customer payable total including the quoted provider fee.';

comment on column
public.payment_transactions.actual_provider_fee_kobo is
'Actual provider fee reported during verified transaction reconciliation.';

comment on column
public.payment_transactions.actual_customer_total_kobo is
'Actual customer total derived from the verified base amount and provider fee.';