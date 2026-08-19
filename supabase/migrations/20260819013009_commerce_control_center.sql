-- ============================================================
-- POSHO CREATIVE
-- Commerce Control Center
-- Quotes, Payments, Admin Activity, Customer Actions
-- ============================================================

-- ============================================================
-- FLUTTERWAVE CUSTOMER LINK
-- ============================================================

alter table public.customers
add column if not exists flutterwave_customer_id text;

create index if not exists
customers_flutterwave_customer_id_idx
on public.customers (flutterwave_customer_id);

-- ============================================================
-- CUSTOMER ACTION STATE
-- ============================================================

alter table public.orders
add column if not exists customer_action_required boolean
not null
default false;

alter table public.orders
add column if not exists customer_action_label text;

alter table public.orders
add column if not exists last_admin_activity_at timestamptz;

-- ============================================================
-- QUOTES
-- ============================================================

create table if not exists public.order_quotes (
  id uuid primary key
    default gen_random_uuid(),

  order_id uuid not null
    references public.orders(id)
    on delete cascade,

  amount_kobo bigint not null
    check (amount_kobo > 0),

  currency text not null
    default 'NGN',

  status text not null
    default 'draft'
    check (
      status in (
        'draft',
        'sent',
        'accepted',
        'superseded',
        'expired',
        'cancelled'
      )
    ),

  message text,

  valid_until timestamptz,

  created_by uuid
    references auth.users(id)
    on delete set null,

  sent_at timestamptz,

  accepted_at timestamptz,

  created_at timestamptz
    not null
    default now(),

  updated_at timestamptz
    not null
    default now()
);

create index if not exists
order_quotes_order_id_idx
on public.order_quotes (order_id);

create index if not exists
order_quotes_status_idx
on public.order_quotes (status);

create index if not exists
order_quotes_created_at_idx
on public.order_quotes (created_at desc);

drop trigger if exists
order_quotes_set_updated_at
on public.order_quotes;

create trigger order_quotes_set_updated_at
before update
on public.order_quotes
for each row
execute function public.set_updated_at();

-- ============================================================
-- CURRENT QUOTE ON ORDER
-- ============================================================

alter table public.orders
add column if not exists current_quote_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname =
      'orders_current_quote_id_fkey'
  ) then
    alter table public.orders
    add constraint
      orders_current_quote_id_fkey
    foreign key (
      current_quote_id
    )
    references public.order_quotes(id)
    on delete set null;
  end if;
end;
$$;

create index if not exists
orders_current_quote_id_idx
on public.orders (current_quote_id);

-- ============================================================
-- PAYMENT SESSION DATA
-- ============================================================

alter table public.payment_transactions
add column if not exists payment_method text;

alter table public.payment_transactions
add column if not exists idempotency_key text;

alter table public.payment_transactions
add column if not exists virtual_account_id text;

alter table public.payment_transactions
add column if not exists expires_at timestamptz;

create unique index if not exists
payment_transactions_idempotency_key_idx
on public.payment_transactions (
  idempotency_key
)
where idempotency_key is not null;

create index if not exists
payment_transactions_virtual_account_id_idx
on public.payment_transactions (
  virtual_account_id
);

-- ============================================================
-- ADMIN ACTIVITY LOG
-- ============================================================

create table if not exists public.admin_activity_log (
  id uuid primary key
    default gen_random_uuid(),

  admin_user_id uuid
    references auth.users(id)
    on delete set null,

  order_id uuid
    references public.orders(id)
    on delete cascade,

  action text not null,

  description text,

  metadata jsonb
    not null
    default '{}'::jsonb,

  created_at timestamptz
    not null
    default now()
);

create index if not exists
admin_activity_log_order_id_idx
on public.admin_activity_log (
  order_id
);

create index if not exists
admin_activity_log_created_at_idx
on public.admin_activity_log (
  created_at desc
);

-- ============================================================
-- RLS
-- ============================================================

alter table public.order_quotes
enable row level security;

alter table public.admin_activity_log
enable row level security;

grant select, insert, update, delete
on public.order_quotes
to authenticated;

grant select, insert
on public.admin_activity_log
to authenticated;

-- Customer may read quotes for their own order.

drop policy if exists
"Customers can read own quotes"
on public.order_quotes;

create policy
"Customers can read own quotes"
on public.order_quotes
for select
to authenticated
using (
  exists (
    select 1
    from public.orders
    where public.orders.id =
      public.order_quotes.order_id
      and public.orders.user_id =
        (select auth.uid())
  )
);

-- Admin quote policies.

drop policy if exists
"Admins can read quotes"
on public.order_quotes;

create policy
"Admins can read quotes"
on public.order_quotes
for select
to authenticated
using (
  public.is_admin()
);

drop policy if exists
"Admins can create quotes"
on public.order_quotes;

create policy
"Admins can create quotes"
on public.order_quotes
for insert
to authenticated
with check (
  public.is_admin()
);

drop policy if exists
"Admins can update quotes"
on public.order_quotes;

create policy
"Admins can update quotes"
on public.order_quotes
for update
to authenticated
using (
  public.is_admin()
)
with check (
  public.is_admin()
);

drop policy if exists
"Admins can delete quotes"
on public.order_quotes;

create policy
"Admins can delete quotes"
on public.order_quotes
for delete
to authenticated
using (
  public.is_admin()
);

-- Admin activity.

drop policy if exists
"Admins can read activity log"
on public.admin_activity_log;

create policy
"Admins can read activity log"
on public.admin_activity_log
for select
to authenticated
using (
  public.is_admin()
);

drop policy if exists
"Admins can create activity log"
on public.admin_activity_log;

create policy
"Admins can create activity log"
on public.admin_activity_log
for insert
to authenticated
with check (
  public.is_admin()
);

-- ============================================================
-- CUSTOMER NOTIFICATION READ RPC
-- ============================================================

create or replace function
public.mark_my_notification_read(
  p_notification_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.notification_events n
  set
    read_at =
      coalesce(
        n.read_at,
        now()
      ),
    updated_at = now()
  where n.id =
    p_notification_id
    and exists (
      select 1
      from public.customers c
      where c.id =
        n.customer_id
        and c.user_id =
          (select auth.uid())
    );
end;
$$;

revoke all
on function
public.mark_my_notification_read(uuid)
from public;

grant execute
on function
public.mark_my_notification_read(uuid)
to authenticated;

comment on table public.order_quotes is
'Professional quotes issued by Posho Creative for customer projects.';

comment on column public.orders.customer_action_required is
'Indicates that the customer currently has an action such as reviewing a quote or making payment.';

comment on column public.customers.flutterwave_customer_id is
'Flutterwave v4 customer identifier used for payment collections.';