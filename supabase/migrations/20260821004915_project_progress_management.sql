-- ============================================================
-- POSHO CREATIVE
-- PROFESSIONAL PROJECT PROGRESS MANAGEMENT
-- ============================================================

-- ============================================================
-- CURRENT PROJECT PROGRESS SNAPSHOT
-- ============================================================

alter table public.orders
add column if not exists progress_percent integer
not null
default 0;

alter table public.orders
drop constraint if exists orders_progress_percent_check;

alter table public.orders
add constraint orders_progress_percent_check
check (
  progress_percent >= 0
  and progress_percent <= 100
);

alter table public.orders
add column if not exists progress_label text
not null
default 'Awaiting project start';

alter table public.orders
add column if not exists progress_message text;

alter table public.orders
add column if not exists progress_updated_at timestamptz;

-- ============================================================
-- BACKFILL EXISTING PROJECTS
-- ============================================================

update public.orders
set
  progress_percent = 100,
  progress_label = 'Completed',
  progress_message =
    coalesce(
      progress_message,
      'This project has been completed.'
    ),
  progress_updated_at =
    coalesce(
      progress_updated_at,
      updated_at,
      now()
    )
where status = 'completed';

update public.orders
set progress_label =
  case
    when status = 'in_progress'
      then 'In progress'

    when status = 'awaiting_client'
      then 'Waiting for your response'

    when status = 'paid'
      then 'Ready for production'

    when status = 'awaiting_payment'
      then 'Awaiting payment'

    when status = 'under_review'
      then 'Under review'

    else progress_label
  end
where progress_percent = 0
  and status <> 'completed';

-- ============================================================
-- IMMUTABLE PROGRESS HISTORY
-- ============================================================

create table if not exists
public.project_progress_updates (
  id uuid primary key
    default gen_random_uuid(),

  order_id uuid not null
    references public.orders(id)
    on delete cascade,

  progress_percent integer not null
    check (
      progress_percent >= 0
      and progress_percent <= 100
    ),

  progress_label text not null,

  message text not null,

  created_by uuid
    references auth.users(id)
    on delete set null,

  created_at timestamptz
    not null
    default now()
);

create index if not exists
project_progress_updates_order_created_idx
on public.project_progress_updates (
  order_id,
  created_at desc
);

create index if not exists
project_progress_updates_progress_idx
on public.project_progress_updates (
  progress_percent
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table
public.project_progress_updates
enable row level security;

revoke all
on table public.project_progress_updates
from anon;

revoke insert, update, delete
on table public.project_progress_updates
from authenticated;

grant select
on table public.project_progress_updates
to authenticated;

drop policy if exists
"Admins can read project progress"
on public.project_progress_updates;

create policy
"Admins can read project progress"
on public.project_progress_updates
for select
to authenticated
using (
  public.has_admin_access()
);

drop policy if exists
"Customers can read own project progress"
on public.project_progress_updates;

create policy
"Customers can read own project progress"
on public.project_progress_updates
for select
to authenticated
using (
  exists (
    select 1
    from public.orders o
    where o.id =
      public.project_progress_updates.order_id
      and o.user_id =
        (select auth.uid())
  )
);

-- ============================================================
-- SECURE ATOMIC ADMIN PROGRESS UPDATE
--
-- This function:
-- 1. verifies the session-bound Admin access code
-- 2. updates the current progress snapshot
-- 3. creates immutable progress history
-- 4. notifies the customer
-- 5. writes to the Admin audit trail
-- ============================================================

create or replace function
public.admin_update_project_progress(
  p_order_id uuid,
  p_progress_percent integer,
  p_progress_label text,
  p_message text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;

  v_percent integer;

  v_label text;

  v_message text;

  v_now timestamptz;

  v_next_status public.order_status;

  v_update_id uuid;
begin
  if not public.has_admin_access() then
    raise exception
      'Administrative access is required.'
      using errcode = '42501';
  end if;

  if p_order_id is null then
    raise exception
      'Project ID is required.';
  end if;

  if p_progress_percent is null
     or p_progress_percent < 0
     or p_progress_percent > 100 then

    raise exception
      'Progress must be between 0 and 100 percent.';
  end if;

  v_percent :=
    p_progress_percent;

  v_label :=
    left(
      trim(
        coalesce(
          p_progress_label,
          ''
        )
      ),
      120
    );

  v_message :=
    left(
      trim(
        coalesce(
          p_message,
          ''
        )
      ),
      3000
    );

  if char_length(v_label) < 3 then
    raise exception
      'Provide a clear progress milestone.';
  end if;

  if char_length(v_message) < 10 then
    raise exception
      'Provide a clear customer-facing progress update.';
  end if;

  select *
  into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception
      'Project could not be found.';
  end if;

  if v_order.review_decision <> 'approved' then
    raise exception
      'Only approved projects can receive production progress updates.';
  end if;

  if v_order.status = 'cancelled' then
    raise exception
      'A cancelled project cannot receive progress updates.';
  end if;

  if v_order.status = 'completed'
     and v_percent < 100 then

    raise exception
      'A completed project cannot be moved below 100 percent.';
  end if;

  v_now :=
    now();

  v_next_status :=
    v_order.status;

  if v_percent = 100 then
    v_next_status :=
      'completed';

  elsif v_percent > 0
        and v_order.status = 'paid' then

    v_next_status :=
      'in_progress';
  end if;

  update public.orders
  set
    progress_percent =
      v_percent,

    progress_label =
      v_label,

    progress_message =
      v_message,

    progress_updated_at =
      v_now,

    status =
      v_next_status,

    customer_action_required =
      case
        when v_percent = 100
          then false

        else customer_action_required
      end,

    customer_action_label =
      case
        when v_percent = 100
          then null

        else customer_action_label
      end,

    last_admin_activity_at =
      v_now
  where id =
    v_order.id;

  insert into
  public.project_progress_updates (
    order_id,
    progress_percent,
    progress_label,
    message,
    created_by,
    created_at
  )
  values (
    v_order.id,
    v_percent,
    v_label,
    v_message,
    auth.uid(),
    v_now
  )
  returning id
  into v_update_id;

  insert into
  public.notification_events (
    order_id,
    customer_id,
    channel,
    event_type,
    status,
    payload
  )
  values (
    v_order.id,
    v_order.customer_id,
    'internal',
    'project_progress_updated',
    'pending',
    jsonb_build_object(
      'reference',
        v_order.reference,

      'project_title',
        v_order.project_title,

      'progress_percent',
        v_percent,

      'progress_label',
        v_label,

      'message',
        v_message
    )
  );

  insert into
  public.admin_activity_log (
    admin_user_id,
    order_id,
    action,
    description,
    metadata
  )
  values (
    auth.uid(),
    v_order.id,
    'project_progress_updated',
    format(
      'Project progress updated to %s%%.',
      v_percent
    ),
    jsonb_build_object(
      'previous_progress',
        v_order.progress_percent,

      'new_progress',
        v_percent,

      'progress_label',
        v_label,

      'message',
        v_message,

      'previous_status',
        v_order.status,

      'new_status',
        v_next_status
    )
  );

  return jsonb_build_object(
    'success',
      true,

    'update_id',
      v_update_id,

    'progress_percent',
      v_percent,

    'progress_label',
      v_label,

    'message',
      v_message,

    'status',
      v_next_status,

    'updated_at',
      v_now
  );
end;
$$;

revoke all
on function
public.admin_update_project_progress(
  uuid,
  integer,
  text,
  text
)
from public;

revoke all
on function
public.admin_update_project_progress(
  uuid,
  integer,
  text,
  text
)
from anon;

grant execute
on function
public.admin_update_project_progress(
  uuid,
  integer,
  text,
  text
)
to authenticated;

comment on column
public.orders.progress_percent is
'Current customer-visible percentage completion for the project.';

comment on column
public.orders.progress_label is
'Current customer-visible project milestone.';

comment on column
public.orders.progress_message is
'Latest customer-facing explanation of project progress.';

comment on table
public.project_progress_updates is
'Immutable customer-visible history of project progress updates.';