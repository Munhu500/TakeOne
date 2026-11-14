-- TakeOne schema. Money is always integer minor units + currency code.
create extension if not exists pgcrypto;

-- ───────────────────────── identity ─────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'creator' check (role in ('creator','brand_member','agency_member','admin','worker')),
  display_name text not null default '',
  country text not null default 'IN',
  currency text not null default 'INR' check (currency in ('USD','INR','AED')),
  locale text not null default 'en-IN',
  avatar text,
  onboarded boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.creators (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  bio text,
  categories text[] not null default '{}',
  tier text not null default 'free' check (tier in ('free','pro')),
  is_founding boolean not null default false,
  uae_permit_number text,
  rating_avg numeric(3,2),
  rating_count int not null default 0,
  win_rate numeric(5,4) not null default 0,
  wins_count int not null default 0,
  submissions_count int not null default 0,
  campaigns_completed int not null default 0,
  kyc_status text not null default 'none' check (kyc_status in ('none','pending','verified','rejected')),
  kyc_paths jsonb,
  tax_id text,
  show_exact_earnings boolean not null default false,
  masking_attempts int not null default 0,
  flagged boolean not null default false,
  pro_free_until timestamptz,
  created_at timestamptz not null default now()
);

create table public.social_accounts (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators (profile_id) on delete cascade,
  platform text not null check (platform in ('instagram','tiktok','youtube','snapchat')),
  handle text not null,
  followers int not null default 0,
  avg_views int not null default 0,
  engagement_rate numeric(5,2) not null default 0,
  verification text not null default 'self_reported' check (verification in ('self_reported','checked','api_verified')),
  ownership_code text not null default ('T1-' || upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 6))),
  ownership_requested_at timestamptz,
  ownership_verified_at timestamptz,
  screen_recording_path text,
  screen_recording_code text,
  public_metrics jsonb,
  plausibility_score int,
  flags text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (creator_id, platform)
);

create table public.likeness_profiles (
  creator_id uuid primary key references public.creators (profile_id) on delete cascade,
  status text not null default 'none' check (status in ('none','capturing','ready','revoked')),
  voice_provider_id text,
  capture_paths text[] not null default '{}',
  consent_version text not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create table public.agencies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo text,
  primary_color text not null default '#7C5CFF',
  subdomain text not null unique,
  markup_default_bps int not null default 2000,
  created_at timestamptz not null default now()
);

create table public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo text,
  country text not null default 'IN',
  currency text not null default 'INR' check (currency in ('USD','INR','AED')),
  agency_id uuid references public.agencies (id) on delete set null,
  credit_balance bigint not null default 0 check (credit_balance >= 0),
  markup_bps int,
  created_at timestamptz not null default now()
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  brand_id uuid references public.brands (id) on delete cascade,
  agency_id uuid references public.agencies (id) on delete cascade,
  role text not null default 'owner' check (role in ('owner','member')),
  created_at timestamptz not null default now(),
  check ((brand_id is null) <> (agency_id is null))
);
create index on public.memberships (profile_id);

-- ───────────────────────── campaigns ─────────────────────────
create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id) on delete cascade,
  agency_id uuid references public.agencies (id) on delete set null,
  title text not null,
  product_name text not null,
  product_url text,
  product_images text[] not null default '{}',
  brief jsonb not null default '{}',
  shot_list jsonb not null default '{}',
  categories text[] not null default '{}',
  countries text[] not null default '{}',
  creators_needed int not null default 1 check (creators_needed > 0),
  fee_per_creator_minor bigint not null check (fee_per_creator_minor > 0),
  currency text not null check (currency in ('USD','INR','AED')),
  deadline timestamptz not null,
  status text not null default 'draft' check (status in ('draft','pending_payment','live','in_progress','completed','cancelled')),
  early_access_until timestamptz,
  qa_required boolean not null default true,
  published_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.campaigns (status, published_at desc);
create index on public.campaigns (brand_id);

create table public.likeness_consents (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators (profile_id) on delete cascade,
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (creator_id, campaign_id)
);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  creator_id uuid not null references public.creators (profile_id) on delete cascade,
  pitch text,
  status text not null default 'applied' check (status in ('applied','shortlisted','accepted','rejected','invited','declined','withdrawn')),
  invited boolean not null default false,
  invited_at timestamptz,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  unique (campaign_id, creator_id)
);
create index on public.applications (creator_id, created_at desc);

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  creator_id uuid not null references public.creators (profile_id) on delete cascade,
  status text not null default 'accepted' check (status in ('accepted','processing','variants_ready','qa_review','delivered','approved','completed','disputed')),
  product_shipped_at timestamptz,
  due_at timestamptz,
  submitted_at timestamptz,
  delivered_at timestamptz,
  approved_at timestamptz,
  auto_approved boolean not null default false,
  winning_variant_id uuid,
  post_url text,
  posted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (campaign_id, creator_id)
);
create index on public.assignments (creator_id);

create table public.takes (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  storage_path text not null,
  duration numeric(8,2),
  product_check text not null default 'pending' check (product_check in ('pending','passed','failed')),
  product_check_reason text,
  transcript jsonb,
  dub_language text,
  created_at timestamptz not null default now()
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('process_take','product_check','verify_metrics')),
  payload jsonb not null default '{}',
  status text not null default 'queued' check (status in ('queued','running','done','failed')),
  attempts int not null default 0,
  error text,
  progress int not null default 0,
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index on public.jobs (status, created_at);

create table public.variants (
  id uuid primary key default gen_random_uuid(),
  take_id uuid not null references public.takes (id) on delete cascade,
  format text not null,
  aspect text not null default '9:16',
  storage_path text,
  renditions jsonb not null default '{}',
  preview_renditions jsonb not null default '{}',
  thumbnail text,
  hook_text text,
  hook_options text[] not null default '{}',
  score int check (score between 0 and 100),
  score_reason text,
  is_synthetic boolean not null default false,
  ai_disclosure text,
  language text,
  visible_to_brand boolean not null default false,
  status text not null default 'processing' check (status in ('coming_soon','processing','ready','qa_pending','qa_rejected','delivered','selected','licensed','failed')),
  qa_note text,
  created_at timestamptz not null default now(),
  unique (take_id, format)
);
alter table public.assignments add constraint assignments_winning_variant_fk foreign key (winning_variant_id) references public.variants (id) on delete set null;

-- ───────────────────────── money ─────────────────────────
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id) on delete cascade,
  campaign_id uuid references public.campaigns (id) on delete set null,
  kind text not null default 'campaign' check (kind in ('campaign','license')),
  provider text not null,
  provider_ref text,
  gross_minor bigint not null check (gross_minor >= 0),
  amount_minor bigint not null check (amount_minor >= 0),
  credit_applied_minor bigint not null default 0 check (credit_applied_minor >= 0),
  currency text not null,
  -- held = escrow; released = settled to the platform after approval
  status text not null default 'pending' check (status in ('pending','held','released','refunded','failed')),
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  settled_at timestamptz
);
create index on public.payments (brand_id, created_at desc);

create table public.licenses (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.variants (id) on delete cascade,
  brand_id uuid not null references public.brands (id) on delete cascade,
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  type text not null check (type in ('base','extra','renewal','buyout','whitelist')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  price_minor bigint not null default 0 check (price_minor >= 0),
  currency text not null,
  payment_id uuid references public.payments (id) on delete set null,
  reminder_sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.licenses (brand_id, ends_at);

create table public.withdrawals (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators (profile_id) on delete cascade,
  method text not null,
  destination jsonb not null default '{}',
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null,
  status text not null default 'requested' check (status in ('requested','processing','paid','failed')),
  provider_ref text,
  created_at timestamptz not null default now()
);

create table public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators (profile_id) on delete cascade,
  source text not null check (source in ('campaign','license')),
  amount_minor bigint not null check (amount_minor >= 0),
  currency text not null,
  state text not null default 'pending' check (state in ('pending','cleared','available','withdrawn')),
  available_at timestamptz,
  cleared_at timestamptz,
  campaign_id uuid references public.campaigns (id) on delete set null,
  assignment_id uuid references public.assignments (id) on delete set null,
  license_id uuid references public.licenses (id) on delete set null,
  payment_id uuid references public.payments (id) on delete set null,
  withdrawal_id uuid references public.withdrawals (id) on delete set null,
  description text,
  created_at timestamptz not null default now()
);
create index on public.ledger_entries (creator_id, state);

create table public.credits (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id) on delete cascade,
  amount_minor bigint not null check (amount_minor >= 0),
  currency text not null,
  expires_at timestamptz not null,
  source_campaign_id uuid references public.campaigns (id) on delete set null,
  used_minor bigint not null default 0 check (used_minor >= 0 and used_minor <= amount_minor),
  created_at timestamptz not null default now()
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null unique references public.creators (profile_id) on delete cascade,
  provider text not null default 'stripe',
  provider_ref text,
  status text not null default 'active' check (status in ('active','past_due','canceled','comped')),
  current_period_end timestamptz,
  created_at timestamptz not null default now()
);

create table public.guarantee_tracking (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null unique references public.creators (profile_id) on delete cascade,
  window_start timestamptz not null default now(),
  criteria jsonb not null default '[]',
  eligible boolean not null default false,
  free_months_issued int not null default 0,
  updated_at timestamptz not null default now()
);

create table public.creator_monthly_stats (
  creator_id uuid not null references public.creators (profile_id) on delete cascade,
  month date not null,
  wins int not null default 0,
  submissions int not null default 0,
  completed int not null default 0,
  earnings_usd_minor bigint not null default 0,
  primary key (creator_id, month)
);

-- ───────────────────────── comms / ops ─────────────────────────
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  -- the creator side of the thread; the other side is the campaign's brand/agency
  creator_id uuid not null references public.creators (profile_id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body_masked text not null,
  had_masking boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.messages (campaign_id, creator_id, created_at);

create table public.masking_attempts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  campaign_id uuid references public.campaigns (id) on delete set null,
  kinds text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null unique references public.assignments (id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  data jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.notifications (profile_id, created_at desc);

create table public.disputes (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  opened_by uuid not null references public.profiles (id),
  reason text not null,
  status text not null default 'open' check (status in ('open','resolved_creator','resolved_brand','refunded')),
  resolution text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table public.fx_rates (
  currency text primary key,
  rate_to_usd numeric(18,8) not null check (rate_to_usd > 0),
  updated_at timestamptz not null default now()
);

create table public.terms_acceptances (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  terms_type text not null check (terms_type in ('creator_terms','brand_non_circumvention','agency_non_circumvention','likeness_consent')),
  version text not null,
  accepted_at timestamptz not null default now()
);

create table public.settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null,
  entity text,
  entity_id text,
  data jsonb not null default '{}',
  created_at timestamptz not null default now()
);

insert into public.fx_rates (currency, rate_to_usd) values ('USD', 1), ('INR', 0.0119), ('AED', 0.2723);
insert into public.settings (key, value) values
  ('qa_required_first_n_campaigns', '100'),
  ('license_pricing', '{"extraVariantBps":2000,"renewalBps":5000,"buyoutBps":20000,"whitelistBps":3000,"termDays":90}'),
  ('pro_price_usd_minor', '1900'),
  ('demo_mode', 'true'),
  ('feature_flags', '{"win_predictor":true,"multilingual_voice":true,"razorpay":false,"youtube_oauth":true}');
