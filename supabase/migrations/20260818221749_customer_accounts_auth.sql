-- ============================================================
-- POSHO CREATIVE
-- Customer Accounts + Order Ownership
-- ============================================================

-- ============================================================
-- CUSTOMER ACCOUNT LINK
-- ============================================================

alter table public.customers
add column if not exists user_id uuid
references auth.users(id)
on delete set null;

create unique index if not exists customers_user_id_key
on public.customers (user_id)
where user_id is not null;

alter table public.customers
alter column phone set default '';

-- ============================================================
-- ORDER OWNERSHIP
-- ============================================================

alter table public.orders
add column if not exists user_id uuid
references auth.users(id)
on delete set null;

create index if not exists orders_user_id_idx
on public.orders (user_id);

-- ============================================================
-- BACKFILL ORDER OWNERSHIP WHERE POSSIBLE
-- ============================================================

update public.orders o
set user_id = c.user_id
from public.customers c
where o.customer_id = c.id
  and c.user_id is not null
  and o.user_id is null;

-- ============================================================
-- AUTH USER → CUSTOMER PROFILE
-- ============================================================

create or replace function public.handle_new_customer_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  customer_full_name text;
  customer_phone text;
  customer_business_name text;
  customer_contact_method text;
begin
  customer_full_name :=
    nullif(
      trim(
        coalesce(
          new.raw_user_meta_data ->> 'full_name',
          ''
        )
      ),
      ''
    );

  if customer_full_name is null then
    customer_full_name :=
      split_part(new.email, '@', 1);
  end if;

  customer_phone :=
    trim(
      coalesce(
        new.raw_user_meta_data ->> 'phone',
        ''
      )
    );

  customer_business_name :=
    nullif(
      trim(
        coalesce(
          new.raw_user_meta_data ->> 'business_name',
          ''
        )
      ),
      ''
    );

  customer_contact_method :=
    coalesce(
      nullif(
        trim(
          new.raw_user_meta_data ->> 'preferred_contact_method'
        ),
        ''
      ),
      'whatsapp'
    );

  if customer_contact_method not in (
    'whatsapp',
    'email',
    'phone'
  ) then
    customer_contact_method := 'whatsapp';
  end if;

  insert into public.customers (
    user_id,
    full_name,
    email,
    phone,
    business_name,
    preferred_contact_method
  )
  values (
    new.id,
    customer_full_name,
    new.email,
    customer_phone,
    customer_business_name,
    customer_contact_method
  )
  on conflict (normalized_email)
  do update set
    user_id = excluded.user_id,
    full_name = excluded.full_name,
    phone = case
      when excluded.phone <> ''
      then excluded.phone
      else public.customers.phone
    end,
    business_name = coalesce(
      excluded.business_name,
      public.customers.business_name
    ),
    preferred_contact_method =
      excluded.preferred_contact_method,
    updated_at = now();

  update public.orders
  set user_id = new.id
  where customer_id in (
    select id
    from public.customers
    where normalized_email = lower(trim(new.email))
  )
  and user_id is null;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created
on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_customer_user();

-- ============================================================
-- CUSTOMER PROFILE OWNERSHIP POLICIES
-- ============================================================

create policy "Customers can read own customer profile"
on public.customers
for select
to authenticated
using (
  user_id = (select auth.uid())
);

create policy "Customers can update own customer profile"
on public.customers
for update
to authenticated
using (
  user_id = (select auth.uid())
)
with check (
  user_id = (select auth.uid())
);

-- ============================================================
-- CUSTOMER ORDER ACCESS
-- ============================================================

create policy "Customers can read own orders"
on public.orders
for select
to authenticated
using (
  user_id = (select auth.uid())
);

-- ============================================================
-- CUSTOMER ORDER FILE ACCESS
-- ============================================================

create policy "Customers can read own order file records"
on public.order_files
for select
to authenticated
using (
  exists (
    select 1
    from public.orders
    where public.orders.id = public.order_files.order_id
      and public.orders.user_id = (select auth.uid())
  )
);

-- ============================================================
-- CUSTOMER ORDER STATUS HISTORY
-- ============================================================

create policy "Customers can read own order history"
on public.order_status_history
for select
to authenticated
using (
  exists (
    select 1
    from public.orders
    where public.orders.id = public.order_status_history.order_id
      and public.orders.user_id = (select auth.uid())
  )
);

-- ============================================================
-- CUSTOMER NOTES
-- Only non-internal notes can be shown to customers.
-- ============================================================

create policy "Customers can read visible order notes"
on public.order_notes
for select
to authenticated
using (
  is_internal = false
  and exists (
    select 1
    from public.orders
    where public.orders.id = public.order_notes.order_id
      and public.orders.user_id = (select auth.uid())
  )
);

-- ============================================================
-- CUSTOMER PAYMENT ACCESS
-- ============================================================

create policy "Customers can read own payments"
on public.payment_transactions
for select
to authenticated
using (
  exists (
    select 1
    from public.orders
    where public.orders.id = public.payment_transactions.order_id
      and public.orders.user_id = (select auth.uid())
  )
);

-- ============================================================
-- CUSTOMER NOTIFICATION ACCESS
-- ============================================================

create policy "Customers can read own notifications"
on public.notification_events
for select
to authenticated
using (
  customer_id in (
    select id
    from public.customers
    where user_id = (select auth.uid())
  )
);

-- ============================================================
-- PRIVATE STORAGE CUSTOMER READ POLICY
-- Storage paths will later use:
-- user_id/order_id/filename
-- ============================================================

create policy "Customers can read own project reference files"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'project-references'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

-- ============================================================
-- COMMENTS
-- ============================================================

comment on column public.customers.user_id is
'Supabase Auth user associated with this customer account.';

comment on column public.orders.user_id is
'Authenticated Posho Creative customer who owns this order.';