-- ============================================================
-- POSHO CREATIVE — PHASE 3 SCALE OPERATIONS (LOCAL MIGRATION)
-- Extends the existing model. Creates no competing systems:
-- money stays in payment_transactions, files in order_files,
-- delivery in project_* tables from Phase 2.
-- DO NOT APPLY REMOTELY without explicit owner authorization.
--
-- Contents:
--  1. team_members + capability model (owner bypass preserved)
--  2. leads + lead_activity (pre-client pipeline)
--  3. proposals + proposal_items (versioned commercial docs)
--  4. service_packages, milestone templates, intake fields
--  5. agreement_templates + agreements (acceptance, not legal advice)
--  6. service_requests + request_comments (retainer-ready, flexible)
--  7. retainers + retainer_periods (no auto-charging)
--  8. organizations + organization_members (permission-scoped)
--  9. proof_annotations (metadata only, originals untouched)
-- 10. automations + automation_runs (in-app actions only)
-- 11. time_entries + resource_allocations (capacity decisions)
-- 12. task_dependencies + task field extensions
-- 13. meetings (in-app reminders, no fake emails)
-- 14. project_postmortems (private learning)
-- 15. saved_views, ops_inbox_state (operational workflow)
-- 16. business_settings, feature_flags, sop_articles
-- 17. orders.organization_id link
-- 18. RLS: admin full, team scoped read, clients own-visible
-- ============================================================

-- ------------------------------------------------------------
-- 1. TEAM + CAPABILITIES
-- Single admin keeps full access via has_admin_access().
-- Team members get capabilities; sensitive checks run server-side.
-- ------------------------------------------------------------

create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null unique references auth.users(id) on delete set null,
  display_name text not null,
  email text null,
  role text not null default 'support'
    check (role in (
      'owner', 'administrator', 'project_manager', 'finance',
      'creative', 'developer', 'client_success', 'support', 'viewer'
    )),
  capabilities jsonb not null default '[]'::jsonb,
  status text not null default 'active'
    check (status in ('active', 'disabled')),
  weekly_capacity_minutes integer not null default 2400
    check (weekly_capacity_minutes >= 0),
  timezone text not null default 'Africa/Lagos',
  skills text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists team_members_updated on public.team_members;
create trigger team_members_updated
  before update on public.team_members
  for each row execute function public.set_updated_at();

create or replace function public.is_team_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.team_members
    where user_id = auth.uid() and status = 'active'
  );
$$;

revoke all on function public.is_team_member() from anon, authenticated;
grant execute on function public.is_team_member() to authenticated;

create or replace function public.has_capability(cap text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.has_admin_access()
    or exists (
      select 1 from public.team_members
      where user_id = auth.uid()
        and status = 'active'
        and (
          role = 'owner'
          or capabilities @> to_jsonb(cap)
        )
    );
$$;

revoke all on function public.has_capability(text) from anon, authenticated;
grant execute on function public.has_capability(text) to authenticated;

comment on function public.has_capability(text) is
  'Capability check for team authorization. Owner account bypasses via has_admin_access.';

-- ------------------------------------------------------------
-- 2. LEADS (pre-client pipeline)
-- ------------------------------------------------------------

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  name text not null,
  company text null,
  email text null,
  phone text null,
  source text not null default 'other'
    check (source in (
      'google', 'instagram', 'whatsapp', 'referral', 'existing_client',
      'website', 'linkedin', 'facebook', 'offline', 'other'
    )),
  service_slug text null,
  expected_value_kobo bigint not null default 0
    check (expected_value_kobo >= 0),
  notes text null,
  owner_id uuid null references public.team_members(id) on delete set null,
  stage text not null default 'new'
    check (stage in (
      'new', 'contacted', 'qualified', 'discovery', 'proposal_prepared',
      'proposal_sent', 'negotiation', 'won', 'lost', 'archived'
    )),
  next_action text null,
  next_action_due date null,
  last_contact_at timestamptz null,
  lost_reason text null,
  converted_customer_id uuid null references public.customers(id) on delete set null,
  converted_order_id uuid null references public.orders(id) on delete set null,
  archived_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists leads_stage_idx on public.leads (stage) where archived_at is null;
create index if not exists leads_email_idx on public.leads (email);
create index if not exists leads_phone_idx on public.leads (phone);
create index if not exists leads_next_action_idx on public.leads (next_action_due) where archived_at is null;

drop trigger if exists leads_updated on public.leads;
create trigger leads_updated
  before update on public.leads
  for each row execute function public.set_updated_at();

create table if not exists public.lead_activity (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  actor_id uuid null references auth.users(id) on delete set null,
  action text not null,
  note text null,
  created_at timestamptz not null default now()
);

create index if not exists lead_activity_lead_idx on public.lead_activity (lead_id, created_at desc);

-- ------------------------------------------------------------
-- 3. PROPOSALS (versioned commercial documents)
-- ------------------------------------------------------------

create table if not exists public.proposals (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  lead_id uuid null references public.leads(id) on delete set null,
  order_id uuid null references public.orders(id) on delete set null,
  customer_id uuid null references public.customers(id) on delete set null,
  title text not null,
  overview text null,
  goals text null,
  scope text null,
  deliverables text null,
  timeline text null,
  terms text null,
  valid_until date null,
  status text not null default 'draft'
    check (status in (
      'draft', 'ready', 'sent', 'viewed', 'accepted',
      'declined', 'expired', 'superseded'
    )),
  version integer not null default 1 check (version > 0),
  parent_id uuid null references public.proposals(id) on delete set null,
  subtotal_kobo bigint not null default 0 check (subtotal_kobo >= 0),
  discount_kobo bigint not null default 0 check (discount_kobo >= 0),
  total_kobo bigint not null default 0 check (total_kobo >= 0),
  decided_by uuid null references auth.users(id) on delete set null,
  decided_at timestamptz null,
  decision_note text null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists proposals_status_idx on public.proposals (status);
create index if not exists proposals_lead_idx on public.proposals (lead_id);
create index if not exists proposals_order_idx on public.proposals (order_id);
create index if not exists proposals_customer_idx on public.proposals (customer_id);

drop trigger if exists proposals_updated on public.proposals;
create trigger proposals_updated
  before update on public.proposals
  for each row execute function public.set_updated_at();

create table if not exists public.proposal_items (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  title text not null,
  description text null,
  quantity numeric not null default 1 check (quantity > 0),
  unit_price_kobo bigint not null check (unit_price_kobo >= 0),
  amount_kobo bigint not null check (amount_kobo >= 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists proposal_items_proposal_idx
  on public.proposal_items (proposal_id, sort_order);

-- ------------------------------------------------------------
-- 4. SERVICE PACKAGES, MILESTONE TEMPLATES, INTAKE FIELDS
-- ------------------------------------------------------------

create table if not exists public.service_packages (
  id uuid primary key default gen_random_uuid(),
  service_slug text not null,
  name text not null,
  tagline text null,
  features jsonb not null default '[]'::jsonb,
  price_kobo bigint null check (price_kobo is null or price_kobo >= 0),
  pricing_model text not null default 'package'
    check (pricing_model in (
      'fixed', 'starting_from', 'custom_quote', 'hourly', 'retainer',
      'subscription', 'package'
    )),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists service_packages_slug_idx
  on public.service_packages (service_slug, sort_order);

drop trigger if exists service_packages_updated on public.service_packages;
create trigger service_packages_updated
  before update on public.service_packages
  for each row execute function public.set_updated_at();

create table if not exists public.service_milestone_templates (
  id uuid primary key default gen_random_uuid(),
  service_slug text not null,
  title text not null,
  description text null,
  sequence integer not null default 0,
  default_duration_days integer not null default 7
    check (default_duration_days >= 0),
  created_at timestamptz not null default now()
);

create index if not exists service_milestone_templates_slug_idx
  on public.service_milestone_templates (service_slug, sequence);

create table if not exists public.service_intake_fields (
  id uuid primary key default gen_random_uuid(),
  service_slug text not null,
  field_key text not null,
  label text not null,
  field_type text not null default 'text'
    check (field_type in (
      'text', 'textarea', 'number', 'date', 'select', 'multi_select',
      'radio', 'checkbox', 'url', 'email', 'file'
    )),
  required boolean not null default false,
  options jsonb not null default '[]'::jsonb,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (service_slug, field_key)
);

-- ------------------------------------------------------------
-- 5. AGREEMENTS (acceptance records; wording needs legal review)
-- ------------------------------------------------------------

create table if not exists public.agreement_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  body text not null,
  version integer not null default 1 check (version > 0),
  active boolean not null default true,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists agreement_templates_updated on public.agreement_templates;
create trigger agreement_templates_updated
  before update on public.agreement_templates
  for each row execute function public.set_updated_at();

create table if not exists public.agreements (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  template_id uuid null references public.agreement_templates(id) on delete set null,
  title text not null,
  body text not null,
  body_hash text not null,
  version integer not null default 1 check (version > 0),
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'accepted', 'declined')),
  accepted_by uuid null references auth.users(id) on delete set null,
  accepted_at timestamptz null,
  consent_note text null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agreements_order_idx on public.agreements (order_id, created_at desc);

drop trigger if exists agreements_updated on public.agreements;
create trigger agreements_updated
  before update on public.agreements
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 6. SERVICE REQUESTS (retainer-ready, credit-flexible)
-- ------------------------------------------------------------

create table if not exists public.service_requests (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  customer_id uuid not null references public.customers(id) on delete restrict,
  organization_id uuid null,
  order_id uuid null references public.orders(id) on delete set null,
  retainer_id uuid null,
  service_slug text not null,
  title text not null,
  description text not null,
  priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high', 'urgent')),
  status text not null default 'new'
    check (status in (
      'new', 'assigned', 'active', 'waiting_on_client',
      'awaiting_review', 'completed', 'cancelled'
    )),
  assignee_id uuid null references public.team_members(id) on delete set null,
  due_date date null,
  checklist jsonb not null default '[]'::jsonb,
  billing_status text not null default 'included'
    check (billing_status in ('included', 'billable', 'billed', 'courtesy', 'one_off')),
  billing_amount_kobo bigint not null default 0
    check (billing_amount_kobo >= 0),
  billing_cost_id uuid null references public.project_cost_items(id) on delete set null,
  creator_user_id uuid null references auth.users(id) on delete set null,
  creator_kind text not null default 'client'
    check (creator_kind in ('client', 'team')),
  completed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists service_requests_status_idx
  on public.service_requests (status, priority, due_date);
create index if not exists service_requests_customer_idx
  on public.service_requests (customer_id, created_at desc);
create index if not exists service_requests_assignee_idx
  on public.service_requests (assignee_id, status);

drop trigger if exists service_requests_updated on public.service_requests;
create trigger service_requests_updated
  before update on public.service_requests
  for each row execute function public.set_updated_at();

create table if not exists public.request_comments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.service_requests(id) on delete cascade,
  author_user_id uuid null references auth.users(id) on delete set null,
  author_kind text not null default 'team'
    check (author_kind in ('client', 'team')),
  body text not null,
  internal boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists request_comments_request_idx
  on public.request_comments (request_id, created_at);

-- ------------------------------------------------------------
-- 7. RETAINERS (no automatic charging)
-- ------------------------------------------------------------

create table if not exists public.retainers (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete restrict,
  organization_id uuid null,
  service_slug text not null,
  title text not null,
  monthly_amount_kobo bigint not null check (monthly_amount_kobo >= 0),
  included_minutes integer not null default 0
    check (included_minutes >= 0),
  billing_day integer not null default 1
    check (billing_day >= 1 and billing_day <= 28),
  start_date date not null,
  end_date date null,
  status text not null default 'draft'
    check (status in ('draft', 'active', 'paused', 'cancelled', 'expired')),
  overage_policy text not null default 'approve'
    check (overage_policy in ('stop', 'charge', 'approve', 'upgrade')),
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists retainers_customer_idx on public.retainers (customer_id, status);

drop trigger if exists retainers_updated on public.retainers;
create trigger retainers_updated
  before update on public.retainers
  for each row execute function public.set_updated_at();

create table if not exists public.retainer_periods (
  id uuid primary key default gen_random_uuid(),
  retainer_id uuid not null references public.retainers(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  included_minutes integer not null default 0,
  used_minutes integer not null default 0 check (used_minutes >= 0),
  requests_total integer not null default 0,
  requests_completed integer not null default 0,
  revenue_kobo bigint not null default 0,
  status text not null default 'open'
    check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (retainer_id, period_start)
);

drop trigger if exists retainer_periods_updated on public.retainer_periods;
create trigger retainer_periods_updated
  before update on public.retainer_periods
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 8. ORGANIZATIONS (permission-scoped membership)
-- ------------------------------------------------------------

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  primary_customer_id uuid null references public.customers(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists organizations_updated on public.organizations;
create trigger organizations_updated
  before update on public.organizations
  for each row execute function public.set_updated_at();

create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  org_role text not null default 'member'
    check (org_role in ('owner', 'billing', 'member', 'reviewer', 'viewer')),
  can_pay boolean not null default false,
  can_view_finance boolean not null default false,
  can_approve boolean not null default false,
  can_upload boolean not null default true,
  can_request boolean not null default true,
  can_invite boolean not null default false,
  created_at timestamptz not null default now(),
  unique (organization_id, customer_id)
);

-- link requests + retainers to organizations (added after table exists)
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'service_requests_organization_fk'
  ) then
    alter table public.service_requests
      add constraint service_requests_organization_fk
      foreign key (organization_id)
      references public.organizations(id)
      on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'service_requests_retainer_fk'
  ) then
    alter table public.service_requests
      add constraint service_requests_retainer_fk
      foreign key (retainer_id)
      references public.retainers(id)
      on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'retainers_organization_fk'
  ) then
    alter table public.retainers
      add constraint retainers_organization_fk
      foreign key (organization_id)
      references public.organizations(id)
      on delete set null;
  end if;
end $$;

-- orders carry an organization snapshot link
alter table public.orders
  add column if not exists organization_id uuid null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_organization_fk'
  ) then
    alter table public.orders
      add constraint orders_organization_fk
      foreign key (organization_id)
      references public.organizations(id)
      on delete set null;
  end if;
end $$;

-- ------------------------------------------------------------
-- 9. PROOF ANNOTATIONS (metadata only; originals untouched)
-- ------------------------------------------------------------

create table if not exists public.proof_annotations (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.deliverable_versions(id) on delete cascade,
  file_id uuid null references public.order_files(id) on delete set null,
  page integer null check (page is null or page > 0),
  x numeric null check (x is null or (x >= 0 and x <= 100)),
  y numeric null check (y is null or (y >= 0 and y <= 100)),
  video_timestamp_seconds integer null check (video_timestamp_seconds is null or video_timestamp_seconds >= 0),
  body text not null,
  author_user_id uuid null references auth.users(id) on delete set null,
  author_kind text not null default 'team'
    check (author_kind in ('client', 'team')),
  status text not null default 'open'
    check (status in ('open', 'acknowledged', 'resolved', 'reopened')),
  parent_id uuid null references public.proof_annotations(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists proof_annotations_version_idx
  on public.proof_annotations (version_id, created_at);

drop trigger if exists proof_annotations_updated on public.proof_annotations;
create trigger proof_annotations_updated
  before update on public.proof_annotations
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 10. AUTOMATIONS (deterministic; in-app actions only)
-- Destructive/financial actions are never automated.
-- ------------------------------------------------------------

create table if not exists public.automations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text null,
  trigger_event text not null,
  conditions jsonb not null default '[]'::jsonb,
  actions jsonb not null default '[]'::jsonb,
  enabled boolean not null default true,
  run_count integer not null default 0,
  last_run_at timestamptz null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists automations_updated on public.automations;
create trigger automations_updated
  before update on public.automations
  for each row execute function public.set_updated_at();

create table if not exists public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  automation_id uuid not null references public.automations(id) on delete cascade,
  trigger_event text not null,
  entity_type text null,
  entity_id text null,
  order_id uuid null references public.orders(id) on delete set null,
  status text not null default 'completed'
    check (status in ('completed', 'partial', 'failed', 'skipped')),
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists automation_runs_automation_idx
  on public.automation_runs (automation_id, created_at desc);
create index if not exists automation_runs_order_idx
  on public.automation_runs (order_id, created_at desc);

-- ------------------------------------------------------------
-- 11. TIME + ALLOCATIONS
-- ------------------------------------------------------------

create table if not exists public.time_entries (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  task_id uuid null references public.project_tasks(id) on delete set null,
  member_id uuid null references public.team_members(id) on delete set null,
  entry_date date not null,
  minutes integer not null check (minutes > 0),
  billable boolean not null default true,
  description text null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists time_entries_order_idx
  on public.time_entries (order_id, entry_date desc);
create index if not exists time_entries_member_idx
  on public.time_entries (member_id, entry_date desc);

create table if not exists public.resource_allocations (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.team_members(id) on delete cascade,
  order_id uuid null references public.orders(id) on delete cascade,
  week_start date not null,
  minutes integer not null check (minutes > 0),
  tentative boolean not null default false,
  note text null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists resource_allocations_member_idx
  on public.resource_allocations (member_id, week_start);

-- ------------------------------------------------------------
-- 12. TASK EXTENSIONS (priority, assignee, estimates, deps)
-- ------------------------------------------------------------

alter table public.project_tasks
  add column if not exists description text null,
  add column if not exists priority text not null default 'normal',
  add column if not exists estimate_minutes integer null
    check (estimate_minutes is null or estimate_minutes >= 0),
  add column if not exists assignee_id uuid null,
  add column if not exists started_at timestamptz null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'project_tasks_priority_check'
  ) then
    alter table public.project_tasks
      add constraint project_tasks_priority_check
      check (priority in ('low', 'normal', 'high', 'urgent'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'project_tasks_assignee_fk'
  ) then
    alter table public.project_tasks
      add constraint project_tasks_assignee_fk
      foreign key (assignee_id)
      references public.team_members(id)
      on delete set null;
  end if;
end $$;

-- widen task statuses for a professional workflow
alter table public.project_tasks
  drop constraint if exists project_tasks_status_check;

alter table public.project_tasks
  add constraint project_tasks_status_check
  check (status in (
    'backlog', 'ready', 'open', 'in_progress', 'in_review',
    'blocked', 'waiting_on_client', 'done', 'cancelled'
  ));

create table if not exists public.task_dependencies (
  task_id uuid not null references public.project_tasks(id) on delete cascade,
  depends_on_task_id uuid not null references public.project_tasks(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (task_id, depends_on_task_id),
  check (task_id <> depends_on_task_id)
);

create index if not exists task_dependencies_blocker_idx
  on public.task_dependencies (depends_on_task_id);

-- ------------------------------------------------------------
-- 13. MEETINGS (in-app reminders; no email claims)
-- ------------------------------------------------------------

create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid null references public.leads(id) on delete set null,
  customer_id uuid null references public.customers(id) on delete set null,
  order_id uuid null references public.orders(id) on delete set null,
  kind text not null default 'discovery'
    check (kind in ('discovery', 'kickoff', 'review', 'support')),
  scheduled_at timestamptz not null,
  duration_minutes integer not null default 30 check (duration_minutes > 0),
  status text not null default 'scheduled'
    check (status in ('scheduled', 'completed', 'cancelled', 'no_show', 'rescheduled')),
  participants text null,
  notes text null,
  outcome text null,
  next_action text null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists meetings_scheduled_idx on public.meetings (scheduled_at, status);

drop trigger if exists meetings_updated on public.meetings;
create trigger meetings_updated
  before update on public.meetings
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 14. POSTMORTEMS (private learning)
-- ------------------------------------------------------------

create table if not exists public.project_postmortems (
  order_id uuid primary key references public.orders(id) on delete cascade,
  went_well text null,
  delays text null,
  scope_accuracy text null,
  pricing_accuracy text null,
  revision_issues text null,
  learnings text null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists project_postmortems_updated on public.project_postmortems;
create trigger project_postmortems_updated
  before update on public.project_postmortems
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 15. SAVED VIEWS + INBOX STATE
-- ------------------------------------------------------------

create table if not exists public.saved_views (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  scope text not null
    check (scope in ('projects', 'requests', 'tasks', 'leads', 'finance')),
  name text not null,
  filters jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists saved_views_owner_idx
  on public.saved_views (owner_user_id, scope);

create table if not exists public.ops_inbox_state (
  item_key text primary key,
  state text not null default 'open'
    check (state in ('open', 'snoozed', 'resolved')),
  snoozed_until timestamptz null,
  assignee_id uuid null references public.team_members(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 16. SETTINGS, FLAGS, SOPS
-- ------------------------------------------------------------

create table if not exists public.business_settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid null references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.business_settings (key, value) values
  ('quote_validity_days', '7'),
  ('payment_deadline_days', '7'),
  ('default_revision_allowance', '2'),
  ('currency', '"NGN"'),
  ('business_timezone', '"Africa/Lagos"'),
  ('business_hours', '{"days": [1, 2, 3, 4, 5], "start": "09:00", "end": "17:00"}'),
  ('reference_prefixes', '{"project": "POS", "payment": "PAY", "request": "REQ", "lead": "LD", "proposal": "PROP"}')
on conflict (key) do nothing;

create table if not exists public.feature_flags (
  key text primary key,
  enabled boolean not null default true,
  updated_by uuid null references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.feature_flags (key, enabled) values
  ('sales_crm', true),
  ('proposals', true),
  ('requests', true),
  ('retainers', true),
  ('proofing', true),
  ('time_tracking', true),
  ('automations', true),
  ('organizations', true),
  ('team', true)
on conflict (key) do nothing;

create table if not exists public.sop_articles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  service_slug text null,
  role text null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists sop_articles_updated on public.sop_articles;
create trigger sop_articles_updated
  before update on public.sop_articles
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 18. RLS
-- Admin full via has_admin_access. Team members get scoped reads
-- for operational work; all team mutations go through edge
-- functions with capability checks. Clients see own-visible rows.
-- ------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'team_members', 'leads', 'lead_activity', 'proposals', 'proposal_items',
    'service_packages', 'service_milestone_templates', 'service_intake_fields',
    'agreement_templates', 'agreements', 'service_requests', 'request_comments',
    'retainers', 'retainer_periods', 'organizations', 'organization_members',
    'proof_annotations', 'automations', 'automation_runs', 'time_entries',
    'resource_allocations', 'task_dependencies', 'meetings',
    'project_postmortems', 'saved_views', 'ops_inbox_state',
    'business_settings', 'feature_flags', 'sop_articles'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon', t);
    execute format('revoke all on table public.%I from authenticated', t);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', t);
  end loop;
end $$;

-- admin full-access policies
do $$
declare
  t text;
begin
  foreach t in array array[
    'team_members', 'leads', 'lead_activity', 'proposals', 'proposal_items',
    'service_packages', 'service_milestone_templates', 'service_intake_fields',
    'agreement_templates', 'agreements', 'service_requests', 'request_comments',
    'retainers', 'retainer_periods', 'organizations', 'organization_members',
    'proof_annotations', 'automations', 'automation_runs', 'time_entries',
    'resource_allocations', 'task_dependencies', 'meetings',
    'project_postmortems', 'saved_views', 'ops_inbox_state',
    'business_settings', 'feature_flags', 'sop_articles'
  ] loop
    execute format('drop policy if exists "phase3_admin_all_%s" on public.%I', t, t);
    execute format(
      'create policy "phase3_admin_all_%s" on public.%I for all to authenticated using (public.has_admin_access()) with check (public.has_admin_access())',
      t, t
    );
  end loop;
end $$;

-- team operational reads (mutations via capability-checked edge functions)
do $$
declare
  t text;
begin
  foreach t in array array[
    'leads', 'lead_activity', 'proposals', 'proposal_items',
    'service_requests', 'request_comments',
    'retainers', 'retainer_periods', 'organizations', 'organization_members',
    'proof_annotations', 'time_entries',
    'resource_allocations', 'task_dependencies', 'meetings',
    'service_packages', 'service_milestone_templates', 'service_intake_fields',
    'agreement_templates', 'agreements',
    'automation_runs', 'business_settings', 'feature_flags', 'sop_articles'
  ] loop
    execute format('drop policy if exists "phase3_team_read_%s" on public.%I', t, t);
    execute format(
      'create policy "phase3_team_read_%s" on public.%I for select to authenticated using (public.is_team_member())',
      t, t
    );
  end loop;
end $$;

-- team members see own member row + active roster (no compensation stored anyway)
drop policy if exists "phase3_team_roster" on public.team_members;
create policy "phase3_team_roster" on public.team_members
  for select to authenticated using (public.is_team_member());

-- saved views + inbox state: owners see own; team sees inbox workflow
drop policy if exists "phase3_saved_views_owner" on public.saved_views;
create policy "phase3_saved_views_owner" on public.saved_views
  for select to authenticated using (owner_user_id = auth.uid());

drop policy if exists "phase3_saved_views_team" on public.saved_views;
create policy "phase3_saved_views_team" on public.saved_views
  for select to authenticated using (public.is_team_member());

drop policy if exists "phase3_inbox_team" on public.ops_inbox_state;
create policy "phase3_inbox_team" on public.ops_inbox_state
  for select to authenticated using (public.is_team_member());

drop policy if exists "phase3_automations_team" on public.automations;
create policy "phase3_automations_team" on public.automations
  for select to authenticated using (public.is_team_member());

drop policy if exists "phase3_postmortem_team" on public.project_postmortems;
create policy "phase3_postmortem_team" on public.project_postmortems
  for select to authenticated using (public.is_team_member());

-- ---- client scoped reads ----

-- own service requests + non-internal comments
drop policy if exists "phase3_client_requests" on public.service_requests;
create policy "phase3_client_requests" on public.service_requests
  for select to authenticated using (
    exists (
      select 1 from public.customers c
      where c.id = service_requests.customer_id and c.user_id = auth.uid()
    )
  );

drop policy if exists "phase3_client_request_comments" on public.request_comments;
create policy "phase3_client_request_comments" on public.request_comments
  for select to authenticated using (
    internal = false and exists (
      select 1 from public.service_requests r
      join public.customers c on c.id = r.customer_id
      where r.id = request_comments.request_id and c.user_id = auth.uid()
    )
  );

-- own retainers + periods
drop policy if exists "phase3_client_retainers" on public.retainers;
create policy "phase3_client_retainers" on public.retainers
  for select to authenticated using (
    exists (
      select 1 from public.customers c
      where c.id = retainers.customer_id and c.user_id = auth.uid()
    )
  );

drop policy if exists "phase3_client_retainer_periods" on public.retainer_periods;
create policy "phase3_client_retainer_periods" on public.retainer_periods
  for select to authenticated using (
    exists (
      select 1 from public.retainers r
      join public.customers c on c.id = r.customer_id
      where r.id = retainer_periods.retainer_id and c.user_id = auth.uid()
    )
  );

-- organization membership (own memberships only)
drop policy if exists "phase3_client_org_members" on public.organization_members;
create policy "phase3_client_org_members" on public.organization_members
  for select to authenticated using (
    exists (
      select 1 from public.customers c
      where c.id = organization_members.customer_id and c.user_id = auth.uid()
    )
  );

drop policy if exists "phase3_client_orgs" on public.organizations;
create policy "phase3_client_orgs" on public.organizations
  for select to authenticated using (
    exists (
      select 1 from public.organization_members m
      join public.customers c on c.id = m.customer_id
      where m.organization_id = organizations.id and c.user_id = auth.uid()
    )
  );

-- annotations on own project versions
drop policy if exists "phase3_client_annotations" on public.proof_annotations;
create policy "phase3_client_annotations" on public.proof_annotations
  for select to authenticated using (
    exists (
      select 1 from public.deliverable_versions v
      join public.orders o on o.id = v.order_id
      where v.id = proof_annotations.version_id and o.user_id = auth.uid()
    )
  );

-- proposals addressed to own customer record or own orders
drop policy if exists "phase3_client_proposals" on public.proposals;
create policy "phase3_client_proposals" on public.proposals
  for select to authenticated using (
    status in ('sent', 'viewed', 'accepted', 'declined') and (
      exists (
        select 1 from public.customers c
        where c.id = proposals.customer_id and c.user_id = auth.uid()
      ) or exists (
        select 1 from public.orders o
        where o.id = proposals.order_id and o.user_id = auth.uid()
      )
    )
  );

drop policy if exists "phase3_client_proposal_items" on public.proposal_items;
create policy "phase3_client_proposal_items" on public.proposal_items
  for select to authenticated using (
    exists (
      select 1 from public.proposals p
      where p.id = proposal_items.proposal_id
        and p.status in ('sent', 'viewed', 'accepted', 'declined')
        and (
          exists (
            select 1 from public.customers c
            where c.id = p.customer_id and c.user_id = auth.uid()
          ) or exists (
            select 1 from public.orders o
            where o.id = p.order_id and o.user_id = auth.uid()
          )
        )
    )
  );

-- agreements on own orders (sent or decided)
drop policy if exists "phase3_client_agreements" on public.agreements;
create policy "phase3_client_agreements" on public.agreements
  for select to authenticated using (
    status in ('sent', 'accepted', 'declined') and exists (
      select 1 from public.orders o
      where o.id = agreements.order_id and o.user_id = auth.uid()
    )
  );

-- own meetings
drop policy if exists "phase3_client_meetings" on public.meetings;
create policy "phase3_client_meetings" on public.meetings
  for select to authenticated using (
    exists (
      select 1 from public.customers c
      where c.id = meetings.customer_id and c.user_id = auth.uid()
    ) or exists (
      select 1 from public.orders o
      where o.id = meetings.order_id and o.user_id = auth.uid()
    )
  );

-- feature flags + business hours are safe to expose read-only
drop policy if exists "phase3_public_flags" on public.feature_flags;
create policy "phase3_public_flags" on public.feature_flags
  for select to authenticated using (true);

-- NOTE: internal_costs-equivalent (time rates), postmortems, SOPs,
-- automations config, team roster details and audit internals stay
-- management-only. Client preview must respect the same rules.

-- ------------------------------------------------------------
-- 19. TEAM READS ON PRE-EXISTING TABLES
-- Team members operate through capability-checked edge functions;
-- direct reads below let them see operational data. Mutations
-- stay edge-gated. Internal costs require finance.manage.
-- ------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'orders', 'order_files', 'order_notes', 'order_quotes',
    'order_status_history', 'customers', 'payment_transactions',
    'notification_events', 'admin_activity_log', 'service_catalog',
    'project_milestones', 'project_tasks', 'project_scope',
    'project_deliverables', 'deliverable_versions',
    'revision_requests', 'change_requests', 'order_quote_items',
    'client_notes', 'project_feedback', 'part_payment_requests',
    'project_payment_milestones', 'notification_preferences'
  ] loop
    execute format('drop policy if exists "phase3_team_read_%s" on public.%I', t, t);
    execute format(
      'create policy "phase3_team_read_%s" on public.%I for select to authenticated using (public.is_team_member())',
      t, t
    );
  end loop;
end $$;

drop policy if exists "phase3_team_read_internal_costs" on public.internal_costs;
create policy "phase3_team_read_internal_costs" on public.internal_costs
  for select to authenticated using (
    public.has_admin_access() or public.has_capability('finance.manage')
  );

-- ------------------------------------------------------------
-- 20. CAPABILITY-AWARE PART-PAYMENT REVIEW
-- Same logic as the repair migration, but Finance-role team
-- members may also review. History and guards unchanged.
-- ------------------------------------------------------------

create or replace function public.admin_review_part_payment(
  p_request_id uuid,
  p_decision text,
  p_approved_amount_kobo bigint default null,
  p_approval_expires_at timestamptz default null,
  p_balance_due_at timestamptz default null,
  p_admin_note text default null,
  p_allow_work_to_start boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.part_payment_requests%rowtype;
  v_order public.orders%rowtype;
  v_decision text := lower(trim(coalesce(p_decision, '')));
  v_note text := nullif(left(trim(coalesce(p_admin_note, '')), 3000), '');
  v_outstanding bigint;
  v_now timestamptz := now();
  v_expiry timestamptz;
  v_balance_due timestamptz;
begin
  if not public.has_admin_access()
     and not public.has_capability('finance.manage') then
    raise exception 'Administrative access is required.' using errcode = '42501';
  end if;
  if v_decision not in ('approve', 'decline') then
    raise exception 'Choose Approve or Decline.';
  end if;

  select * into v_request
  from public.part_payment_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Part-payment request could not be found.';
  end if;
  if v_request.status <> 'pending' then
    raise exception 'This request has already been reviewed.';
  end if;

  select * into v_order from public.orders
  where id = v_request.order_id
  for update;

  if not found then
    raise exception 'Project could not be found.';
  end if;

  v_outstanding := greatest(
    coalesce(v_order.quoted_amount_kobo, 0) - coalesce(v_order.paid_amount_kobo, 0),
    0
  );
  if v_outstanding <= 0 then
    raise exception 'There is no outstanding balance on this project.';
  end if;

  if v_decision = 'decline' then
    if char_length(coalesce(v_note, '')) < 5 then
      raise exception 'Provide a clear reason for declining this request.';
    end if;

    update public.part_payment_requests
    set status = 'declined',
        decline_reason = v_note,
        admin_note = v_note,
        reviewed_by = auth.uid(),
        reviewed_at = v_now,
        updated_at = v_now
    where id = v_request.id;

    insert into public.notification_events (
      order_id, customer_id, channel, event_type, status, payload
    ) values (
      v_order.id,
      v_order.customer_id,
      'internal',
      'part_payment_declined',
      'pending',
      jsonb_build_object(
        'reference', v_order.reference,
        'project_title', v_order.project_title,
        'request_id', v_request.id,
        'reason', v_note
      )
    );

    return jsonb_build_object('success', true, 'status', 'declined');
  end if;

  if p_approved_amount_kobo is null or p_approved_amount_kobo <= 0 then
    raise exception 'Enter the installment amount Management is approving.';
  end if;
  if p_approved_amount_kobo >= v_outstanding then
    raise exception 'A part-payment installment must be lower than the full outstanding balance.';
  end if;

  v_expiry := coalesce(p_approval_expires_at, v_now + interval '7 days');
  if v_expiry <= v_now then
    raise exception 'The part-payment approval expiry must be in the future.';
  end if;

  v_balance_due := coalesce(p_balance_due_at, v_expiry + interval '30 days');
  if v_balance_due < v_expiry then
    raise exception 'The remaining-balance due date cannot be earlier than the installment approval expiry.';
  end if;

  update public.part_payment_requests
  set status = 'approved',
      approved_amount_kobo = p_approved_amount_kobo,
      approval_expires_at = v_expiry,
      balance_due_at = v_balance_due,
      allow_work_to_start = coalesce(p_allow_work_to_start, false),
      admin_note = v_note,
      decline_reason = null,
      reviewed_by = auth.uid(),
      reviewed_at = v_now,
      updated_at = v_now
  where id = v_request.id;

  update public.orders
  set customer_action_required = true,
      customer_action_label = 'Part-payment installment approved',
      last_admin_activity_at = v_now
  where id = v_order.id;

  insert into public.notification_events (
    order_id, customer_id, channel, event_type, status, payload
  ) values (
    v_order.id,
    v_order.customer_id,
    'internal',
    'part_payment_approved',
    'pending',
    jsonb_build_object(
      'reference', v_order.reference,
      'project_title', v_order.project_title,
      'request_id', v_request.id,
      'approved_amount_kobo', p_approved_amount_kobo,
      'approval_expires_at', v_expiry,
      'balance_due_at', v_balance_due,
      'allow_work_to_start', coalesce(p_allow_work_to_start, false),
      'message', v_note
    )
  );

  return jsonb_build_object(
    'success', true,
    'status', 'approved',
    'approved_amount_kobo', p_approved_amount_kobo,
    'approval_expires_at', v_expiry,
    'balance_due_at', v_balance_due
  );
end;
$$;

revoke all on function public.admin_review_part_payment(
  uuid, text, bigint, timestamptz, timestamptz, text, boolean
) from public, anon;
grant execute on function public.admin_review_part_payment(
  uuid, text, bigint, timestamptz, timestamptz, text, boolean
) to authenticated;

-- Reload PostgREST schema cache.
notify pgrst, 'reload schema';
