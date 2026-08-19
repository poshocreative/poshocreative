-- ============================================================
-- POSHO CREATIVE
-- Production Service Pricing + Payment Foundation
-- ============================================================

-- ============================================================
-- SERVICE CATALOG
-- ============================================================

create table if not exists public.service_catalog (
  id uuid primary key default gen_random_uuid(),

  service_slug text not null,

  project_type text not null,

  title text not null,

  description text,

  pricing_type text not null
    check (
      pricing_type in (
        'fixed',
        'starting_at',
        'monthly',
        'custom'
      )
    ),

  price_kobo bigint
    check (
      price_kobo is null
      or price_kobo >= 0
    ),

  currency text
    not null
    default 'NGN',

  ad_spend_included boolean
    not null
    default false,

  active boolean
    not null
    default true,

  sort_order integer
    not null
    default 0,

  created_at timestamptz
    not null
    default now(),

  updated_at timestamptz
    not null
    default now(),

  unique (
    service_slug,
    project_type
  )
);

create index if not exists
service_catalog_service_slug_idx
on public.service_catalog (
  service_slug
);

create index if not exists
service_catalog_active_idx
on public.service_catalog (
  active
);

drop trigger if exists
service_catalog_set_updated_at
on public.service_catalog;

create trigger
service_catalog_set_updated_at
before update
on public.service_catalog
for each row
execute function public.set_updated_at();

-- ============================================================
-- WEBSITE DEVELOPMENT
-- ============================================================

insert into public.service_catalog (
  service_slug,
  project_type,
  title,
  description,
  pricing_type,
  price_kobo,
  sort_order
)
values

(
  'website-development',
  'landing-page',
  'Landing Page',
  'Professional conversion-focused landing page.',
  'fixed',
  12000000,
  10
),

(
  'website-development',
  'portfolio-website',
  'Portfolio Website',
  'Professional portfolio website for individuals and creative professionals.',
  'fixed',
  15000000,
  20
),

(
  'website-development',
  'business-website',
  'Business Website',
  'Professional website for a company, organisation or growing business.',
  'starting_at',
  18000000,
  30
),

(
  'website-development',
  'ecommerce-website',
  'E-commerce Website',
  'Online store with commerce and payment functionality.',
  'starting_at',
  35000000,
  40
),

(
  'website-development',
  'web-platform',
  'Web Platform',
  'Advanced portal, SaaS product, marketplace or custom web application.',
  'starting_at',
  60000000,
  50
),

(
  'website-development',
  'website-redesign',
  'Website Redesign',
  'Professional redesign and improvement of an existing website.',
  'starting_at',
  12000000,
  60
),

(
  'website-development',
  'website-maintenance',
  'Website Maintenance',
  'Ongoing website maintenance, updates and technical support.',
  'monthly',
  5000000,
  70
),

(
  'website-development',
  'custom-web-project',
  'Custom Web Project',
  'Custom website or digital platform requiring individual scoping.',
  'custom',
  null,
  80
),

-- ============================================================
-- GRAPHIC DESIGN
-- ============================================================

(
  'graphic-design',
  'logo-design',
  'Logo Design',
  'Professional logo design with production-ready deliverables.',
  'fixed',
  5000000,
  110
),

(
  'graphic-design',
  'brand-identity',
  'Brand Identity',
  'Professional visual identity system for a business or organisation.',
  'fixed',
  12000000,
  120
),

(
  'graphic-design',
  'flyer-design',
  'Flyer Design',
  'Professional promotional or informational flyer.',
  'fixed',
  1500000,
  130
),

(
  'graphic-design',
  'business-card',
  'Business Card Design',
  'Professional print-ready business card design.',
  'fixed',
  1500000,
  140
),

(
  'graphic-design',
  'banner-poster',
  'Banner or Poster',
  'Professional advertising, promotional or event artwork.',
  'fixed',
  2000000,
  150
),

(
  'graphic-design',
  'social-media-design',
  'Social Media Graphics',
  'Branded social media graphics package.',
  'fixed',
  4500000,
  160
),

(
  'graphic-design',
  'marketing-materials',
  'Marketing Materials',
  'Professional marketing collateral and campaign visual materials.',
  'starting_at',
  5000000,
  170
),

(
  'graphic-design',
  'custom-design',
  'Custom Design',
  'Custom visual design requirement.',
  'custom',
  null,
  180
),

-- ============================================================
-- SOCIAL MEDIA
-- ============================================================

(
  'social-media-management',
  'account-management',
  'Social Media Management',
  'Ongoing professional social account management.',
  'monthly',
  10000000,
  210
),

(
  'social-media-management',
  'content-planning',
  'Content Planning',
  'Professional content strategy and publishing plan.',
  'fixed',
  5000000,
  220
),

(
  'social-media-management',
  'profile-optimisation',
  'Profile Optimisation',
  'Professional optimisation of business social profiles.',
  'fixed',
  3500000,
  230
),

(
  'social-media-management',
  'growth-campaign',
  'Growth Campaign',
  'Strategic audience growth campaign and account development.',
  'monthly',
  8000000,
  240
),

(
  'social-media-management',
  'engagement-campaign',
  'Engagement Campaign',
  'Campaign focused on content reach and community engagement.',
  'monthly',
  7500000,
  250
),

(
  'social-media-management',
  'social-promotion',
  'Social Media Promotion',
  'Professional promotion management. Advertising spend is separate.',
  'starting_at',
  5000000,
  260
),

(
  'social-media-management',
  'social-consultation',
  'Social Media Consultation',
  'Professional consultation and growth recommendations.',
  'fixed',
  3000000,
  270
),

(
  'social-media-management',
  'custom-social',
  'Custom Social Media Project',
  'Custom social media requirement.',
  'custom',
  null,
  280
),

-- ============================================================
-- ADVERTISING
-- ============================================================

(
  'advertising',
  'social-media-ads',
  'Social Media Advertising',
  'Campaign management fee. Advertising media budget is charged separately.',
  'starting_at',
  5000000,
  310
),

(
  'advertising',
  'business-promotion',
  'Business Promotion',
  'Professional campaign designed to increase business visibility.',
  'starting_at',
  7500000,
  320
),

(
  'advertising',
  'product-promotion',
  'Product Promotion',
  'Professional promotional campaign for a product.',
  'starting_at',
  7500000,
  330
),

(
  'advertising',
  'service-promotion',
  'Service Promotion',
  'Professional promotional campaign for a service.',
  'starting_at',
  7500000,
  340
),

(
  'advertising',
  'brand-awareness',
  'Brand Awareness Campaign',
  'Broader campaign focused on building brand visibility.',
  'starting_at',
  10000000,
  350
),

(
  'advertising',
  'campaign-setup',
  'Campaign Setup',
  'Professional advertising campaign configuration.',
  'fixed',
  4000000,
  360
),

(
  'advertising',
  'promotion-strategy',
  'Promotion Strategy',
  'Professional advertising and promotion strategy.',
  'fixed',
  5000000,
  370
),

(
  'advertising',
  'custom-advertising',
  'Custom Advertising Project',
  'Custom advertising requirement.',
  'custom',
  null,
  380
),

-- ============================================================
-- BUSINESS SERVICES
-- ============================================================

(
  'business-services',
  'cac-registration',
  'CAC Registration Assistance',
  'Business registration support. Final pricing depends on registration type and applicable statutory charges.',
  'starting_at',
  4500000,
  410
),

(
  'business-services',
  'business-management',
  'Business Management Support',
  'Ongoing business management and operational support.',
  'monthly',
  8000000,
  420
),

(
  'business-services',
  'business-branding',
  'Business Branding',
  'Professional business identity and presentation support.',
  'starting_at',
  10000000,
  430
),

(
  'business-services',
  'business-promotion',
  'Business Promotion',
  'Professional business visibility and promotion campaign.',
  'starting_at',
  7500000,
  440
),

(
  'business-services',
  'digital-business-setup',
  'Digital Business Setup',
  'Website, digital presence and essential online business infrastructure.',
  'starting_at',
  25000000,
  450
),

(
  'business-services',
  'business-profile',
  'Business Profile',
  'Professional business or company profile document.',
  'fixed',
  4000000,
  460
),

(
  'business-services',
  'business-consultation',
  'Business Consultation',
  'Professional business consultation session.',
  'fixed',
  3000000,
  470
),

(
  'business-services',
  'custom-business',
  'Custom Business Service',
  'Custom business requirement.',
  'custom',
  null,
  480
),

-- ============================================================
-- CREATIVE SOLUTIONS
-- ============================================================

(
  'creative-solutions',
  'brand-launch',
  'Brand Launch',
  'Coordinated brand identity, digital presence and launch support.',
  'starting_at',
  30000000,
  510
),

(
  'creative-solutions',
  'business-launch',
  'Business Launch',
  'Multi-service launch package for a new business.',
  'starting_at',
  35000000,
  520
),

(
  'creative-solutions',
  'multi-service-project',
  'Multi-Service Project',
  'Combined Posho Creative services delivered as one coordinated project.',
  'starting_at',
  40000000,
  530
),

(
  'creative-solutions',
  'creative-campaign',
  'Creative Campaign',
  'Multi-channel creative and promotional campaign.',
  'starting_at',
  20000000,
  540
),

(
  'creative-solutions',
  'digital-product',
  'Digital Product',
  'Custom online product, experience or digital platform.',
  'starting_at',
  50000000,
  550
),

(
  'creative-solutions',
  'creative-consultation',
  'Creative Consultation',
  'Professional consultation for planning a creative project.',
  'fixed',
  4000000,
  560
),

(
  'creative-solutions',
  'special-project',
  'Special Project',
  'Unique project requiring individual scoping.',
  'custom',
  null,
  570
),

(
  'creative-solutions',
  'custom-project',
  'Custom Project',
  'Custom Posho Creative project.',
  'custom',
  null,
  580
)

on conflict (
  service_slug,
  project_type
)
do update set
  title =
    excluded.title,

  description =
    excluded.description,

  pricing_type =
    excluded.pricing_type,

  price_kobo =
    excluded.price_kobo,

  currency =
    excluded.currency,

  ad_spend_included =
    excluded.ad_spend_included,

  active =
    excluded.active,

  sort_order =
    excluded.sort_order,

  updated_at =
    now();

-- ============================================================
-- ORDER PRICE SNAPSHOT
-- ============================================================

alter table public.orders
add column if not exists
catalog_item_id uuid
references public.service_catalog(id)
on delete set null;

alter table public.orders
add column if not exists
pricing_type text;

alter table public.orders
add column if not exists
service_price_kobo bigint
check (
  service_price_kobo is null
  or service_price_kobo >= 0
);

alter table public.orders
add column if not exists
requires_quote boolean
not null
default false;

create index if not exists
orders_catalog_item_id_idx
on public.orders (
  catalog_item_id
);

-- ============================================================
-- FLUTTERWAVE PAYMENT RECORD EXPANSION
-- ============================================================

alter table public.payment_transactions
alter column provider
set default 'flutterwave';

alter table public.payment_transactions
add column if not exists
provider_transaction_id text;

alter table public.payment_transactions
add column if not exists
checkout_url text;

alter table public.payment_transactions
add column if not exists
initiated_by uuid
references auth.users(id)
on delete set null;

alter table public.payment_transactions
add column if not exists
payment_metadata jsonb
not null
default '{}'::jsonb;

create index if not exists
payment_transactions_provider_transaction_id_idx
on public.payment_transactions (
  provider_transaction_id
);

-- ============================================================
-- SERVICE CATALOG SECURITY
-- ============================================================

alter table public.service_catalog
enable row level security;

grant select
on public.service_catalog
to anon;

grant select
on public.service_catalog
to authenticated;

grant insert, update, delete
on public.service_catalog
to authenticated;

drop policy if exists
"Public can read active service pricing"
on public.service_catalog;

create policy
"Public can read active service pricing"
on public.service_catalog
for select
to anon
using (
  active = true
);

drop policy if exists
"Customers can read active service pricing"
on public.service_catalog;

create policy
"Customers can read active service pricing"
on public.service_catalog
for select
to authenticated
using (
  active = true
  or public.is_admin()
);

drop policy if exists
"Admins can create service pricing"
on public.service_catalog;

create policy
"Admins can create service pricing"
on public.service_catalog
for insert
to authenticated
with check (
  public.is_admin()
);

drop policy if exists
"Admins can update service pricing"
on public.service_catalog;

create policy
"Admins can update service pricing"
on public.service_catalog
for update
to authenticated
using (
  public.is_admin()
)
with check (
  public.is_admin()
);

drop policy if exists
"Admins can delete service pricing"
on public.service_catalog;

create policy
"Admins can delete service pricing"
on public.service_catalog
for delete
to authenticated
using (
  public.is_admin()
);

comment on table public.service_catalog is
'Backend-controlled Posho Creative service catalogue and production pricing.';

comment on column public.orders.service_price_kobo is
'Snapshot of the catalogue price when the order was submitted.';