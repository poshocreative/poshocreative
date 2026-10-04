-- ============================================================
-- POSHO CREATIVE
-- FIX: customer workspace must only ever see OWN notifications
-- ============================================================
-- Symptoms:
--   * Updates page lists notifications that fail to open with
--     "Notification could not be found."
--   * "Mark all read" updates 0 rows even though unread cards
--     are visible.
--
-- Root cause:
--   notification_events has three permissive SELECT policies:
--     1. is_admin()                       -> sees EVERYTHING
--     2. own rows (customer OR order link)
--     3. is_team_member()                 -> sees EVERYTHING
--   So an admin / team member opening their own CUSTOMER
--   workspace sees other customers' notifications. The
--   mark-read RPCs are (correctly) scoped to owned rows only,
--   so those foreign rows can never be opened or marked.
--
-- Fix:
--   Serve the customer workspace through dedicated
--   SECURITY DEFINER RPCs that return/count ONLY rows owned
--   via the customer link OR the order link, regardless of
--   admin / team membership. Admins keep full visibility in
--   the admin area through RLS; the customer timeline stays
--   personal.
-- ============================================================

-- ------------------------------------------------------------
-- OWN NOTIFICATIONS, newest first (same shape as the
-- previous direct table select with embedded orders)
-- ------------------------------------------------------------

create or replace function
public.get_my_notifications()
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select
    coalesce(
      jsonb_agg(row_to_json(t)),
      '[]'::jsonb
    )
  from (
    select
      n.id,
      n.order_id,
      n.event_type,
      n.payload,
      n.read_at,
      n.created_at,

      case
        when o.id is null then null
        else jsonb_build_object(
          'reference', o.reference,
          'project_title', o.project_title,
          'service_slug', o.service_slug,
          'status', o.status,
          'progress_percent', o.progress_percent,
          'progress_label', o.progress_label
        )
      end as orders

    from public.notification_events n

    left join public.orders o
      on o.id = n.order_id

    where
      n.customer_id in (
        select c.id
        from public.customers c
        where c.user_id = auth.uid()
      )

      or n.order_id in (
        select o2.id
        from public.orders o2
        where o2.user_id = auth.uid()
      )

    order by n.created_at desc
  ) t;
$$;

-- ------------------------------------------------------------
-- OWN UNREAD COUNT (cheap polling for the workspace badge)
-- ------------------------------------------------------------

create or replace function
public.get_my_unread_notification_count()
returns integer
language sql
security definer
set search_path = ''
as $$
  select
    count(*)::integer
  from public.notification_events n
  where n.read_at is null

    and (
      n.customer_id in (
        select c.id
        from public.customers c
        where c.user_id = auth.uid()
      )

      or n.order_id in (
        select o.id
        from public.orders o
        where o.user_id = auth.uid()
      )
    );
$$;

-- ------------------------------------------------------------
-- PERMISSIONS (same pattern as the mark-read RPCs)
-- ------------------------------------------------------------

revoke all
on function
public.get_my_notifications()
from public;

revoke all
on function
public.get_my_notifications()
from anon;

grant execute
on function
public.get_my_notifications()
to authenticated;

revoke all
on function
public.get_my_unread_notification_count()
from public;

revoke all
on function
public.get_my_unread_notification_count()
from anon;

grant execute
on function
public.get_my_unread_notification_count()
to authenticated;

-- ------------------------------------------------------------
-- DOCUMENTATION
-- ------------------------------------------------------------

comment on function
public.get_my_notifications()
is
'Returns ONLY notifications owned by the authenticated customer (customer link OR order link), newest first. Powers the customer workspace Updates timeline so admins/team members never see other customers'' rows there.';

comment on function
public.get_my_unread_notification_count()
is
'Counts ONLY unread notifications owned by the authenticated customer. Powers the customer workspace unread badge.';
