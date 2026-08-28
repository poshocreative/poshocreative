-- ============================================================
-- POSHO CREATIVE
-- Social growth + advertising operations
-- ============================================================

begin;

alter table public.orders
  add column if not exists service_details jsonb
  not null default '{}'::jsonb;

alter table public.orders
  drop constraint if exists orders_service_details_object_check;

alter table public.orders
  add constraint orders_service_details_object_check
  check (jsonb_typeof(service_details) = 'object');

comment on column public.orders.service_details is
  'Structured, customer-supplied requirements for social-media and advertising projects, including platform, target link, requested quantity, duration and media budget.';

insert into public.service_catalog (
  service_slug,
  project_type,
  title,
  description,
  pricing_type,
  price_kobo,
  currency,
  ad_spend_included,
  active,
  sort_order
)
values
  (
    'social-media-management',
    'follower-growth',
    'Followers & Audience Growth',
    'A reviewed follower or audience-growth package for the selected social platform.',
    'custom',
    null,
    'NGN',
    false,
    true,
    205
  ),
  (
    'social-media-management',
    'post-likes',
    'Post Likes',
    'A reviewed engagement package for an eligible social-media post.',
    'custom',
    null,
    'NGN',
    false,
    true,
    206
  ),
  (
    'social-media-management',
    'post-comments',
    'Post Comments',
    'A managed comments campaign based on the customer brief and selected platform.',
    'custom',
    null,
    'NGN',
    false,
    true,
    207
  ),
  (
    'social-media-management',
    'page-followers',
    'Page Followers',
    'A reviewed page-following campaign for a business, creator or entertainment page.',
    'custom',
    null,
    'NGN',
    false,
    true,
    208
  ),
  (
    'social-media-management',
    'channel-subscribers',
    'Channel Subscribers',
    'A reviewed subscriber-growth campaign for an eligible creator or video channel.',
    'custom',
    null,
    'NGN',
    false,
    true,
    209
  ),
  (
    'social-media-management',
    'video-views',
    'Video Views',
    'A reviewed visibility and views campaign for eligible video content.',
    'custom',
    null,
    'NGN',
    false,
    true,
    210
  ),
  (
    'social-media-management',
    'music-streams',
    'Music & Entertainment Streams',
    'Promotional support for eligible music, podcast and entertainment content.',
    'custom',
    null,
    'NGN',
    false,
    true,
    211
  )
on conflict (service_slug, project_type)
do update set
  title = excluded.title,
  description = excluded.description,
  pricing_type = excluded.pricing_type,
  price_kobo = excluded.price_kobo,
  currency = excluded.currency,
  ad_spend_included = excluded.ad_spend_included,
  active = excluded.active,
  sort_order = excluded.sort_order,
  updated_at = now();

-- Existing part-payment notification events remain customer-facing. Admin
-- notification badges are calculated from the authoritative pending request
-- rows, so a decision removes the badge in the same transaction.
create index if not exists part_payment_requests_pending_created_idx
  on public.part_payment_requests (created_at asc)
  where status = 'pending';

commit;
