-- ============================================================
-- POSHO CREATIVE
-- Customer Workspace + Authenticated Order Expansion
-- ============================================================

-- ============================================================
-- ORDER CUSTOMER SNAPSHOT
-- Keeps the contact information used when the order was made.
-- ============================================================

alter table public.orders
add column if not exists customer_snapshot jsonb
not null
default '{}'::jsonb;

-- ============================================================
-- FILE ROLES
-- Allows the same secure file system to hold customer
-- references and files delivered by Posho Creative.
-- ============================================================

alter table public.order_files
add column if not exists file_role text
not null
default 'customer_reference';

alter table public.order_files
drop constraint if exists order_files_file_role_check;

alter table public.order_files
add constraint order_files_file_role_check
check (
  file_role in (
    'customer_reference',
    'project_asset',
    'deliverable'
  )
);

create index if not exists order_files_file_role_idx
on public.order_files (file_role);

-- ============================================================
-- NOTIFICATION READ STATE
-- ============================================================

alter table public.notification_events
add column if not exists read_at timestamptz;

create index if not exists notification_events_read_at_idx
on public.notification_events (read_at);

-- ============================================================
-- CUSTOMER ACTIVITY
-- ============================================================

alter table public.orders
add column if not exists last_customer_activity_at timestamptz;

-- ============================================================
-- ORDER LOOKUP PERFORMANCE
-- ============================================================

create index if not exists orders_user_created_at_idx
on public.orders (
  user_id,
  created_at desc
);

create index if not exists orders_user_status_idx
on public.orders (
  user_id,
  status
);

-- ============================================================
-- COMMENTS
-- ============================================================

comment on column public.orders.customer_snapshot is
'Customer contact information captured at the time the order was created.';

comment on column public.order_files.file_role is
'Purpose of an order file: customer_reference, project_asset or deliverable.';

comment on column public.notification_events.read_at is
'Timestamp when the customer read the notification.';