-- ============================================================
-- POSHO CREATIVE
-- FIX: notification read ownership fallback via order link
-- ============================================================
-- Symptoms:
--   * Opening a notification fails with
--     "Notification could not be found."
--   * "Mark all read" reports success but unread badges return
--     on refresh (server updated 0 rows).
--
-- Root cause:
--   Both RPCs only accepted ownership through
--   notification_events.customer_id -> customers.user_id.
--   Rows whose customer_id link differs (legacy / edge-case
--   rows) while the linked order still belongs to the user
--   were rejected, even though the user legitimately owns
--   the underlying project.
--
-- Fix:
--   Accept ownership through EITHER link:
--     1. customers.id = notification.customer_id
--        AND customers.user_id = auth.uid(), OR
--     2. orders.id = notification.order_id
--        AND orders.user_id = auth.uid()
--   The customer read policy is widened with the same rule so
--   the visible list and the RPCs can never disagree again.
-- ============================================================

-- ------------------------------------------------------------
-- MARK ONE: accept customer link OR order link
-- (return type unchanged, so CREATE OR REPLACE is safe)
-- ------------------------------------------------------------

create or replace function
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
  -- OWNERSHIP CHECK (customer link OR order link)
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

    and (
      exists (
        select 1
        from public.customers c
        where c.id =
          n.customer_id

          and c.user_id =
            auth.uid()
      )

      or exists (
        select 1
        from public.orders o
        where o.id =
          n.order_id

          and o.user_id =
            auth.uid()
      )
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

-- ------------------------------------------------------------
-- MARK ALL: update through customer link OR order link
-- ------------------------------------------------------------

create or replace function
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
  -- UPDATE THE AUTHENTICATED CUSTOMER'S UNREAD EVENTS
  -- (customer link OR order link)
  -- ----------------------------------------------------------

  with updated as (
    update public.notification_events n
    set
      read_at =
        v_now,

      updated_at =
        v_now
    where n.read_at is null

      and (
        n.customer_id in (
          select c.id
          from public.customers c
          where c.user_id =
            auth.uid()
        )

        or n.order_id in (
          select o.id
          from public.orders o
          where o.user_id =
            auth.uid()
        )
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

-- ------------------------------------------------------------
-- READ POLICY: keep the visible list consistent with the RPCs
-- ------------------------------------------------------------

drop policy if exists
"Customers can read own notifications"
on public.notification_events;

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

  or order_id in (
    select id
    from public.orders
    where user_id = (select auth.uid())
  )
);
