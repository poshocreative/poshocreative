-- ==========================================================
-- POSHO CREATIVE
-- PROFESSIONAL PROJECT PAYMENT SYSTEM
-- ==========================================================


-- ==========================================================
-- PART PAYMENT REQUESTS
-- ==========================================================

create table if not exists public.part_payment_requests (

  id uuid primary key default gen_random_uuid(),

  project_id uuid not null
    references public.orders(id)
    on delete cascade,

  customer_id uuid not null
    references auth.users(id)
    on delete cascade,

  requested_amount numeric(12,2) not null
    check (requested_amount > 0),

  reason text,

  status text not null default 'pending'
    check (
      status in (
        'pending',
        'approved',
        'declined'
      )
    ),

  admin_response text,

  reviewed_by uuid
    references auth.users(id),

  reviewed_at timestamptz,

  created_at timestamptz default now(),

  updated_at timestamptz default now()

);



-- ==========================================================
-- APPROVED PAYMENT PLANS
-- ==========================================================

create table if not exists public.project_payment_plans (

  id uuid primary key default gen_random_uuid(),

  project_id uuid not null
    references public.orders(id)
    on delete cascade,

  original_amount numeric(12,2)
    not null,

  approved_initial_payment numeric(12,2)
    not null,

  amount_paid numeric(12,2)
    default 0,

  remaining_balance numeric(12,2)
    not null,

  payment_status text not null default 'active'
    check (
      payment_status in (
        'active',
        'completed',
        'cancelled'
      )
    ),

  payment_deadline date,

  terms text,

  created_by uuid
    references auth.users(id),

  created_at timestamptz default now(),

  updated_at timestamptz default now()

);



-- ==========================================================
-- ADDITIONAL PROJECT COSTS
-- ==========================================================

create table if not exists public.project_additional_costs (

  id uuid primary key default gen_random_uuid(),

  project_id uuid not null
    references public.orders(id)
    on delete cascade,

  title text not null,

  description text,

  amount numeric(12,2)
    not null
    check(amount > 0),

  status text not null default 'pending'
    check(
      status in(
        'pending',
        'paid',
        'cancelled'
      )
    ),

  created_by uuid
    references auth.users(id),

  created_at timestamptz default now(),

  updated_at timestamptz default now()

);



-- ==========================================================
-- UPDATED TIMESTAMP TRIGGER
-- ==========================================================

create or replace function public.update_project_payment_timestamp()

returns trigger

language plpgsql

as $$

begin

new.updated_at = now();

return new;

end;

$$;



create trigger update_part_payment_requests_timestamp

before update
on public.part_payment_requests

for each row

execute function public.update_project_payment_timestamp();



create trigger update_payment_plans_timestamp

before update
on public.project_payment_plans

for each row

execute function public.update_project_payment_timestamp();



create trigger update_additional_costs_timestamp

before update
on public.project_additional_costs

for each row

execute function public.update_project_payment_timestamp();



-- ==========================================================
-- INDEXES
-- ==========================================================

create index if not exists idx_part_payment_project

on public.part_payment_requests(project_id);



create index if not exists idx_part_payment_customer

on public.part_payment_requests(customer_id);



create index if not exists idx_payment_plan_project

on public.project_payment_plans(project_id);



create index if not exists idx_additional_cost_project

on public.project_additional_costs(project_id);



-- ==========================================================
-- SECURITY
-- ==========================================================

alter table public.part_payment_requests enable row level security;

alter table public.project_payment_plans enable row level security;

alter table public.project_additional_costs enable row level security;



-- Customers can see their own requests

create policy "customers view own payment requests"

on public.part_payment_requests

for select

using(
 customer_id = auth.uid()
);



-- Customers can create requests

create policy "customers create payment requests"

on public.part_payment_requests

for insert

with check(
 customer_id = auth.uid()
);



-- Customers view payment plans

create policy "customers view own payment plans"

on public.project_payment_plans

for select

using(

exists(

select 1

from public.orders o

where o.id = project_id

and o.user_id = auth.uid()

)

);



-- Customers view additional costs

create policy "customers view project additional costs"

on public.project_additional_costs

for select

using(

exists(

select 1

from public.orders o

where o.id = project_id

and o.user_id = auth.uid()

)

);