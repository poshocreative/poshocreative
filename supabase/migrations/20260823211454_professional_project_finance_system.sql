-- ==========================================================
-- POSHO CREATIVE
-- PROFESSIONAL PROJECT FINANCE SYSTEM
-- ==========================================================


create table if not exists public.part_payment_requests (

id uuid primary key default gen_random_uuid(),

project_id uuid not null
references public.orders(id)
on delete cascade,

customer_id uuid not null
references auth.users(id)
on delete cascade,

requested_amount numeric(12,2) not null,

reason text,

status text not null default 'pending'
check(
status in(
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



create table if not exists public.project_payment_plans (

id uuid primary key default gen_random_uuid(),

project_id uuid not null
references public.orders(id)
on delete cascade,

original_amount numeric(12,2) not null,

approved_initial_payment numeric(12,2) not null,

amount_paid numeric(12,2)
default 0,

remaining_balance numeric(12,2)
not null,

status text default 'active'
check(
status in(
'active',
'completed',
'cancelled'
)
),

deadline date,

terms text,

created_by uuid
references auth.users(id),

created_at timestamptz default now(),

updated_at timestamptz default now()

);



create table if not exists public.project_additional_costs (

id uuid primary key default gen_random_uuid(),

project_id uuid not null
references public.orders(id)
on delete cascade,

title text not null,

description text,

amount numeric(12,2) not null,

status text default 'pending'
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



create table if not exists public.project_payment_transactions (

id uuid primary key default gen_random_uuid(),

project_id uuid not null
references public.orders(id)
on delete cascade,

customer_id uuid
references auth.users(id),

amount numeric(12,2) not null,

provider text default 'flutterwave',

transaction_reference text,

status text default 'pending'
check(
status in(
'pending',
'success',
'failed'
)
),

payment_type text default 'milestone',

created_at timestamptz default now()

);



create table if not exists public.project_activity_logs (

id uuid primary key default gen_random_uuid(),

project_id uuid not null
references public.orders(id)
on delete cascade,

actor_id uuid
references auth.users(id),

title text not null,

description text,

created_at timestamptz default now()

);



-- ==========================================================
-- INDEXES
-- ==========================================================


create index if not exists idx_payment_requests_project
on public.part_payment_requests(project_id);


create index if not exists idx_payment_plans_project
on public.project_payment_plans(project_id);


create index if not exists idx_additional_cost_project
on public.project_additional_costs(project_id);


create index if not exists idx_transactions_project
on public.project_payment_transactions(project_id);


create index if not exists idx_activity_project
on public.project_activity_logs(project_id);



-- ==========================================================
-- RLS
-- ==========================================================


alter table public.part_payment_requests
enable row level security;


alter table public.project_payment_plans
enable row level security;


alter table public.project_additional_costs
enable row level security;


alter table public.project_payment_transactions
enable row level security;


alter table public.project_activity_logs
enable row level security;



-- CUSTOMER REQUESTS

create policy
"customers create payment requests"

on public.part_payment_requests

for insert

with check(
customer_id = auth.uid()
);



create policy
"customers view own requests"

on public.part_payment_requests

for select

using(
customer_id = auth.uid()
);



-- CUSTOMER PAYMENT PLANS

create policy
"customers view payment plans"

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



-- CUSTOMER ADDITIONAL COSTS

create policy
"customers view additional costs"

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



-- CUSTOMER TRANSACTIONS

create policy
"customers view transactions"

on public.project_payment_transactions

for select

using(
customer_id = auth.uid()
);



-- CUSTOMER ACTIVITY

create policy
"customers view activity"

on public.project_activity_logs

for select

using(

exists(

select 1

from public.orders o

where o.id = project_id

and o.user_id = auth.uid()

)

);