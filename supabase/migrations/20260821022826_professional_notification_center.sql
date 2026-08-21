-- ============================================================
-- POSHO CREATIVE
-- PROFESSIONAL CLIENT NOTIFICATION CENTER
-- ============================================================

-- ============================================================
-- PERFORMANCE
-- ============================================================

create index if not exists
notification_events_customer_read_created_idx
on public.notification_events (
  customer_id,
  read_at,
  created_at desc
);

-- ============================================================
-- UPGRADE EXISTING NOTIFICATION READ FUNCTION
--
-- An older migration created:
--
-- public.mark_my_notification_read(uuid)
-- returns void
--
-- PostgreSQL cannot change a function return type with
-- CREATE OR REPLACE FUNCTION, so the old signature must first
-- be removed before recreating it as RETURNS jsonb.
-- ============================================================

drop function if exists
public.mark_my_notification_read(uuid);

-- ============================================================
-- MARK ONE CUSTOMER NOTIFICATION AS READ
--
-- SECURITY:
-- The authenticated customer may only change a notification
-- that belongs to their own customer account.
-- ============================================================

create function
public.mark_my_notification_read(
  p_notification_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz;

  v_order_id uuid;

  v_existing_read_at timestamptz;

  v_final_read_at timestamptz;

  v_already_read boolean;
begin
  -- ----------------------------------------------------------
  -- AUTHENTICATION
  -- ----------------------------------------------------------

  if auth.uid() is null then
    raise exception
      'Authentication is required.'
      using errcode = '42501';
  end if;

  if p_notification_id is null then
    raise exception
      'Notification ID is required.';
  end if;

  -- ----------------------------------------------------------
  -- OWNERSHIP CHECK
  -- ----------------------------------------------------------

  select
    n.order_id,
    n.read_at
  into
    v_order_id,
    v_existing_read_at
  from public.notification_events n
  where n.id =
    p_notification_id

    and exists (
      select 1
      from public.customers c
      where c.id =
        n.customer_id

        and c.user_id =
          auth.uid()
    );

  if not found then
    raise exception
      'Notification could not be found.'
      using errcode = '42501';
  end if;

  v_already_read :=
    v_existing_read_at
      is not null;

  v_now :=
    now();

  -- ----------------------------------------------------------
  -- READ STATE
  -- ----------------------------------------------------------

  update public.notification_events
  set
    read_at =
      coalesce(
        read_at,
        v_now
      ),

    updated_at =
      v_now
  where id =
    p_notification_id
  returning read_at
  into v_final_read_at;

  -- ----------------------------------------------------------
  -- CUSTOMER ACTIVITY
  -- ----------------------------------------------------------

  if v_order_id is not null then
    update public.orders
    set
      last_customer_activity_at =
        v_now
    where id =
      v_order_id

      and user_id =
        auth.uid();
  end if;

  -- ----------------------------------------------------------
  -- RESULT
  -- ----------------------------------------------------------

  return jsonb_build_object(
    'success',
      true,

    'notification_id',
      p_notification_id,

    'already_read',
      v_already_read,

    'read_at',
      v_final_read_at
  );
end;
$$;

-- ============================================================
-- PERMISSIONS
-- ============================================================

revoke all
on function
public.mark_my_notification_read(uuid)
from public;

revoke all
on function
public.mark_my_notification_read(uuid)
from anon;

grant execute
on function
public.mark_my_notification_read(uuid)
to authenticated;

-- ============================================================
-- MARK ALL CUSTOMER NOTIFICATIONS AS READ
-- ============================================================

drop function if exists
public.mark_all_my_notifications_read();

create function
public.mark_all_my_notifications_read()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz;

  v_count integer;
begin
  -- ----------------------------------------------------------
  -- AUTHENTICATION
  -- ----------------------------------------------------------

  if auth.uid() is null then
    raise exception
      'Authentication is required.'
      using errcode = '42501';
  end if;

  v_now :=
    now();

  -- ----------------------------------------------------------
  -- UPDATE ONLY THE AUTHENTICATED CUSTOMER'S UNREAD EVENTS
  -- ----------------------------------------------------------

  with updated as (
    update public.notification_events n
    set
      read_at =
        v_now,

      updated_at =
        v_now
    where n.read_at is null

      and n.customer_id in (
        select c.id
        from public.customers c
        where c.user_id =
          auth.uid()
      )

    returning n.id
  )

  select
    count(*)
  into
    v_count
  from updated;

  -- ----------------------------------------------------------
  -- RESULT
  -- ----------------------------------------------------------

  return jsonb_build_object(
    'success',
      true,

    'updated_count',
      coalesce(
        v_count,
        0
      ),

    'read_at',
      v_now
  );
end;
$$;

-- ============================================================
-- PERMISSIONS
-- ============================================================

revoke all
on function
public.mark_all_my_notifications_read()
from public;

revoke all
on function
public.mark_all_my_notifications_read()
from anon;

grant execute
on function
public.mark_all_my_notifications_read()
to authenticated;

-- ============================================================
-- DOCUMENTATION
-- ============================================================

comment on function
public.mark_my_notification_read(uuid)
is
'Securely marks one notification belonging to the authenticated Posho Creative customer as read and returns the resulting read state.';

comment on function
public.mark_all_my_notifications_read()
is
'Securely marks every unread notification belonging to the authenticated Posho Creative customer as read.';