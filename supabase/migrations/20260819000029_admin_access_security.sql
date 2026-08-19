-- ============================================================
-- POSHO CREATIVE
-- ADMIN ACCESS SECURITY
-- ============================================================

-- ============================================================
-- ADMIN ACCESS SESSIONS
-- Access is tied to one Supabase Auth session_id.
-- ============================================================

create table if not exists public.admin_access_sessions (
  user_id uuid primary key
    references auth.users(id)
    on delete cascade,

  session_id uuid not null,

  verified_at timestamptz
    not null
    default now(),

  expires_at timestamptz
    not null,

  created_at timestamptz
    not null
    default now(),

  updated_at timestamptz
    not null
    default now()
);

create index if not exists
admin_access_sessions_expires_at_idx
on public.admin_access_sessions (
  expires_at
);

drop trigger if exists
admin_access_sessions_set_updated_at
on public.admin_access_sessions;

create trigger
admin_access_sessions_set_updated_at
before update
on public.admin_access_sessions
for each row
execute function public.set_updated_at();

-- ============================================================
-- FAILED ACCESS CODE PROTECTION
-- ============================================================

create table if not exists public.admin_access_security (
  user_id uuid primary key
    references auth.users(id)
    on delete cascade,

  failed_attempts integer
    not null
    default 0
    check (
      failed_attempts >= 0
    ),

  locked_until timestamptz,

  last_failed_at timestamptz,

  created_at timestamptz
    not null
    default now(),

  updated_at timestamptz
    not null
    default now()
);

drop trigger if exists
admin_access_security_set_updated_at
on public.admin_access_security;

create trigger
admin_access_security_set_updated_at
before update
on public.admin_access_security
for each row
execute function public.set_updated_at();

-- ============================================================
-- BOOTSTRAP OFFICIAL POSHO CREATIVE OWNER ACCOUNT
-- ============================================================

insert into public.admin_profiles (
  user_id,
  display_name,
  role,
  active
)
select
  id,
  'Admin',
  'owner',
  true
from auth.users
where lower(email) =
  lower('poshocreative@gmail.com')
on conflict (user_id)
do update set
  display_name = 'Admin',
  role = 'owner',
  active = true,
  updated_at = now();

-- ============================================================
-- AUTOMATIC ADMIN REGISTRATION
-- If the official account is created after this migration.
-- ============================================================

create or replace function
public.bootstrap_posho_admin_account()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if lower(
    coalesce(
      new.email,
      ''
    )
  ) = lower(
    'poshocreative@gmail.com'
  ) then

    insert into public.admin_profiles (
      user_id,
      display_name,
      role,
      active
    )
    values (
      new.id,
      'Admin',
      'owner',
      true
    )
    on conflict (user_id)
    do update set
      display_name = 'Admin',
      role = 'owner',
      active = true,
      updated_at = now();

  end if;

  return new;
end;
$$;

drop trigger if exists
bootstrap_posho_admin_account_trigger
on auth.users;

create trigger
bootstrap_posho_admin_account_trigger
after insert or update of email
on auth.users
for each row
execute function
public.bootstrap_posho_admin_account();

-- ============================================================
-- CHECK WHETHER CURRENT USER IS AN ADMIN ACCOUNT
-- Does NOT mean the access code has been entered yet.
-- ============================================================

create or replace function
public.is_admin_account()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_profiles
    where user_id =
      (select auth.uid())
      and active = true
  );
$$;

-- ============================================================
-- CHECK ADMIN ACCESS FOR CURRENT LOGIN SESSION
-- ============================================================

create or replace function
public.has_admin_access()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_profiles ap
    inner join public.admin_access_sessions aas
      on aas.user_id = ap.user_id
    where ap.user_id =
      (select auth.uid())
      and ap.active = true
      and aas.expires_at > now()
      and aas.session_id::text =
        coalesce(
          (
            select auth.jwt()
          ) ->> 'session_id',
          ''
        )
  );
$$;

-- ============================================================
-- REDEFINE EXISTING ADMIN HELPER
-- All existing admin RLS policies now require BOTH:
--   1. Admin profile
--   2. Verified access code for current session
-- ============================================================

create or replace function
public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_admin_access();
$$;

-- ============================================================
-- SECURITY
-- ============================================================

alter table
public.admin_access_sessions
enable row level security;

alter table
public.admin_access_security
enable row level security;

revoke all
on table
public.admin_access_sessions
from anon;

revoke all
on table
public.admin_access_sessions
from authenticated;

revoke all
on table
public.admin_access_security
from anon;

revoke all
on table
public.admin_access_security
from authenticated;

revoke all
on function
public.is_admin_account()
from public;

revoke all
on function
public.has_admin_access()
from public;

revoke all
on function
public.is_admin()
from public;

grant execute
on function
public.is_admin_account()
to authenticated;

grant execute
on function
public.has_admin_access()
to authenticated;

grant execute
on function
public.is_admin()
to authenticated;

comment on table
public.admin_access_sessions is
'Session-bound Posho Creative administrative access verification.';

comment on table
public.admin_access_security is
'Tracks failed Posho Creative administrative access-code attempts.';