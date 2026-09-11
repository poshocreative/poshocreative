-- ============================================================
-- POSHO CREATIVE — STORAGE ACCESS REPAIR (LOCAL MIGRATION)
-- Deliverable files uploaded by Management use a
-- customer_id path prefix, but the customer storage policy
-- only allows the auth user_id prefix. This policy grants
-- customers read access to files prefixed with their own
-- customer record id, so final delivery downloads work.
-- No existing objects are moved or renamed.
-- DO NOT APPLY REMOTELY without explicit owner authorization.
-- ============================================================

drop policy if exists
  "Customers can read own customer-prefixed files"
  on storage.objects;

create policy
  "Customers can read own customer-prefixed files"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id =
      'project-references'
    and exists (
      select 1
      from
        public.customers c
      where
        c.user_id =
          auth.uid()
        and (
          storage.foldername(
            name
          )
        )[1] =
          c.id::text
    )
  );

notify pgrst,
  'reload schema';
