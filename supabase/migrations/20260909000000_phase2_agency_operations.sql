-- ============================================================
-- POSHO CREATIVE — PHASE 2 AGENCY OPERATING SYSTEM (LOCAL MIGRATION)
-- Evolves the existing schema. Creates no competing systems:
-- files still live in order_files, money still flows through
-- payment_transactions, progress still snapshots on orders.
-- DO NOT APPLY REMOTELY without explicit owner authorization.
--
-- Contents:
--  1. orders additions (project_phase, delivered_at, completed_at)
--  2. order_files role extension (working_file, final_deliverable)
--  3. project_milestones (work milestones, client visibility)
--  4. project_tasks (internal vs client-visible)
--  5. project_scope (agreed scope baseline, one row per project)
--  6. project_deliverables + deliverable_versions (versions + approvals)
--  7. revision_requests (structured, traceable)
--  8. change_requests (scope control + cost linkage)
--  9. order_quote_items (itemized quotes)
-- 10. internal_costs (management-only profitability)
-- 11. client_notes (management-only CRM notes)
-- 12. project_feedback (rating + testimonial permission)
-- 13. notification_preferences (in-app now, email later)
-- 14. RLS: admin full via has_admin_access, clients read-own visible
-- ============================================================

-- ------------------------------------------------------------
-- 1. ORDERS ADDITIONS
-- project_phase is independent from status/progress_percent.
-- ------------------------------------------------------------

alter table public.orders
  add column if not exists project_phase text null,
  add column if not exists delivered_at timestamptz null,
  add column if not exists completed_at timestamptz null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_project_phase_check'
  ) then
    alter table public.orders
      add constraint orders_project_phase_check
      check (
        project_phase is null or project_phase in (
          'submitted', 'management_review', 'approved',
          'awaiting_payment', 'planning', 'production',
          'internal_review', 'client_review', 'revision',
          'final_review', 'awaiting_final_payment',
          'ready_for_delivery', 'delivered', 'completed', 'archived'
        )
      );
  end if;
end $$;

comment on column public.orders.project_phase is
  'Operational phase, independent from workflow status and progress percent.';

-- ------------------------------------------------------------
-- 2. FILE ROLE EXTENSION (same files table, richer roles)
-- ------------------------------------------------------------

alter table public.order_files
  drop constraint if exists order_files_file_role_check;

alter table public.order_files
  add constraint order_files_file_role_check
  check (
    file_role in (
      'customer_reference',
      'project_asset',
      'working_file',
      'deliverable',
      'final_deliverable'
    )
  );

comment on column public.order_files.file_role is
  'Purpose of an order file: customer_reference, project_asset, working_file, deliverable or final_deliverable.';

-- ------------------------------------------------------------
-- 3. WORK MILESTONES (distinct from payment schedule table)
-- ------------------------------------------------------------

create table if not exists public.project_milestones (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  title text not null,
  description text null,
  sequence integer not null default 0,
  status text not null default 'pending'
    check (status in ('pending', 'active', 'blocked', 'done', 'cancelled')),
  expected_date date null,
  completed_date date null,
  completed_by uuid null references auth.users(id) on delete set null,
  client_visible boolean not null default true,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists project_milestones_order_idx
  on public.project_milestones (order_id, sequence);

-- ------------------------------------------------------------
-- 4. PROJECT TASKS (internal vs client-visible)
-- ------------------------------------------------------------

create table if not exists public.project_tasks (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  milestone_id uuid null references public.project_milestones(id) on delete set null,
  title text not null,
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'done', 'cancelled')),
  client_visible boolean not null default false,
  due_at date null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists project_tasks_order_idx
  on public.project_tasks (order_id, status);

-- ------------------------------------------------------------
-- 5. PROJECT SCOPE (one baseline row per project)
-- ------------------------------------------------------------

create table if not exists public.project_scope (
  order_id uuid primary key references public.orders(id) on delete cascade,
  summary text null,
  deliverables_summary text null,
  included_revisions text null,
  features text null,
  pages text null,
  platforms text null,
  dependencies text null,
  exclusions text null,
  client_responsibilities text null,
  visible_to_client boolean not null default true,
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 6. DELIVERABLES + VERSIONS (history is never replaced)
-- ------------------------------------------------------------

create table if not exists public.project_deliverables (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  title text not null,
  description text null,
  status text not null default 'draft'
    check (status in ('draft', 'in_review', 'approved', 'delivered')),
  client_approval_state text not null default 'none'
    check (client_approval_state in ('none', 'pending', 'approved', 'revision_requested')),
  current_version_id uuid null,
  visible_to_client boolean not null default true,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists project_deliverables_order_idx
  on public.project_deliverables (order_id, created_at desc);

create table if not exists public.deliverable_versions (
  id uuid primary key default gen_random_uuid(),
  deliverable_id uuid not null references public.project_deliverables(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  file_id uuid null references public.order_files(id) on delete set null,
  original_name text null,
  notes text null,
  uploaded_by uuid null references auth.users(id) on delete set null,
  approval_state text not null default 'pending'
    check (approval_state in ('pending', 'approved', 'revision_requested', 'superseded')),
  client_feedback text null,
  decided_at timestamptz null,
  created_at timestamptz not null default now(),
  unique (deliverable_id, version_number)
);

create index if not exists deliverable_versions_deliverable_idx
  on public.deliverable_versions (deliverable_id, version_number desc);

-- current_version_id back-reference (added after both tables exist)
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'project_deliverables_current_version_fk'
  ) then
    alter table public.project_deliverables
      add constraint project_deliverables_current_version_fk
      foreign key (current_version_id)
      references public.deliverable_versions(id)
      on delete set null;
  end if;
end $$;

comment on table public.project_deliverables is
  'Client-facing deliverables. New uploads create versions; history is never replaced.';
comment on column public.project_deliverables.client_approval_state is
  'Mirrors the current version decision so lists stay cheap to render.';

-- ------------------------------------------------------------
-- 7. REVISION REQUESTS (structured, traceable)
-- ------------------------------------------------------------

create table if not exists public.revision_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  deliverable_id uuid null references public.project_deliverables(id) on delete set null,
  version_id uuid null references public.deliverable_versions(id) on delete set null,
  description text not null,
  status text not null default 'open'
    check (status in ('open', 'acknowledged', 'in_progress', 'resolved', 'rejected_out_of_scope')),
  submitted_by uuid null references auth.users(id) on delete set null,
  management_response text null,
  resolved_by uuid null references auth.users(id) on delete set null,
  resolved_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists revision_requests_order_idx
  on public.revision_requests (order_id, status, created_at desc);

comment on table public.revision_requests is
  'Structured revision items. Rejections as out-of-scope should become change requests.';

-- ------------------------------------------------------------
-- 8. CHANGE REQUESTS (scope control)
-- ------------------------------------------------------------

create table if not exists public.change_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  title text not null,
  description text null,
  additional_cost_kobo bigint not null default 0 check (additional_cost_kobo >= 0),
  timeline_impact_days integer not null default 0,
  payment_requirement_note text null,
  requires_client_approval boolean not null default true,
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'accepted', 'declined', 'questioned', 'cancelled', 'implemented')),
  client_message text null,
  decided_at timestamptz null,
  implemented_cost_id uuid null references public.project_cost_items(id) on delete set null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists change_requests_order_idx
  on public.change_requests (order_id, status, created_at desc);

comment on table public.change_requests is
  'Scope changes are explicit. Accepted requests may create an additional project cost.';

-- ------------------------------------------------------------
-- 9. QUOTE ITEMS (itemized quotes)
-- ------------------------------------------------------------

create table if not exists public.order_quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.order_quotes(id) on delete cascade,
  title text not null,
  description text null,
  quantity numeric not null default 1 check (quantity > 0),
  unit_price_kobo bigint not null check (unit_price_kobo >= 0),
  amount_kobo bigint not null check (amount_kobo >= 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists order_quote_items_quote_idx
  on public.order_quote_items (quote_id, sort_order);

comment on table public.order_quote_items is
  'Itemized quote lines. Quote total remains authoritative on order_quotes.amount_kobo.';

-- ------------------------------------------------------------
-- 10. INTERNAL COSTS (management-only profitability)
-- ------------------------------------------------------------

create table if not exists public.internal_costs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  title text not null,
  category text not null default 'miscellaneous'
    check (category in (
      'software', 'freelancer', 'hosting', 'domain',
      'stock_asset', 'advertising', 'contractor', 'miscellaneous'
    )),
  amount_kobo bigint not null check (amount_kobo > 0),
  incurred_at date null,
  note text null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists internal_costs_order_idx
  on public.internal_costs (order_id, incurred_at desc);

comment on table public.internal_costs is
  'Management-only delivery costs. NEVER exposed to clients.';

-- ------------------------------------------------------------
-- 11. CLIENT NOTES (management-only CRM notes)
-- ------------------------------------------------------------

create table if not exists public.client_notes (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  order_id uuid null references public.orders(id) on delete cascade,
  note text not null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists client_notes_customer_idx
  on public.client_notes (customer_id, created_at desc);

comment on table public.client_notes is
  'Internal CRM notes. NEVER visible to clients.';

-- ------------------------------------------------------------
-- 12. PROJECT FEEDBACK (post-completion)
-- ------------------------------------------------------------

create table if not exists public.project_feedback (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  rating integer not null check (rating >= 1 and rating <= 5),
  feedback text null,
  testimonial_permission boolean not null default false,
  submitted_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.project_feedback is
  'Client rating after completion. Only requested once work is delivered.';

-- ------------------------------------------------------------
-- 13. NOTIFICATION PREFERENCES (in-app now, email later)
-- SMTP is NOT configured: email delivery stays disabled.
-- ------------------------------------------------------------

create table if not exists public.notification_preferences (
  customer_id uuid primary key references public.customers(id) on delete cascade,
  in_app_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.notification_preferences is
  'In-app notifications are enabled. Email delivery is unavailable until SMTP is configured and approved.';

-- ------------------------------------------------------------
-- updated_at triggers
-- ------------------------------------------------------------

drop trigger if exists project_milestones_updated on public.project_milestones;
create trigger project_milestones_updated
  before update on public.project_milestones
  for each row execute function public.set_updated_at();

drop trigger if exists project_tasks_updated on public.project_tasks;
create trigger project_tasks_updated
  before update on public.project_tasks
  for each row execute function public.set_updated_at();

drop trigger if exists project_scope_updated on public.project_scope;
create trigger project_scope_updated
  before update on public.project_scope
  for each row execute function public.set_updated_at();

drop trigger if exists project_deliverables_updated on public.project_deliverables;
create trigger project_deliverables_updated
  before update on public.project_deliverables
  for each row execute function public.set_updated_at();

drop trigger if exists revision_requests_updated on public.revision_requests;
create trigger revision_requests_updated
  before update on public.revision_requests
  for each row execute function public.set_updated_at();

drop trigger if exists change_requests_updated on public.change_requests;
create trigger change_requests_updated
  before update on public.change_requests
  for each row execute function public.set_updated_at();

drop trigger if exists client_notes_updated on public.client_notes;
create trigger client_notes_updated
  before update on public.client_notes
  for each row execute function public.set_updated_at();

drop trigger if exists notification_preferences_updated on public.notification_preferences;
create trigger notification_preferences_updated
  before update on public.notification_preferences
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 14. RLS
-- Admin: full via has_admin_access. Clients: read-own visible rows.
-- All client mutations go through the client-project-action edge
-- function (service role + ownership checks), never direct writes.
-- ------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'project_milestones', 'project_tasks', 'project_scope',
    'project_deliverables', 'deliverable_versions',
    'revision_requests', 'change_requests', 'order_quote_items',
    'internal_costs', 'client_notes', 'project_feedback',
    'notification_preferences'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon', t);
    execute format('revoke all on table public.%I from authenticated', t);
    execute format('grant select on table public.%I to authenticated', t);
    execute format('grant insert, update, delete on table public.%I to authenticated', t);
  end loop;
end $$;

-- ---- admin full-access policies ----

drop policy if exists "phase2_admin_all_milestones" on public.project_milestones;
create policy "phase2_admin_all_milestones" on public.project_milestones
  for all to authenticated using (public.has_admin_access()) with check (public.has_admin_access());

drop policy if exists "phase2_admin_all_tasks" on public.project_tasks;
create policy "phase2_admin_all_tasks" on public.project_tasks
  for all to authenticated using (public.has_admin_access()) with check (public.has_admin_access());

drop policy if exists "phase2_admin_all_scope" on public.project_scope;
create policy "phase2_admin_all_scope" on public.project_scope
  for all to authenticated using (public.has_admin_access()) with check (public.has_admin_access());

drop policy if exists "phase2_admin_all_deliverables" on public.project_deliverables;
create policy "phase2_admin_all_deliverables" on public.project_deliverables
  for all to authenticated using (public.has_admin_access()) with check (public.has_admin_access());

drop policy if exists "phase2_admin_all_versions" on public.deliverable_versions;
create policy "phase2_admin_all_versions" on public.deliverable_versions
  for all to authenticated using (public.has_admin_access()) with check (public.has_admin_access());

drop policy if exists "phase2_admin_all_revisions" on public.revision_requests;
create policy "phase2_admin_all_revisions" on public.revision_requests
  for all to authenticated using (public.has_admin_access()) with check (public.has_admin_access());

drop policy if exists "phase2_admin_all_changes" on public.change_requests;
create policy "phase2_admin_all_changes" on public.change_requests
  for all to authenticated using (public.has_admin_access()) with check (public.has_admin_access());

drop policy if exists "phase2_admin_all_quote_items" on public.order_quote_items;
create policy "phase2_admin_all_quote_items" on public.order_quote_items
  for all to authenticated using (public.has_admin_access()) with check (public.has_admin_access());

drop policy if exists "phase2_admin_all_internal_costs" on public.internal_costs;
create policy "phase2_admin_all_internal_costs" on public.internal_costs
  for all to authenticated using (public.has_admin_access()) with check (public.has_admin_access());

drop policy if exists "phase2_admin_all_client_notes" on public.client_notes;
create policy "phase2_admin_all_client_notes" on public.client_notes
  for all to authenticated using (public.has_admin_access()) with check (public.has_admin_access());

drop policy if exists "phase2_admin_all_feedback" on public.project_feedback;
create policy "phase2_admin_all_feedback" on public.project_feedback
  for all to authenticated using (public.has_admin_access()) with check (public.has_admin_access());

drop policy if exists "phase2_admin_all_notif_prefs" on public.notification_preferences;
create policy "phase2_admin_all_notif_prefs" on public.notification_preferences
  for all to authenticated using (public.has_admin_access()) with check (public.has_admin_access());

-- ---- client read-own policies (visible rows only) ----

drop policy if exists "phase2_client_milestones" on public.project_milestones;
create policy "phase2_client_milestones" on public.project_milestones
  for select to authenticated using (
    client_visible = true and exists (
      select 1 from public.orders o
      where o.id = project_milestones.order_id and o.user_id = auth.uid()
    )
  );

drop policy if exists "phase2_client_tasks" on public.project_tasks;
create policy "phase2_client_tasks" on public.project_tasks
  for select to authenticated using (
    client_visible = true and exists (
      select 1 from public.orders o
      where o.id = project_tasks.order_id and o.user_id = auth.uid()
    )
  );

drop policy if exists "phase2_client_scope" on public.project_scope;
create policy "phase2_client_scope" on public.project_scope
  for select to authenticated using (
    visible_to_client = true and exists (
      select 1 from public.orders o
      where o.id = project_scope.order_id and o.user_id = auth.uid()
    )
  );

drop policy if exists "phase2_client_deliverables" on public.project_deliverables;
create policy "phase2_client_deliverables" on public.project_deliverables
  for select to authenticated using (
    visible_to_client = true and exists (
      select 1 from public.orders o
      where o.id = project_deliverables.order_id and o.user_id = auth.uid()
    )
  );

drop policy if exists "phase2_client_versions" on public.deliverable_versions;
create policy "phase2_client_versions" on public.deliverable_versions
  for select to authenticated using (
    exists (
      select 1 from public.project_deliverables d
      join public.orders o on o.id = d.order_id
      where d.id = deliverable_versions.deliverable_id
        and d.visible_to_client = true
        and o.user_id = auth.uid()
    )
  );

drop policy if exists "phase2_client_revisions" on public.revision_requests;
create policy "phase2_client_revisions" on public.revision_requests
  for select to authenticated using (
    exists (
      select 1 from public.orders o
      where o.id = revision_requests.order_id and o.user_id = auth.uid()
    )
  );

drop policy if exists "phase2_client_changes" on public.change_requests;
create policy "phase2_client_changes" on public.change_requests
  for select to authenticated using (
    status <> 'draft' and exists (
      select 1 from public.orders o
      where o.id = change_requests.order_id and o.user_id = auth.uid()
    )
  );

drop policy if exists "phase2_client_quote_items" on public.order_quote_items;
create policy "phase2_client_quote_items" on public.order_quote_items
  for select to authenticated using (
    exists (
      select 1 from public.order_quotes q
      join public.orders o on o.id = q.order_id
      where q.id = order_quote_items.quote_id and o.user_id = auth.uid()
    )
  );

drop policy if exists "phase2_client_feedback" on public.project_feedback;
create policy "phase2_client_feedback" on public.project_feedback
  for select to authenticated using (
    exists (
      select 1 from public.orders o
      where o.id = project_feedback.order_id and o.user_id = auth.uid()
    )
  );

drop policy if exists "phase2_client_notif_prefs" on public.notification_preferences;
create policy "phase2_client_notif_prefs" on public.notification_preferences
  for select to authenticated using (
    exists (
      select 1 from public.customers c
      where c.id = notification_preferences.customer_id and c.user_id = auth.uid()
    )
  );

-- NOTE: internal_costs and client_notes have NO client policy.
-- They remain management-only by design. Client preview must use
-- the same visibility rules (never leak these tables).

-- Reload PostgREST schema cache.
notify pgrst, 'reload schema';
