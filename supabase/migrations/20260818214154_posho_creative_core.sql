-- ============================================================
-- POSHO CREATIVE
-- Core Production Backend
-- ============================================================

-- ============================================================
-- ENUMS
-- ============================================================

create type public.order_status as enum (
  'new',
  'under_review',
  'quote_sent',
  'awaiting_payment',
  'paid',
  'in_progress',
  'awaiting_client',
  'completed',
  'cancelled'
);

create type public.payment_status as enum (
  'pending',
  'processing',
  'successful',
  'failed',
  'cancelled',
  'refunded'
);

create type public.notification_status as enum (
  'pending',
  'sent',
  'failed',
  'cancelled'
);

create type public.file_upload_status as enum (
  'pending',
  'uploaded',
  'failed'
);

-- ============================================================
-- UPDATED AT FUNCTION
-- ============================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- CUSTOMERS
-- ============================================================

create table public.customers (
  id uuid primary key default gen_random_uuid(),

  full_name text not null,

  email text not null,

  normalized_email text
    generated always as (
      lower(trim(email))
    ) stored,

  phone text not null,

  business_name text,

  preferred_contact_method text not null default 'whatsapp'
    check (
      preferred_contact_method in (
        'whatsapp',
        'email',
        'phone'
      )
    ),

  created_at timestamptz not null default now(),

  updated_at timestamptz not null default now()
);

create unique index customers_normalized_email_key
on public.customers (normalized_email);

create index customers_phone_idx
on public.customers (phone);

create trigger customers_set_updated_at
before update on public.customers
for each row
execute function public.set_updated_at();

-- ============================================================
-- ORDERS
-- ============================================================

create table public.orders (
  id uuid primary key default gen_random_uuid(),

  reference text not null unique,

  customer_id uuid not null
    references public.customers(id)
    on delete restrict,

  service_slug text not null
    check (
      service_slug in (
        'website-development',
        'graphic-design',
        'social-media-management',
        'advertising',
        'business-services',
        'creative-solutions'
      )
    ),

  project_type text not null,

  project_title text not null,

  project_description text not null,

  project_goal text not null,

  reference_links text,

  budget text not null
    check (
      budget in (
        'not-sure',
        'under-50k',
        '50k-150k',
        '150k-500k',
        '500k-plus'
      )
    ),

  timeline text not null
    check (
      timeline in (
        'flexible',
        'one-week',
        'two-four-weeks',
        'one-three-months',
        'specific-date'
      )
    ),

  deadline date,

  status public.order_status
    not null
    default 'new',

  payment_status public.payment_status
    not null
    default 'pending',

  source text
    not null
    default 'website',

  currency text
    not null
    default 'NGN',

  quoted_amount_kobo bigint
    check (
      quoted_amount_kobo is null
      or quoted_amount_kobo >= 0
    ),

  paid_amount_kobo bigint
    not null
    default 0
    check (
      paid_amount_kobo >= 0
    ),

  customer_access_token_hash text,

  admin_assignee uuid
    references auth.users(id)
    on delete set null,

  internal_metadata jsonb
    not null
    default '{}'::jsonb,

  submitted_at timestamptz
    not null
    default now(),

  created_at timestamptz
    not null
    default now(),

  updated_at timestamptz
    not null
    default now(),

  constraint orders_specific_deadline_check
    check (
      timeline <> 'specific-date'
      or deadline is not null
    )
);

create index orders_customer_id_idx
on public.orders (customer_id);

create index orders_reference_idx
on public.orders (reference);

create index orders_status_idx
on public.orders (status);

create index orders_payment_status_idx
on public.orders (payment_status);

create index orders_service_slug_idx
on public.orders (service_slug);

create index orders_created_at_idx
on public.orders (created_at desc);

create trigger orders_set_updated_at
before update on public.orders
for each row
execute function public.set_updated_at();

-- ============================================================
-- ORDER FILES
-- ============================================================

create table public.order_files (
  id uuid primary key default gen_random_uuid(),

  order_id uuid not null
    references public.orders(id)
    on delete cascade,

  bucket_name text
    not null
    default 'project-references',

  storage_path text
    not null
    unique,

  original_name text
    not null,

  mime_type text,

  size_bytes bigint
    not null
    check (
      size_bytes >= 0
      and size_bytes <= 10485760
    ),

  upload_status public.file_upload_status
    not null
    default 'pending',

  uploaded_at timestamptz,

  created_at timestamptz
    not null
    default now(),

  updated_at timestamptz
    not null
    default now()
);

create index order_files_order_id_idx
on public.order_files (order_id);

create index order_files_upload_status_idx
on public.order_files (upload_status);

create trigger order_files_set_updated_at
before update on public.order_files
for each row
execute function public.set_updated_at();

-- ============================================================
-- ORDER STATUS HISTORY
-- ============================================================

create table public.order_status_history (
  id uuid primary key default gen_random_uuid(),

  order_id uuid not null
    references public.orders(id)
    on delete cascade,

  previous_status public.order_status,

  new_status public.order_status not null,

  changed_by uuid
    references auth.users(id)
    on delete set null,

  note text,

  created_at timestamptz
    not null
    default now()
);

create index order_status_history_order_id_idx
on public.order_status_history (order_id);

create index order_status_history_created_at_idx
on public.order_status_history (created_at desc);

-- ============================================================
-- AUTOMATIC ORDER STATUS HISTORY
-- ============================================================

create or replace function public.log_order_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then

    insert into public.order_status_history (
      order_id,
      previous_status,
      new_status,
      changed_by,
      note
    )
    values (
      new.id,
      null,
      new.status,
      auth.uid(),
      'Order created'
    );

    return new;

  end if;

  if tg_op = 'UPDATE'
     and old.status is distinct from new.status then

    insert into public.order_status_history (
      order_id,
      previous_status,
      new_status,
      changed_by
    )
    values (
      new.id,
      old.status,
      new.status,
      auth.uid()
    );

  end if;

  return new;
end;
$$;

create trigger orders_log_status_insert
after insert on public.orders
for each row
execute function public.log_order_status_change();

create trigger orders_log_status_update
after update of status on public.orders
for each row
execute function public.log_order_status_change();

-- ============================================================
-- ORDER NOTES
-- ============================================================

create table public.order_notes (
  id uuid primary key default gen_random_uuid(),

  order_id uuid not null
    references public.orders(id)
    on delete cascade,

  author_id uuid
    references auth.users(id)
    on delete set null,

  note text not null,

  is_internal boolean
    not null
    default true,

  created_at timestamptz
    not null
    default now(),

  updated_at timestamptz
    not null
    default now()
);

create index order_notes_order_id_idx
on public.order_notes (order_id);

create trigger order_notes_set_updated_at
before update on public.order_notes
for each row
execute function public.set_updated_at();

-- ============================================================
-- ADMIN PROFILES
-- ============================================================

create table public.admin_profiles (
  user_id uuid primary key
    references auth.users(id)
    on delete cascade,

  display_name text not null,

  role text not null default 'admin'
    check (
      role in (
        'owner',
        'admin',
        'manager'
      )
    ),

  active boolean
    not null
    default true,

  created_at timestamptz
    not null
    default now(),

  updated_at timestamptz
    not null
    default now()
);

create trigger admin_profiles_set_updated_at
before update on public.admin_profiles
for each row
execute function public.set_updated_at();

-- ============================================================
-- ADMIN ACCESS HELPER
-- ============================================================

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_profiles
    where user_id = auth.uid()
      and active = true
  );
$$;

revoke all on function public.is_admin()
from public;

grant execute
on function public.is_admin()
to authenticated;

-- ============================================================
-- PAYMENT TRANSACTIONS
-- ============================================================

create table public.payment_transactions (
  id uuid primary key default gen_random_uuid(),

  order_id uuid not null
    references public.orders(id)
    on delete restrict,

  provider text
    not null
    default 'paystack',

  provider_reference text unique,

  amount_kobo bigint not null
    check (
      amount_kobo > 0
    ),

  currency text
    not null
    default 'NGN',

  status public.payment_status
    not null
    default 'pending',

  provider_payload jsonb
    not null
    default '{}'::jsonb,

  verified_at timestamptz,

  created_at timestamptz
    not null
    default now(),

  updated_at timestamptz
    not null
    default now()
);

create index payment_transactions_order_id_idx
on public.payment_transactions (order_id);

create index payment_transactions_status_idx
on public.payment_transactions (status);

create index payment_transactions_provider_reference_idx
on public.payment_transactions (provider_reference);

create trigger payment_transactions_set_updated_at
before update on public.payment_transactions
for each row
execute function public.set_updated_at();

-- ============================================================
-- NOTIFICATION EVENTS
-- ============================================================

create table public.notification_events (
  id uuid primary key default gen_random_uuid(),

  order_id uuid
    references public.orders(id)
    on delete cascade,

  customer_id uuid
    references public.customers(id)
    on delete cascade,

  channel text not null
    check (
      channel in (
        'email',
        'whatsapp',
        'sms',
        'internal'
      )
    ),

  event_type text not null,

  recipient text,

  status public.notification_status
    not null
    default 'pending',

  payload jsonb
    not null
    default '{}'::jsonb,

  error_message text,

  sent_at timestamptz,

  created_at timestamptz
    not null
    default now(),

  updated_at timestamptz
    not null
    default now()
);

create index notification_events_order_id_idx
on public.notification_events (order_id);

create index notification_events_customer_id_idx
on public.notification_events (customer_id);

create index notification_events_status_idx
on public.notification_events (status);

create trigger notification_events_set_updated_at
before update on public.notification_events
for each row
execute function public.set_updated_at();

-- ============================================================
-- STORAGE BUCKET
-- Private customer project/reference files
-- ============================================================

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'project-references',
  'project-references',
  false,
  10485760,
  array[
    'image/png',
    'image/jpeg',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id)
do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.customers
enable row level security;

alter table public.orders
enable row level security;

alter table public.order_files
enable row level security;

alter table public.order_status_history
enable row level security;

alter table public.order_notes
enable row level security;

alter table public.admin_profiles
enable row level security;

alter table public.payment_transactions
enable row level security;

alter table public.notification_events
enable row level security;

-- ============================================================
-- REMOVE DIRECT ANONYMOUS DATABASE ACCESS
-- Public customers will use Edge Functions instead.
-- ============================================================

revoke all
on table public.customers
from anon;

revoke all
on table public.orders
from anon;

revoke all
on table public.order_files
from anon;

revoke all
on table public.order_status_history
from anon;

revoke all
on table public.order_notes
from anon;

revoke all
on table public.admin_profiles
from anon;

revoke all
on table public.payment_transactions
from anon;

revoke all
on table public.notification_events
from anon;

-- ============================================================
-- AUTHENTICATED TABLE PRIVILEGES
-- RLS policies below still decide whether access is allowed.
-- ============================================================

grant select, insert, update, delete
on table public.customers
to authenticated;

grant select, insert, update, delete
on table public.orders
to authenticated;

grant select, insert, update, delete
on table public.order_files
to authenticated;

grant select, insert, update, delete
on table public.order_status_history
to authenticated;

grant select, insert, update, delete
on table public.order_notes
to authenticated;

grant select, insert, update, delete
on table public.admin_profiles
to authenticated;

grant select, insert, update, delete
on table public.payment_transactions
to authenticated;

grant select, insert, update, delete
on table public.notification_events
to authenticated;

-- ============================================================
-- ADMIN RLS POLICIES
-- ============================================================

create policy "Admins can read customers"
on public.customers
for select
to authenticated
using (
  public.is_admin()
);

create policy "Admins can create customers"
on public.customers
for insert
to authenticated
with check (
  public.is_admin()
);

create policy "Admins can update customers"
on public.customers
for update
to authenticated
using (
  public.is_admin()
)
with check (
  public.is_admin()
);

create policy "Admins can delete customers"
on public.customers
for delete
to authenticated
using (
  public.is_admin()
);

create policy "Admins can read orders"
on public.orders
for select
to authenticated
using (
  public.is_admin()
);

create policy "Admins can create orders"
on public.orders
for insert
to authenticated
with check (
  public.is_admin()
);

create policy "Admins can update orders"
on public.orders
for update
to authenticated
using (
  public.is_admin()
)
with check (
  public.is_admin()
);

create policy "Admins can delete orders"
on public.orders
for delete
to authenticated
using (
  public.is_admin()
);

create policy "Admins can read order files"
on public.order_files
for select
to authenticated
using (
  public.is_admin()
);

create policy "Admins can create order files"
on public.order_files
for insert
to authenticated
with check (
  public.is_admin()
);

create policy "Admins can update order files"
on public.order_files
for update
to authenticated
using (
  public.is_admin()
)
with check (
  public.is_admin()
);

create policy "Admins can delete order files"
on public.order_files
for delete
to authenticated
using (
  public.is_admin()
);

create policy "Admins can read order history"
on public.order_status_history
for select
to authenticated
using (
  public.is_admin()
);

create policy "Admins can create order history"
on public.order_status_history
for insert
to authenticated
with check (
  public.is_admin()
);

create policy "Admins can read order notes"
on public.order_notes
for select
to authenticated
using (
  public.is_admin()
);

create policy "Admins can create order notes"
on public.order_notes
for insert
to authenticated
with check (
  public.is_admin()
);

create policy "Admins can update order notes"
on public.order_notes
for update
to authenticated
using (
  public.is_admin()
)
with check (
  public.is_admin()
);

create policy "Admins can delete order notes"
on public.order_notes
for delete
to authenticated
using (
  public.is_admin()
);

create policy "Admins can read admin profiles"
on public.admin_profiles
for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_admin()
);

create policy "Admins can create admin profiles"
on public.admin_profiles
for insert
to authenticated
with check (
  public.is_admin()
);

create policy "Admins can update admin profiles"
on public.admin_profiles
for update
to authenticated
using (
  public.is_admin()
)
with check (
  public.is_admin()
);

create policy "Admins can delete admin profiles"
on public.admin_profiles
for delete
to authenticated
using (
  public.is_admin()
);

create policy "Admins can read payments"
on public.payment_transactions
for select
to authenticated
using (
  public.is_admin()
);

create policy "Admins can create payments"
on public.payment_transactions
for insert
to authenticated
with check (
  public.is_admin()
);

create policy "Admins can update payments"
on public.payment_transactions
for update
to authenticated
using (
  public.is_admin()
)
with check (
  public.is_admin()
);

create policy "Admins can read notifications"
on public.notification_events
for select
to authenticated
using (
  public.is_admin()
);

create policy "Admins can create notifications"
on public.notification_events
for insert
to authenticated
with check (
  public.is_admin()
);

create policy "Admins can update notifications"
on public.notification_events
for update
to authenticated
using (
  public.is_admin()
)
with check (
  public.is_admin()
);

-- ============================================================
-- PRIVATE STORAGE ADMIN POLICIES
-- ============================================================

create policy "Admins can view project reference files"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'project-references'
  and public.is_admin()
);

create policy "Admins can upload project reference files"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'project-references'
  and public.is_admin()
);

create policy "Admins can update project reference files"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'project-references'
  and public.is_admin()
)
with check (
  bucket_id = 'project-references'
  and public.is_admin()
);

create policy "Admins can delete project reference files"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'project-references'
  and public.is_admin()
);

-- ============================================================
-- COMMENTS
-- ============================================================

comment on table public.customers is
'Customers who submit projects to Posho Creative.';

comment on table public.orders is
'Primary Posho Creative project and service orders.';

comment on table public.order_files is
'Private customer reference files associated with orders.';

comment on table public.order_status_history is
'Immutable history of Posho Creative order status changes.';

comment on table public.order_notes is
'Administrative notes associated with customer orders.';

comment on table public.admin_profiles is
'Authorised Posho Creative administrative users.';

comment on table public.payment_transactions is
'Payment attempts and verified payment transactions for orders.';

comment on table public.notification_events is
'Outbound and internal notification activity associated with orders.';