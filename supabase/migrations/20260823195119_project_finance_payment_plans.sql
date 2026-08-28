-- ============================================================
-- POSHO CREATIVE
-- PROJECT FINANCE + PART PAYMENT MANAGEMENT
-- ============================================================

-- ============================================================
-- ORDERS: PRESERVE BASE PROJECT PRICE SEPARATELY
-- ============================================================

alter table public.orders
add column if not exists
base_project_price_kobo bigint;

update public.orders
set base_project_price_kobo =
  greatest(
    coalesce(
      quoted_amount_kobo,
      0
    ),
    0
  )
where base_project_price_kobo
  is null;

alter table public.orders
alter column base_project_price_kobo
set default 0;

alter table public.orders
alter column base_project_price_kobo
set not null;

alter table public.orders
drop constraint if exists
orders_base_project_price_kobo_check;

alter table public.orders
add constraint
orders_base_project_price_kobo_check
check (
  base_project_price_kobo >= 0
);

-- ============================================================
-- ADDITIONAL PROJECT COST LEDGER
-- ============================================================

create table if not exists
public.project_cost_items (
  id uuid primary key
    default gen_random_uuid(),

  order_id uuid not null
    references public.orders(id)
    on delete cascade,

  title text not null,

  description text,

  amount_kobo bigint not null
    check (
      amount_kobo > 0
    ),

  status text not null
    default 'active'
    check (
      status in (
        'active',
        'waived'
      )
    ),

  due_at timestamptz,

  created_by uuid
    references auth.users(id)
    on delete set null,

  created_at timestamptz
    not null
    default now(),

  updated_at timestamptz
    not null
    default now(),

  waived_at timestamptz,

  waived_by uuid
    references auth.users(id)
    on delete set null,

  waive_reason text
);

create index if not exists
project_cost_items_order_status_idx
on public.project_cost_items (
  order_id,
  status,
  created_at desc
);

-- ============================================================
-- PART PAYMENT REQUESTS
-- ============================================================

create table if not exists
public.part_payment_requests (
  id uuid primary key
    default gen_random_uuid(),

  order_id uuid not null
    references public.orders(id)
    on delete cascade,

  customer_id uuid not null
    references public.customers(id)
    on delete cascade,

  requested_by uuid
    references auth.users(id)
    on delete set null,

  reason text not null,

  status text not null
    default 'pending'
    check (
      status in (
        'pending',
        'approved',
        'declined',
        'expired',
        'fulfilled',
        'cancelled'
      )
    ),

  approved_amount_kobo bigint
    check (
      approved_amount_kobo is null
      or approved_amount_kobo > 0
    ),

  approval_expires_at timestamptz,

  balance_due_at timestamptz,

  allow_work_to_start boolean
    not null
    default false,

  admin_note text,

  decline_reason text,

  reviewed_by uuid
    references auth.users(id)
    on delete set null,

  reviewed_at timestamptz,

  fulfilled_at timestamptz,

  created_at timestamptz
    not null
    default now(),

  updated_at timestamptz
    not null
    default now()
);

create index if not exists
part_payment_requests_order_created_idx
on public.part_payment_requests (
  order_id,
  created_at desc
);

create index if not exists
part_payment_requests_status_idx
on public.part_payment_requests (
  status,
  created_at desc
);

drop index if exists
part_payment_requests_one_open_request_idx;

create unique index
part_payment_requests_one_open_request_idx
on public.part_payment_requests (
  order_id
)
where status in (
  'pending',
  'approved'
);

-- ============================================================
-- PAYMENT TRANSACTIONS:
-- IDENTIFY FULL-BALANCE VS APPROVED INSTALLMENT
-- ============================================================

alter table public.payment_transactions
add column if not exists
part_payment_request_id uuid
references public.part_payment_requests(id)
on delete set null;

alter table public.payment_transactions
add column if not exists
payment_scope text
not null
default 'full_balance';

alter table public.payment_transactions
drop constraint if exists
payment_transactions_payment_scope_check;

alter table public.payment_transactions
add constraint
payment_transactions_payment_scope_check
check (
  payment_scope in (
    'full_balance',
    'approved_installment'
  )
);

create index if not exists
payment_transactions_part_payment_request_idx
on public.payment_transactions (
  part_payment_request_id
)
where part_payment_request_id
  is not null;

-- ============================================================
-- RLS
-- ============================================================

alter table
public.project_cost_items
enable row level security;

alter table
public.part_payment_requests
enable row level security;

revoke insert, update, delete
on public.project_cost_items
from anon, authenticated;

revoke insert, update, delete
on public.part_payment_requests
from anon, authenticated;

grant select
on public.project_cost_items
to authenticated;

grant select
on public.part_payment_requests
to authenticated;

-- ============================================================
-- PROJECT COST READ POLICIES
-- ============================================================

drop policy if exists
"Customers can read own project costs"
on public.project_cost_items;

create policy
"Customers can read own project costs"
on public.project_cost_items
for select
to authenticated
using (
  exists (
    select 1
    from public.orders o
    where o.id =
      project_cost_items.order_id
      and o.user_id =
        auth.uid()
  )
);

drop policy if exists
"Admins can read project costs"
on public.project_cost_items;

create policy
"Admins can read project costs"
on public.project_cost_items
for select
to authenticated
using (
  public.has_admin_access()
);

-- ============================================================
-- PART PAYMENT READ POLICIES
-- ============================================================

drop policy if exists
"Customers can read own part payment requests"
on public.part_payment_requests;

create policy
"Customers can read own part payment requests"
on public.part_payment_requests
for select
to authenticated
using (
  exists (
    select 1
    from public.orders o
    where o.id =
      part_payment_requests.order_id
      and o.user_id =
        auth.uid()
  )
);

drop policy if exists
"Admins can read part payment requests"
on public.part_payment_requests;

create policy
"Admins can read part payment requests"
on public.part_payment_requests
for select
to authenticated
using (
  public.has_admin_access()
);

-- ============================================================
-- PROTECT FINANCIAL TOTAL
--
-- Existing Quote Management may still write
-- quoted_amount_kobo.
--
-- If no confirmed payment and no additional costs exist,
-- that legacy write is treated as a new BASE price.
--
-- Once additional costs exist, or confirmed payments exist,
-- financial changes must use the new secured finance RPCs.
-- ============================================================

create or replace function
public.guard_project_financial_total()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_internal_write text;

  v_has_active_costs boolean;
begin
  if new.quoted_amount_kobo
     is distinct from
     old.quoted_amount_kobo then

    v_internal_write :=
      coalesce(
        current_setting(
          'posho.finance_write',
          true
        ),
        ''
      );

    if v_internal_write <> '1' then

      if coalesce(
           old.paid_amount_kobo,
           0
         ) > 0 then

        raise exception
          'The base project price cannot be revised after a confirmed payment. Add an additional project cost instead.';
      end if;

      select exists (
        select 1
        from public.project_cost_items pci
        where pci.order_id =
          old.id
          and pci.status =
            'active'
      )
      into
        v_has_active_costs;

      if v_has_active_costs then
        raise exception
          'This project already has additional costs. Use the Project Finance controls to change its financial position.';
      end if;

      new.base_project_price_kobo :=
        greatest(
          coalesce(
            new.quoted_amount_kobo,
            0
          ),
          0
        );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists
guard_project_financial_total_trigger
on public.orders;

create trigger
guard_project_financial_total_trigger
before update of quoted_amount_kobo
on public.orders
for each row
execute function
public.guard_project_financial_total();

-- ============================================================
-- ADMIN: SET BASE PROJECT PRICE
-- ============================================================

create or replace function
public.admin_set_project_price(
  p_order_id uuid,
  p_amount_kobo bigint,
  p_note text default null,
  p_valid_until timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;

  v_extra_total bigint;

  v_total bigint;

  v_quote_id uuid;

  v_now timestamptz;

  v_valid_until timestamptz;

  v_note text;
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

  if p_amount_kobo is null
     or p_amount_kobo <= 0 then
    raise exception
      'Enter a valid project price.';
  end if;

  select *
  into v_order
  from public.orders
  where id =
    p_order_id
  for update;

  if not found then
    raise exception
      'Project could not be found.';
  end if;

  if v_order.review_decision <>
     'approved' then
    raise exception
      'Approve the project before setting its final price.';
  end if;

  if v_order.status =
     'cancelled' then
    raise exception
      'A cancelled project cannot be repriced.';
  end if;

  if coalesce(
       v_order.paid_amount_kobo,
       0
     ) > 0 then
    raise exception
      'The base project price cannot be changed after a confirmed payment. Add an additional project cost instead.';
  end if;

  select
    coalesce(
      sum(amount_kobo),
      0
    )
  into
    v_extra_total
  from public.project_cost_items
  where order_id =
    v_order.id
    and status =
      'active';

  v_total :=
    p_amount_kobo +
    v_extra_total;

  v_now :=
    now();

  v_valid_until :=
    coalesce(
      p_valid_until,
      v_now +
        interval '7 days'
    );

  if v_valid_until <=
     v_now then
    raise exception
      'The quotation expiry must be in the future.';
  end if;

  v_note :=
    nullif(
      left(
        trim(
          coalesce(
            p_note,
            ''
          )
        ),
        5000
      ),
      ''
    );

  perform set_config(
    'posho.finance_write',
    '1',
    true
  );

  update public.order_quotes
  set status =
    'superseded'
  where order_id =
    v_order.id
    and status =
      'sent';

  insert into public.order_quotes (
    order_id,
    amount_kobo,
    currency,
    status,
    message,
    valid_until,
    created_by,
    sent_at
  )
  values (
    v_order.id,
    v_total,
    coalesce(
      v_order.currency,
      'NGN'
    ),
    'sent',
    coalesce(
      v_note,
      'Your project pricing has been confirmed.'
    ),
    v_valid_until,
    auth.uid(),
    v_now
  )
  returning id
  into v_quote_id;

  update public.orders
  set
    base_project_price_kobo =
      p_amount_kobo,

    quoted_amount_kobo =
      v_total,

    current_quote_id =
      v_quote_id,

    requires_quote =
      false,

    status =
      case
        when status =
             'under_review'
          then 'awaiting_payment'
        else status
      end,

    payment_status =
      'pending',

    customer_action_required =
      true,

    customer_action_label =
      'Project price ready for payment',

    last_admin_activity_at =
      v_now
  where id =
    v_order.id;

  insert into public.notification_events (
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
    'project_price_set',
    'pending',
    jsonb_build_object(
      'reference',
        v_order.reference,

      'project_title',
        v_order.project_title,

      'base_price_kobo',
        p_amount_kobo,

      'additional_costs_kobo',
        v_extra_total,

      'total_project_value_kobo',
        v_total,

      'valid_until',
        v_valid_until,

      'message',
        v_note
    )
  );

  insert into public.admin_activity_log (
    admin_user_id,
    order_id,
    action,
    description,
    metadata
  )
  values (
    auth.uid(),
    v_order.id,
    'project_price_set',
    format(
      'Project base price set to %s kobo.',
      p_amount_kobo
    ),
    jsonb_build_object(
      'base_price_kobo',
        p_amount_kobo,

      'additional_costs_kobo',
        v_extra_total,

      'total_project_value_kobo',
        v_total
    )
  );

  return jsonb_build_object(
    'success',
      true,

    'base_price_kobo',
      p_amount_kobo,

    'additional_costs_kobo',
      v_extra_total,

    'total_project_value_kobo',
      v_total,

    'quote_id',
      v_quote_id,

    'valid_until',
      v_valid_until
  );
end;
$$;

-- ============================================================
-- ADMIN: ADD AN ADDITIONAL PROJECT COST
-- ============================================================

create or replace function
public.admin_add_project_cost(
  p_order_id uuid,
  p_title text,
  p_amount_kobo bigint,
  p_description text default null,
  p_due_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;

  v_item_id uuid;

  v_title text;

  v_description text;

  v_extra_total bigint;

  v_total bigint;

  v_paid bigint;

  v_now timestamptz;
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

  if p_amount_kobo is null
     or p_amount_kobo <= 0 then
    raise exception
      'Enter a valid additional project cost.';
  end if;

  v_title :=
    left(
      trim(
        coalesce(
          p_title,
          ''
        )
      ),
      160
    );

  if char_length(
       v_title
     ) < 3 then
    raise exception
      'Give the additional cost a clear title.';
  end if;

  v_description :=
    nullif(
      left(
        trim(
          coalesce(
            p_description,
            ''
          )
        ),
        3000
      ),
      ''
    );

  select *
  into v_order
  from public.orders
  where id =
    p_order_id
  for update;

  if not found then
    raise exception
      'Project could not be found.';
  end if;

  if v_order.review_decision <>
     'approved' then
    raise exception
      'Approve the project before adding project costs.';
  end if;

  if v_order.status in (
    'completed',
    'cancelled'
  ) then
    raise exception
      'Additional costs cannot be added to a completed or cancelled project.';
  end if;

  if coalesce(
       v_order.base_project_price_kobo,
       0
     ) <= 0 then
    raise exception
      'Set the base project price before adding extra project costs.';
  end if;

  v_now :=
    now();

  insert into public.project_cost_items (
    order_id,
    title,
    description,
    amount_kobo,
    status,
    due_at,
    created_by,
    created_at,
    updated_at
  )
  values (
    v_order.id,
    v_title,
    v_description,
    p_amount_kobo,
    'active',
    p_due_at,
    auth.uid(),
    v_now,
    v_now
  )
  returning id
  into v_item_id;

  select
    coalesce(
      sum(amount_kobo),
      0
    )
  into
    v_extra_total
  from public.project_cost_items
  where order_id =
    v_order.id
    and status =
      'active';

  v_total :=
    v_order.base_project_price_kobo +
    v_extra_total;

  v_paid :=
    coalesce(
      v_order.paid_amount_kobo,
      0
    );

  perform set_config(
    'posho.finance_write',
    '1',
    true
  );

  update public.orders
  set
    quoted_amount_kobo =
      v_total,

    payment_status =
      case
        when v_paid >=
             v_total
          then 'successful'
        when v_paid > 0
          then 'processing'
        else 'pending'
      end,

    customer_action_required =
      v_paid <
      v_total,

    customer_action_label =
      case
        when v_paid <
             v_total
          then 'Additional project cost added — payment due'
        else null
      end,

    last_admin_activity_at =
      v_now
  where id =
    v_order.id;

  insert into public.notification_events (
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
    'project_additional_cost_added',
    'pending',
    jsonb_build_object(
      'reference',
        v_order.reference,

      'project_title',
        v_order.project_title,

      'cost_id',
        v_item_id,

      'title',
        v_title,

      'description',
        v_description,

      'amount_kobo',
        p_amount_kobo,

      'project_total_kobo',
        v_total,

      'due_at',
        p_due_at
    )
  );

  insert into public.admin_activity_log (
    admin_user_id,
    order_id,
    action,
    description,
    metadata
  )
  values (
    auth.uid(),
    v_order.id,
    'project_additional_cost_added',
    format(
      'Additional project cost "%s" added.',
      v_title
    ),
    jsonb_build_object(
      'cost_id',
        v_item_id,

      'amount_kobo',
        p_amount_kobo,

      'project_total_kobo',
        v_total,

      'due_at',
        p_due_at
    )
  );

  return jsonb_build_object(
    'success',
      true,

    'cost_id',
      v_item_id,

    'amount_kobo',
      p_amount_kobo,

    'additional_costs_kobo',
      v_extra_total,

    'total_project_value_kobo',
      v_total
  );
end;
$$;

-- ============================================================
-- ADMIN: WAIVE AN ADDITIONAL COST
-- ============================================================

create or replace function
public.admin_waive_project_cost(
  p_cost_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cost public.project_cost_items%rowtype;

  v_order public.orders%rowtype;

  v_reason text;

  v_extra_total bigint;

  v_total bigint;

  v_paid bigint;

  v_now timestamptz;
begin
  if not public.has_admin_access() then
    raise exception
      'Administrative access is required.'
      using errcode = '42501';
  end if;

  v_reason :=
    left(
      trim(
        coalesce(
          p_reason,
          ''
        )
      ),
      2000
    );

  if char_length(
       v_reason
     ) < 5 then
    raise exception
      'Provide a reason for removing this cost.';
  end if;

  select *
  into v_cost
  from public.project_cost_items
  where id =
    p_cost_id
  for update;

  if not found then
    raise exception
      'Project cost could not be found.';
  end if;

  if v_cost.status <>
     'active' then
    raise exception
      'This project cost is no longer active.';
  end if;

  select *
  into v_order
  from public.orders
  where id =
    v_cost.order_id
  for update;

  if not found then
    raise exception
      'Project could not be found.';
  end if;

  select
    coalesce(
      sum(amount_kobo),
      0
    )
  into
    v_extra_total
  from public.project_cost_items
  where order_id =
    v_order.id
    and status =
      'active'
    and id <>
      v_cost.id;

  v_total :=
    coalesce(
      v_order.base_project_price_kobo,
      0
    ) +
    v_extra_total;

  v_paid :=
    coalesce(
      v_order.paid_amount_kobo,
      0
    );

  if v_total <
     v_paid then
    raise exception
      'This cost cannot be removed because confirmed payments would exceed the revised project value.';
  end if;

  v_now :=
    now();

  update public.project_cost_items
  set
    status =
      'waived',

    waived_at =
      v_now,

    waived_by =
      auth.uid(),

    waive_reason =
      v_reason,

    updated_at =
      v_now
  where id =
    v_cost.id;

  perform set_config(
    'posho.finance_write',
    '1',
    true
  );

  update public.orders
  set
    quoted_amount_kobo =
      v_total,

    payment_status =
      case
        when v_paid >=
             v_total
             and v_total > 0
          then 'successful'
        when v_paid > 0
          then 'processing'
        else 'pending'
      end,

    customer_action_required =
      v_paid <
      v_total,

    customer_action_label =
      case
        when v_paid <
             v_total
          then 'Payment balance outstanding'
        else null
      end,

    last_admin_activity_at =
      v_now
  where id =
    v_order.id;

  insert into public.notification_events (
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
    'project_additional_cost_waived',
    'pending',
    jsonb_build_object(
      'reference',
        v_order.reference,

      'project_title',
        v_order.project_title,

      'cost_id',
        v_cost.id,

      'title',
        v_cost.title,

      'amount_kobo',
        v_cost.amount_kobo,

      'reason',
        v_reason,

      'project_total_kobo',
        v_total
    )
  );

  insert into public.admin_activity_log (
    admin_user_id,
    order_id,
    action,
    description,
    metadata
  )
  values (
    auth.uid(),
    v_order.id,
    'project_additional_cost_waived',
    format(
      'Additional project cost "%s" waived.',
      v_cost.title
    ),
    jsonb_build_object(
      'cost_id',
        v_cost.id,

      'amount_kobo',
        v_cost.amount_kobo,

      'reason',
        v_reason,

      'project_total_kobo',
        v_total
    )
  );

  return jsonb_build_object(
    'success',
      true,

    'cost_id',
      v_cost.id,

    'total_project_value_kobo',
      v_total,

    'additional_costs_kobo',
      v_extra_total
  );
end;
$$;

-- ============================================================
-- CUSTOMER: APPLY FOR PART PAYMENT
--
-- Customer does NOT control the approved amount.
-- ============================================================

create or replace function
public.request_project_part_payment(
  p_order_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;

  v_reason text;

  v_request_id uuid;

  v_outstanding bigint;

  v_now timestamptz;
begin
  if auth.uid() is null then
    raise exception
      'Authentication is required.'
      using errcode = '42501';
  end if;

  v_reason :=
    left(
      trim(
        coalesce(
          p_reason,
          ''
        )
      ),
      3000
    );

  if char_length(
       v_reason
     ) < 10 then
    raise exception
      'Please explain why you are requesting a part-payment arrangement.';
  end if;

  select *
  into v_order
  from public.orders
  where id =
    p_order_id
    and user_id =
      auth.uid()
  for update;

  if not found then
    raise exception
      'Project could not be found.'
      using errcode = '42501';
  end if;

  if v_order.review_decision <>
     'approved' then
    raise exception
      'Part payment can only be requested for an approved project.';
  end if;

  if v_order.status in (
    'completed',
    'cancelled'
  ) then
    raise exception
      'This project is not open for a part-payment request.';
  end if;

  v_outstanding :=
    greatest(
      coalesce(
        v_order.quoted_amount_kobo,
        0
      ) -
      coalesce(
        v_order.paid_amount_kobo,
        0
      ),
      0
    );

  if v_outstanding <= 0 then
    raise exception
      'There is no outstanding project balance.';
  end if;

  v_now :=
    now();

  -- Expire old approvals before checking for a new request.

  update public.part_payment_requests
  set
    status =
      'expired',

    updated_at =
      v_now
  where order_id =
    v_order.id
    and status =
      'approved'
    and approval_expires_at
      is not null
    and approval_expires_at <=
      v_now;

  if exists (
    select 1
    from public.part_payment_requests ppr
    where ppr.order_id =
      v_order.id
      and ppr.status in (
        'pending',
        'approved'
      )
  ) then
    raise exception
      'This project already has an active part-payment request.';
  end if;

  insert into public.part_payment_requests (
    order_id,
    customer_id,
    requested_by,
    reason,
    status,
    created_at,
    updated_at
  )
  values (
    v_order.id,
    v_order.customer_id,
    auth.uid(),
    v_reason,
    'pending',
    v_now,
    v_now
  )
  returning id
  into v_request_id;

  insert into public.notification_events (
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
    'part_payment_requested',
    'pending',
    jsonb_build_object(
      'reference',
        v_order.reference,

      'project_title',
        v_order.project_title,

      'request_id',
        v_request_id,

      'message',
        'Your part-payment request has been submitted for Management review.'
    )
  );

  return jsonb_build_object(
    'success',
      true,

    'request_id',
      v_request_id,

    'status',
      'pending',

    'outstanding_balance_kobo',
      v_outstanding
  );
end;
$$;

-- ============================================================
-- ADMIN: APPROVE / DECLINE PART PAYMENT
-- ============================================================

create or replace function
public.admin_review_part_payment(
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

  v_decision text;

  v_note text;

  v_outstanding bigint;

  v_now timestamptz;

  v_expiry timestamptz;

  v_balance_due timestamptz;
begin
  if not public.has_admin_access() then
    raise exception
      'Administrative access is required.'
      using errcode = '42501';
  end if;

  v_decision :=
    lower(
      trim(
        coalesce(
          p_decision,
          ''
        )
      )
    );

  if v_decision not in (
    'approve',
    'decline'
  ) then
    raise exception
      'Choose Approve or Decline.';
  end if;

  select *
  into v_request
  from public.part_payment_requests
  where id =
    p_request_id
  for update;

  if not found then
    raise exception
      'Part-payment request could not be found.';
  end if;

  if v_request.status <>
     'pending' then
    raise exception
      'This request has already been reviewed.';
  end if;

  select *
  into v_order
  from public.orders
  where id =
    v_request.order_id
  for update;

  if not found then
    raise exception
      'Project could not be found.';
  end if;

  v_outstanding :=
    greatest(
      coalesce(
        v_order.quoted_amount_kobo,
        0
      ) -
      coalesce(
        v_order.paid_amount_kobo,
        0
      ),
      0
    );

  if v_outstanding <= 0 then
    raise exception
      'There is no outstanding balance on this project.';
  end if;

  v_now :=
    now();

  v_note :=
    nullif(
      left(
        trim(
          coalesce(
            p_admin_note,
            ''
          )
        ),
        3000
      ),
      ''
    );

  if v_decision =
     'decline' then

    if char_length(
         coalesce(
           v_note,
           ''
         )
       ) < 5 then
      raise exception
        'Provide a clear reason for declining this request.';
    end if;

    update public.part_payment_requests
    set
      status =
        'declined',

      decline_reason =
        v_note,

      admin_note =
        v_note,

      reviewed_by =
        auth.uid(),

      reviewed_at =
        v_now,

      updated_at =
        v_now
    where id =
      v_request.id;

    insert into public.notification_events (
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
      'part_payment_declined',
      'pending',
      jsonb_build_object(
        'reference',
          v_order.reference,

        'project_title',
          v_order.project_title,

        'request_id',
          v_request.id,

        'reason',
          v_note
      )
    );

    insert into public.admin_activity_log (
      admin_user_id,
      order_id,
      action,
      description,
      metadata
    )
    values (
      auth.uid(),
      v_order.id,
      'part_payment_declined',
      'Part-payment request declined.',
      jsonb_build_object(
        'request_id',
          v_request.id,

        'reason',
          v_note
      )
    );

    return jsonb_build_object(
      'success',
        true,

      'status',
        'declined'
    );
  end if;

  if p_approved_amount_kobo is null
     or p_approved_amount_kobo <= 0 then
    raise exception
      'Enter the installment amount Management is approving.';
  end if;

  if p_approved_amount_kobo >=
     v_outstanding then
    raise exception
      'A part-payment installment must be lower than the full outstanding balance.';
  end if;

  v_expiry :=
    coalesce(
      p_approval_expires_at,
      v_now +
        interval '7 days'
    );

  if v_expiry <=
     v_now then
    raise exception
      'The part-payment approval expiry must be in the future.';
  end if;

  v_balance_due :=
    coalesce(
      p_balance_due_at,
      v_expiry +
        interval '30 days'
    );

  if v_balance_due <
     v_expiry then
    raise exception
      'The remaining-balance due date cannot be earlier than the installment approval expiry.';
  end if;

  update public.part_payment_requests
  set
    status =
      'approved',

    approved_amount_kobo =
      p_approved_amount_kobo,

    approval_expires_at =
      v_expiry,

    balance_due_at =
      v_balance_due,

    allow_work_to_start =
      coalesce(
        p_allow_work_to_start,
        false
      ),

    admin_note =
      v_note,

    decline_reason =
      null,

    reviewed_by =
      auth.uid(),

    reviewed_at =
      v_now,

    updated_at =
      v_now
  where id =
    v_request.id;

  update public.orders
  set
    customer_action_required =
      true,

    customer_action_label =
      'Part-payment installment approved',

    last_admin_activity_at =
      v_now
  where id =
    v_order.id;

  insert into public.notification_events (
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
    'part_payment_approved',
    'pending',
    jsonb_build_object(
      'reference',
        v_order.reference,

      'project_title',
        v_order.project_title,

      'request_id',
        v_request.id,

      'approved_amount_kobo',
        p_approved_amount_kobo,

      'approval_expires_at',
        v_expiry,

      'balance_due_at',
        v_balance_due,

      'allow_work_to_start',
        coalesce(
          p_allow_work_to_start,
          false
        ),

      'message',
        v_note
    )
  );

  insert into public.admin_activity_log (
    admin_user_id,
    order_id,
    action,
    description,
    metadata
  )
  values (
    auth.uid(),
    v_order.id,
    'part_payment_approved',
    format(
      'Part-payment installment approved for %s kobo.',
      p_approved_amount_kobo
    ),
    jsonb_build_object(
      'request_id',
        v_request.id,

      'approved_amount_kobo',
        p_approved_amount_kobo,

      'approval_expires_at',
        v_expiry,

      'balance_due_at',
        v_balance_due,

      'allow_work_to_start',
        coalesce(
          p_allow_work_to_start,
          false
        )
    )
  );

  return jsonb_build_object(
    'success',
      true,

    'status',
      'approved',

    'approved_amount_kobo',
      p_approved_amount_kobo,

    'approval_expires_at',
      v_expiry,

    'balance_due_at',
      v_balance_due
  );
end;
$$;

-- ============================================================
-- SUCCESSFUL INSTALLMENT → FULFIL APPROVAL
--
-- The existing provider reconciliation still controls whether
-- a payment becomes successful.
--
-- This trigger does NOT mark payments successful.
-- It only reacts AFTER verified reconciliation has already done so.
-- ============================================================

create or replace function
public.handle_verified_part_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.part_payment_requests%rowtype;

  v_order public.orders%rowtype;

  v_now timestamptz;
begin
  if new.part_payment_request_id
     is null then
    return new;
  end if;

  if new.status <>
     'successful' then
    return new;
  end if;

  if old.status =
     'successful' then
    return new;
  end if;

  select *
  into v_request
  from public.part_payment_requests
  where id =
    new.part_payment_request_id
  for update;

  if not found then
    return new;
  end if;

  if v_request.status <>
     'approved' then
    return new;
  end if;

  v_now :=
    now();

  update public.part_payment_requests
  set
    status =
      'fulfilled',

    fulfilled_at =
      v_now,

    updated_at =
      v_now
  where id =
    v_request.id;

  select *
  into v_order
  from public.orders
  where id =
    new.order_id;

  if found then
    insert into public.notification_events (
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
      'part_payment_received',
      'pending',
      jsonb_build_object(
        'reference',
          v_order.reference,

        'project_title',
          v_order.project_title,

        'request_id',
          v_request.id,

        'amount_kobo',
          new.amount_kobo,

        'payment_reference',
          new.provider_reference
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists
verified_part_payment_trigger
on public.payment_transactions;

create trigger
verified_part_payment_trigger
after update of status
on public.payment_transactions
for each row
when (
  new.status =
    'successful'
  and old.status
      is distinct from
      new.status
  and new.part_payment_request_id
      is not null
)
execute function
public.handle_verified_part_payment();

-- ============================================================
-- FUNCTION PERMISSIONS
-- ============================================================

revoke all
on function
public.admin_set_project_price(
  uuid,
  bigint,
  text,
  timestamptz
)
from public, anon;

grant execute
on function
public.admin_set_project_price(
  uuid,
  bigint,
  text,
  timestamptz
)
to authenticated;

revoke all
on function
public.admin_add_project_cost(
  uuid,
  text,
  bigint,
  text,
  timestamptz
)
from public, anon;

grant execute
on function
public.admin_add_project_cost(
  uuid,
  text,
  bigint,
  text,
  timestamptz
)
to authenticated;

revoke all
on function
public.admin_waive_project_cost(
  uuid,
  text
)
from public, anon;

grant execute
on function
public.admin_waive_project_cost(
  uuid,
  text
)
to authenticated;

revoke all
on function
public.request_project_part_payment(
  uuid,
  text
)
from public, anon;

grant execute
on function
public.request_project_part_payment(
  uuid,
  text
)
to authenticated;

revoke all
on function
public.admin_review_part_payment(
  uuid,
  text,
  bigint,
  timestamptz,
  timestamptz,
  text,
  boolean
)
from public, anon;

grant execute
on function
public.admin_review_part_payment(
  uuid,
  text,
  bigint,
  timestamptz,
  timestamptz,
  text,
  boolean
)
to authenticated;

-- ============================================================
-- DOCUMENTATION
-- ============================================================

comment on column
public.orders.base_project_price_kobo is
'Management-controlled original/base project price excluding later additional project costs.';

comment on table
public.project_cost_items is
'Management-controlled additional project cost ledger. Active rows contribute to total project value.';

comment on table
public.part_payment_requests is
'Customer requests and Management approvals for controlled project installment payments.';

comment on column
public.payment_transactions.payment_scope is
'Whether the verified transaction represents the full outstanding balance or a Management-approved installment.';