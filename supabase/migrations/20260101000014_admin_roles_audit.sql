-- Admin console: roles, two-factor requirement, audited actions with reasons.
--
-- Roles (profiles.admin_role, only meaningful when role = 'admin'):
--   super_admin   everything
--   operations    QA, verification, masking flags, users, campaign pause/extend, non-money dispute outcomes
--   trust_safety  the same as operations, plus revealing the original of a masked message
--   finance       payouts, refunds and every money outcome of a dispute
-- Settings, feature flags, FX rates and scheduled jobs are super_admin only.
-- Every check is made here, in the database; the web console only decides what to show.

-- ───────────────────────── schema ─────────────────────────
alter table public.profiles
  add column admin_role text check (admin_role in ('super_admin', 'operations', 'finance', 'trust_safety')),
  add column mfa_exempt boolean not null default false,
  add column suspended_at timestamptz,
  add column suspended_reason text,
  add column messaging_suspended_until timestamptz,
  add column strikes int not null default 0,
  add constraint admin_role_only_for_admins check (admin_role is null or role = 'admin');
update public.profiles set admin_role = 'super_admin' where role = 'admin';

alter table public.audit_log add column before jsonb, add column after jsonb, add column reason text;
create index if not exists audit_log_created on public.audit_log (created_at desc);
create index if not exists audit_log_entity on public.audit_log (entity, entity_id);

alter table public.variants add column auto_checks jsonb not null default '[]', add column qa_reason_code text;
alter table public.social_accounts add column recording_requested_at timestamptz, add column rejected_at timestamptz, add column reject_reason text;

alter table public.campaigns drop constraint campaigns_status_check;
alter table public.campaigns add constraint campaigns_status_check check (status in ('draft', 'pending_payment', 'live', 'in_progress', 'paused', 'completed', 'cancelled'));
alter table public.campaigns add column paused_from text;

alter table public.disputes drop constraint disputes_status_check;
alter table public.disputes add constraint disputes_status_check check (status in ('open', 'resolved_creator', 'resolved_brand', 'refunded', 'partially_refunded', 'declined', 'revision_requested', 'reassigned'));
alter table public.disputes
  add column type text not null default 'quality' check (type in ('deadline_extension', 'quality', 'non_delivery', 'payment_issue')),
  add column requested_due_at timestamptz,
  add column sla_due_at timestamptz not null default now() + interval '48 hours',
  add column resolved_by uuid references public.profiles (id),
  add column notes jsonb not null default '[]';

alter table public.withdrawals drop constraint withdrawals_status_check;
alter table public.withdrawals add constraint withdrawals_status_check check (status in ('requested', 'processing', 'paid', 'failed', 'on_hold'));
alter table public.withdrawals add column hold_reason text, add column held_at timestamptz, add column held_by uuid references public.profiles (id), add column hold_rule text;

alter table public.masking_attempts
  add column message_id uuid references public.messages (id) on delete set null,
  add column status text not null default 'open' check (status in ('open', 'dismissed', 'warned', 'messaging_suspended', 'escalated')),
  add column handled_by uuid references public.profiles (id),
  add column handled_at timestamptz;

alter table public.fx_rates add column source text not null default 'Seeded rate', add column override_expires_at timestamptz;

-- Refunds issued by admins (full or partial).
create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id) on delete cascade,
  campaign_id uuid references public.campaigns (id) on delete set null,
  assignment_id uuid references public.assignments (id) on delete set null,
  dispute_id uuid references public.disputes (id) on delete set null,
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null,
  reason text not null,
  admin_id uuid references public.profiles (id),
  created_at timestamptz not null default now()
);
alter table public.refunds enable row level security;

-- A creator asks the brand for more time. The brand has 48 hours; a decline or no answer goes to an admin as a dispute.
create table public.extension_requests (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  requested_by uuid not null references public.profiles (id),
  new_due_at timestamptz not null,
  reason text not null check (char_length(reason) between 10 and 500),
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined', 'escalated')),
  respond_by timestamptz not null default now() + interval '48 hours',
  responded_at timestamptz,
  dispute_id uuid references public.disputes (id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.extension_requests enable row level security;

-- The unmasked text of a masked message. No one can select from this table: it is read only through
-- admin_reveal_original(), which needs the Trust & Safety role and a reason, and is audited.
create table public.masked_originals (
  message_id uuid primary key references public.messages (id) on delete cascade,
  original text not null,
  created_at timestamptz not null default now()
);
alter table public.masked_originals enable row level security;
revoke all on public.masked_originals from public, anon, authenticated;

create table public.job_runs (
  id bigint generated always as identity primary key,
  job text not null,
  status text not null default 'ok' check (status in ('ok', 'failed')),
  detail jsonb not null default '{}',
  run_by uuid,
  started_at timestamptz not null default now(),
  finished_at timestamptz not null default now()
);
alter table public.job_runs enable row level security;

insert into public.settings (key, value) values
  ('payout_hold_rules', '{"first_withdrawal_usd_minor":50000,"hold_on_verification_flag":true,"hold_on_masking_flag":true}'),
  ('fee_ranges', '{"INR":{"min":1200000,"max":2500000},"AED":{"min":120000,"max":250000},"USD":{"min":30000,"max":60000}}')
on conflict (key) do nothing;
update public.settings set value = value || '{"credits":false}'::jsonb where key = 'feature_flags' and not value ? 'credits';

-- ───────────────────────── who is an admin, and what may they do ─────────────────────────
/** Two-factor: the session must be aal2. Demo only: accounts marked mfa_exempt are let through (documented in the README). */
create or replace function public.admin_mfa_ok() returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'aal', '') = 'aal2'
      or (is_demo() and exists (select 1 from profiles where id = auth.uid() and mfa_exempt));
$$;

create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin' and admin_role is not null and suspended_at is null) and admin_mfa_ok();
$$;

create or replace function public.my_admin_role() returns text language sql stable security definer set search_path = public as $$
  select case when is_admin() then (select admin_role from profiles where id = auth.uid()) end;
$$;

/**
 * Areas: review (QA, verification, masking, users, campaign pause/extend) · money (payouts, refunds, money outcomes)
 * · settings (settings, flags, FX, jobs, admin roles) · reveal (unmasked message text).
 */
create or replace function public.admin_can(area text) returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(my_admin_role() = any (case area
    when 'review' then array['super_admin', 'operations', 'trust_safety']
    when 'money' then array['super_admin', 'finance']
    when 'settings' then array['super_admin']
    when 'reveal' then array['trust_safety']
    else array[]::text[] end), false);
$$;

/** Every admin action starts here: right role, and a reason of at least 10 characters. */
create or replace function public.admin_guard(area text, reason text) returns void language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then perform fail('Admins only'); end if;
  if not admin_can(area) then perform fail('Your admin role does not allow this action'); end if;
  if char_length(trim(coalesce(reason, ''))) < 10 then perform fail('Give a reason of at least 10 characters'); end if;
end $$;

create or replace function public.audit_admin(p_action text, p_entity text, p_entity_id text, p_before jsonb, p_after jsonb, p_reason text) returns void
language sql security definer set search_path = public as $$
  insert into audit_log (actor_id, action, entity, entity_id, before, after, reason, data)
  values (auth.uid(), p_action, p_entity, p_entity_id, p_before, p_after, trim(p_reason), jsonb_build_object('admin_role', (select admin_role from profiles where id = auth.uid())));
$$;
revoke execute on function public.audit(text, text, text, jsonb), public.audit_admin(text, text, text, jsonb, jsonb, text) from public, anon, authenticated;
revoke execute on function public.admin_guard(text, text) from public, anon;

-- Suspended accounts cannot act.
create or replace function public.uid_required() returns uuid language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Sign in required' using errcode = 'P0001'; end if;
  if exists (select 1 from profiles where id = auth.uid() and suspended_at is not null) then raise exception 'This account is suspended. Contact support.' using errcode = 'P0001'; end if;
  return auth.uid();
end $$;

-- Acting for a brand (selecting variants, buying licences, messaging as the brand) is not an admin power, except for super admins.
create or replace function public.can_manage_campaign(cid uuid) returns boolean language sql stable security definer set search_path = public as $$
  select public.admin_can('settings') or exists (select 1 from campaigns c where c.id = cid and c.brand_id in (select public.my_brand_ids()));
$$;

-- ───────────────────────── row level security by role ─────────────────────────
drop policy profiles_admin on public.profiles;
create policy profiles_super_admin on public.profiles for all to authenticated using (admin_can('settings')) with check (admin_can('settings'));
drop policy creators_admin on public.creators;
create policy creators_super_admin on public.creators for all to authenticated using (admin_can('settings')) with check (admin_can('settings'));
drop policy social_admin on public.social_accounts;
create policy social_super_admin on public.social_accounts for all to authenticated using (admin_can('settings')) with check (admin_can('settings'));
drop policy settings_admin on public.settings;
create policy settings_super_admin on public.settings for all to authenticated using (admin_can('settings')) with check (admin_can('settings'));
drop policy fx_admin on public.fx_rates;
create policy fx_super_admin on public.fx_rates for all to authenticated using (admin_can('settings')) with check (admin_can('settings'));
drop policy campaigns_manage on public.campaigns;
create policy campaigns_manage on public.campaigns for all to authenticated using (can_manage_campaign(id)) with check (brand_id in (select my_brand_ids()) or admin_can('settings'));

-- any admin can read the marketplace; only the roles that need them read payout destinations and masking records
drop policy masking_admin on public.masking_attempts;
create policy masking_review on public.masking_attempts for select to authenticated using (admin_can('review'));
drop policy withdrawals_read on public.withdrawals;
create policy withdrawals_read on public.withdrawals for select to authenticated using (creator_id = auth.uid() or admin_can('money'));
drop policy applications_creator_read on public.applications;
create policy applications_creator_read on public.applications for select to authenticated using (creator_id = auth.uid() or can_manage_campaign(campaign_id) or is_admin());
drop policy assignments_read on public.assignments;
create policy assignments_read on public.assignments for select to authenticated using (creator_id = auth.uid() or can_manage_campaign(campaign_id) or is_admin());
drop policy messages_read on public.messages;
create policy messages_read on public.messages for select to authenticated using (creator_id = auth.uid() or can_manage_campaign(campaign_id) or is_admin());
drop policy reviews_read on public.reviews;
create policy reviews_read on public.reviews for select to authenticated using (owns_assignment(assignment_id) or can_manage_assignment(assignment_id) or is_admin());
create policy campaigns_admin_read on public.campaigns for select to authenticated using (is_admin());
create policy refunds_read on public.refunds for select to authenticated using (brand_id in (select my_brand_ids()) or is_admin());
create policy job_runs_read on public.job_runs for select to authenticated using (is_admin());
create policy extension_read on public.extension_requests for select to authenticated using (requested_by = auth.uid() or can_manage_assignment(assignment_id) or is_admin());
revoke insert, update, delete on public.refunds, public.job_runs, public.extension_requests from authenticated, anon;

-- private files: verification evidence for reviewers, identity documents for finance and trust & safety
drop policy "admins read review files" on storage.objects;
create policy "admins read review files" on storage.objects for select to authenticated
  using ((bucket_id in ('takes', 'verification') and public.admin_can('review')) or (bucket_id = 'kyc' and (public.admin_can('money') or public.admin_can('reveal'))));

-- ───────────────────────── QA ─────────────────────────
drop function public.qa_review(uuid, boolean, text);
/** p_reason is the audit reason; p_code and p_note (rejections) are what the creator is told. */
create or replace function public.qa_review(p_variant_id uuid, p_approve boolean, p_reason text, p_code text default null, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare aid uuid; pending int; ok int; cre uuid; was variants;
begin
  perform admin_guard('review', p_reason);
  if not p_approve and coalesce(p_code, '') not in ('product_mismatch', 'prohibited_claim', 'quality', 'caption_error', 'other') then perform fail('Choose a rejection reason'); end if;
  select * into was from variants where id = p_variant_id and status = 'qa_pending' for update;
  if was.id is null then perform fail('Variant is not awaiting QA'); end if;
  update variants set status = case when p_approve then 'delivered' else 'qa_rejected' end, visible_to_brand = p_approve, qa_note = p_note, qa_reason_code = case when p_approve then null else p_code end where id = p_variant_id;
  select t.assignment_id into aid from variants v join takes t on t.id = v.take_id where v.id = p_variant_id;
  select count(*) filter (where v.status = 'qa_pending'), count(*) filter (where v.status = 'delivered') into pending, ok
  from variants v join takes t on t.id = v.take_id where t.assignment_id = aid;
  perform audit_admin(case when p_approve then 'qa.approve' else 'qa.reject' end, 'variant', p_variant_id::text, jsonb_build_object('status', was.status),
    jsonb_build_object('status', case when p_approve then 'delivered' else 'qa_rejected' end, 'reason_code', p_code, 'note', p_note), p_reason);
  if pending = 0 then
    if ok > 0 then perform deliver_assignment(aid);
    else
      update assignments set status = 'variants_ready' where id = aid returning creator_id into cre;
      perform notify(cre, 'qa_rejected', 'Your variants need changes', coalesce(p_note, 'Review the QA notes in Studio and resubmit.'), jsonb_build_object('assignment_id', aid));
    end if;
  end if;
end $$;

/** Approves every waiting variant of a take whose automated checks have no failure. Returns how many were approved. */
create or replace function public.admin_qa_approve_passing(p_take_id uuid, p_reason text) returns int
language plpgsql security definer set search_path = public as $$
declare v record; n int := 0;
begin
  perform admin_guard('review', p_reason);
  for v in select id from variants where take_id = p_take_id and status = 'qa_pending'
      and not exists (select 1 from jsonb_array_elements(auto_checks) c where c ->> 'status' = 'fail') order by score desc nulls last loop
    perform qa_review(v.id, true, p_reason);
    n := n + 1;
  end loop;
  if n = 0 then perform fail('No variant in this submission passes every automated check'); end if;
  return n;
end $$;

-- ───────────────────────── verification ─────────────────────────
drop function public.admin_verify_social(uuid, text);
create or replace function public.admin_verify_social(p_social_id uuid, p_verification text, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare was social_accounts;
begin
  perform admin_guard('review', p_reason);
  if p_verification not in ('self_reported', 'checked', 'api_verified') then perform fail('Unknown verification level'); end if;
  select * into was from social_accounts where id = p_social_id for update;
  if was.id is null then perform fail('Account not found'); end if;
  update social_accounts set verification = p_verification, ownership_verified_at = case when p_verification = 'self_reported' then null else now() end,
    ownership_requested_at = null, recording_requested_at = null where id = p_social_id;
  perform audit_admin('verification.set', 'social_account', p_social_id::text, jsonb_build_object('verification', was.verification), jsonb_build_object('verification', p_verification), p_reason);
  if p_verification <> was.verification then
    perform notify(was.creator_id, 'verification', case when p_verification = 'self_reported' then 'Your ' || was.platform || ' numbers stay self-reported' else 'Your ' || was.platform || ' account is verified' end, null, jsonb_build_object('social_id', p_social_id));
  end if;
end $$;

/** The claim is not believable: the badge stays Self-reported, the creator gets a strike and is told why. */
create or replace function public.admin_reject_claim(p_social_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare was social_accounts; n int;
begin
  perform admin_guard('review', p_reason);
  select * into was from social_accounts where id = p_social_id for update;
  if was.id is null then perform fail('Account not found'); end if;
  update social_accounts set verification = 'self_reported', ownership_verified_at = null, ownership_requested_at = null, screen_recording_path = null, screen_recording_code = null,
    recording_requested_at = null, rejected_at = now(), reject_reason = trim(p_reason) where id = p_social_id;
  update profiles set strikes = strikes + 1 where id = was.creator_id returning strikes into n;
  perform audit_admin('verification.reject', 'social_account', p_social_id::text, jsonb_build_object('verification', was.verification, 'strikes', n - 1), jsonb_build_object('verification', 'self_reported', 'strikes', n), p_reason);
  perform notify(was.creator_id, 'verification', 'Your ' || was.platform || ' numbers could not be verified', trim(p_reason), jsonb_build_object('social_id', p_social_id));
end $$;

create or replace function public.admin_request_recording(p_social_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare was social_accounts;
begin
  perform admin_guard('review', p_reason);
  select * into was from social_accounts where id = p_social_id for update;
  if was.id is null then perform fail('Account not found'); end if;
  update social_accounts set recording_requested_at = now(), screen_recording_path = null, screen_recording_code = null where id = p_social_id;
  perform audit_admin('verification.request_recording', 'social_account', p_social_id::text, jsonb_build_object('had_recording', was.screen_recording_path is not null), jsonb_build_object('recording_requested', true), p_reason);
  perform notify(was.creator_id, 'verification', 'Please record your ' || was.platform || ' insights again', trim(p_reason), jsonb_build_object('social_id', p_social_id));
end $$;

-- ───────────────────────── users ─────────────────────────
create or replace function public.admin_set_user_status(p_profile_id uuid, p_action text, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare was profiles;
begin
  perform admin_guard('review', p_reason);
  if p_action not in ('suspend', 'reinstate') then perform fail('Unknown action'); end if;
  select * into was from profiles where id = p_profile_id for update;
  if was.id is null then perform fail('User not found'); end if;
  if was.role in ('admin', 'worker') and not admin_can('settings') then perform fail('Only a super admin can change another admin'); end if;
  if p_profile_id = auth.uid() then perform fail('You cannot suspend your own account'); end if;
  update profiles set suspended_at = case when p_action = 'suspend' then now() end, suspended_reason = case when p_action = 'suspend' then trim(p_reason) end where id = p_profile_id;
  perform audit_admin('user.' || p_action, 'profile', p_profile_id::text, jsonb_build_object('suspended', was.suspended_at is not null), jsonb_build_object('suspended', p_action = 'suspend'), p_reason);
  perform notify(p_profile_id, 'account', case when p_action = 'suspend' then 'Your account has been suspended' else 'Your account has been reinstated' end, trim(p_reason), '{}');
end $$;

create or replace function public.admin_change_tier(p_creator_id uuid, p_tier text, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare was creators;
begin
  perform admin_guard('review', p_reason);
  if p_tier not in ('free', 'pro') then perform fail('Unknown tier'); end if;
  select * into was from creators where profile_id = p_creator_id for update;
  if was.profile_id is null then perform fail('Creator not found'); end if;
  update creators set tier = p_tier where profile_id = p_creator_id;
  perform audit_admin('user.change_tier', 'creator', p_creator_id::text, jsonb_build_object('tier', was.tier), jsonb_build_object('tier', p_tier), p_reason);
end $$;

create or replace function public.admin_reset_verification(p_creator_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  perform admin_guard('review', p_reason);
  with u as (update social_accounts set verification = 'self_reported', ownership_verified_at = null, ownership_requested_at = null where creator_id = p_creator_id and verification <> 'self_reported' returning 1)
  select count(*) into n from u;
  perform audit_admin('user.reset_verification', 'creator', p_creator_id::text, jsonb_build_object('verified_accounts', n), jsonb_build_object('verified_accounts', 0), p_reason);
  perform notify(p_creator_id, 'verification', 'Your accounts need verifying again', trim(p_reason), '{}');
end $$;

create or replace function public.admin_set_admin_role(p_profile_id uuid, p_role text, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare was profiles;
begin
  perform admin_guard('settings', p_reason);
  if p_role is not null and p_role not in ('super_admin', 'operations', 'finance', 'trust_safety') then perform fail('Unknown admin role'); end if;
  select * into was from profiles where id = p_profile_id for update;
  if was.id is null or was.role <> 'admin' then perform fail('That account is not an admin'); end if;
  if p_profile_id = auth.uid() then perform fail('Ask another super admin to change your own role'); end if;
  update profiles set admin_role = p_role where id = p_profile_id;
  perform audit_admin('admin.set_role', 'profile', p_profile_id::text, jsonb_build_object('admin_role', was.admin_role), jsonb_build_object('admin_role', p_role), p_reason);
end $$;

-- ───────────────────────── refunds, campaigns ─────────────────────────
/** Records a refund of part or all of one creator's place. Money already cleared to the creator is never clawed back here. */
create or replace function public.issue_refund_internal(p_assignment_id uuid, p_amount_minor bigint, p_dispute_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare s assignments; c campaigns; pend bigint; keep bigint;
begin
  select * into s from assignments where id = p_assignment_id for update;
  select * into c from campaigns where id = s.campaign_id;
  if p_amount_minor is null or p_amount_minor <= 0 or p_amount_minor > c.fee_per_creator_minor then perform fail('Refund must be between 1 and the fee for this creator'); end if;
  if coalesce((select sum(amount_minor) from refunds where assignment_id = s.id), 0) + p_amount_minor > c.fee_per_creator_minor then perform fail('Refunds for this creator would exceed what the brand paid'); end if;
  -- the creator's pending earning shrinks in proportion (75% of what stays with the campaign)
  select coalesce(sum(amount_minor), 0) into pend from ledger_entries where assignment_id = s.id and state = 'pending' and source = 'campaign';
  keep := convert_minor(creator_share(c.fee_per_creator_minor - p_amount_minor - coalesce((select sum(amount_minor) from refunds where assignment_id = s.id), 0)), c.currency, (select currency from profiles where id = s.creator_id));
  if pend > 0 then
    if keep <= 0 then delete from ledger_entries where assignment_id = s.id and state = 'pending' and source = 'campaign';
    else update ledger_entries set amount_minor = least(amount_minor, keep) where assignment_id = s.id and state = 'pending' and source = 'campaign';
    end if;
  end if;
  insert into refunds (brand_id, campaign_id, assignment_id, dispute_id, amount_minor, currency, reason, admin_id) values (c.brand_id, c.id, s.id, p_dispute_id, p_amount_minor, c.currency, trim(p_reason), auth.uid());
  insert into payments (brand_id, campaign_id, kind, provider, gross_minor, amount_minor, currency, status, settled_at, metadata)
  values (c.brand_id, c.id, 'campaign', 'mock', p_amount_minor, p_amount_minor, c.currency, 'refunded', now(), jsonb_build_object('dispute_id', p_dispute_id, 'assignment_id', s.id));
  perform notify_brand(c.brand_id, 'refund', 'Refund issued', c.title, jsonb_build_object('campaign_id', c.id));
end $$;
revoke execute on function public.issue_refund_internal(uuid, bigint, uuid, text) from public, anon, authenticated;

create or replace function public.admin_campaign_action(p_campaign_id uuid, p_action text, p_reason text, p_new_deadline timestamptz default null) returns void
language plpgsql security definer set search_path = public as $$
declare c campaigns; s record; n int := 0;
begin
  if p_action = 'cancel_refund' then perform admin_guard('money', p_reason); else perform admin_guard('review', p_reason); end if;
  select * into c from campaigns where id = p_campaign_id for update;
  if c.id is null then perform fail('Campaign not found'); end if;
  if p_action = 'pause' then
    if c.status not in ('live', 'in_progress') then perform fail('Only a live campaign can be paused'); end if;
    update campaigns set status = 'paused', paused_from = c.status where id = c.id;
    perform audit_admin('campaign.pause', 'campaign', c.id::text, jsonb_build_object('status', c.status), jsonb_build_object('status', 'paused'), p_reason);
  elsif p_action = 'resume' then
    if c.status <> 'paused' then perform fail('This campaign is not paused'); end if;
    update campaigns set status = coalesce(c.paused_from, 'live'), paused_from = null where id = c.id;
    perform audit_admin('campaign.resume', 'campaign', c.id::text, jsonb_build_object('status', 'paused'), jsonb_build_object('status', coalesce(c.paused_from, 'live')), p_reason);
  elsif p_action = 'extend' then
    if p_new_deadline is null or p_new_deadline <= greatest(c.deadline, now()) then perform fail('Choose a date after the current deadline'); end if;
    update campaigns set deadline = p_new_deadline where id = c.id;
    update assignments set due_at = p_new_deadline where campaign_id = c.id and status in ('accepted', 'processing', 'variants_ready') and due_at < p_new_deadline;
    perform audit_admin('campaign.extend', 'campaign', c.id::text, jsonb_build_object('deadline', c.deadline), jsonb_build_object('deadline', p_new_deadline), p_reason);
  elsif p_action = 'cancel_refund' then
    if c.status in ('draft', 'completed', 'cancelled') then perform fail('This campaign cannot be cancelled'); end if;
    -- refund every place that has not been approved; approved work stays paid
    for s in select a.id from assignments a where a.campaign_id = c.id and a.approved_at is null and not exists (select 1 from refunds r where r.assignment_id = a.id) loop
      perform issue_refund_internal(s.id, c.fee_per_creator_minor, null, p_reason);
      n := n + 1;
    end loop;
    update campaigns set status = 'cancelled' where id = c.id;
    perform audit_admin('campaign.cancel_refund', 'campaign', c.id::text, jsonb_build_object('status', c.status), jsonb_build_object('status', 'cancelled', 'places_refunded', n), p_reason);
  else
    perform fail('Unknown action');
  end if;
  perform notify_brand(c.brand_id, 'campaign', case p_action when 'pause' then 'Your campaign was paused' when 'resume' then 'Your campaign is live again' when 'extend' then 'Your campaign deadline was extended' else 'Your campaign was cancelled' end, trim(p_reason), jsonb_build_object('campaign_id', c.id));
end $$;

-- ───────────────────────── disputes ─────────────────────────
drop function public.open_dispute(uuid, text);
create or replace function public.open_dispute(p_assignment_id uuid, p_reason text, p_type text default 'quality') returns uuid
language plpgsql security definer set search_path = public as $$
declare did uuid;
begin
  if not (owns_assignment(p_assignment_id) or can_manage_assignment(p_assignment_id)) then perform fail('Assignment not found'); end if;
  if p_type not in ('quality', 'non_delivery', 'payment_issue') then perform fail('Choose what the dispute is about'); end if;
  insert into disputes (assignment_id, opened_by, reason, type) values (p_assignment_id, uid_required(), p_reason, p_type) returning id into did;
  update assignments set status = 'disputed' where id = p_assignment_id and status = 'delivered';
  return did;
end $$;

drop function public.admin_resolve_dispute(uuid, text, text);
/**
 * Each dispute type has its own outcomes; anything that moves money needs the finance role.
 *   deadline_extension: approve_extension (p_new_due) · decline
 *   quality:            request_revision · partial_refund (p_amount_minor) · full_refund · release
 *   non_delivery:       full_refund · reassign
 *   payment_issue:      investigate (stays open) · release · full_refund
 * The note is sent to both parties.
 */
create or replace function public.admin_resolve_dispute(p_dispute_id uuid, p_action text, p_note text, p_amount_minor bigint default null, p_new_due timestamptz default null) returns void
language plpgsql security definer set search_path = public as $$
declare d disputes; s assignments; c campaigns; allowed text[]; money boolean; new_status text; label text;
begin
  money := p_action in ('partial_refund', 'full_refund', 'release');
  perform admin_guard(case when money then 'money' else 'review' end, p_note);
  select * into d from disputes where id = p_dispute_id and status = 'open' for update;
  if d.id is null then perform fail('Dispute is not open'); end if;
  allowed := case d.type when 'deadline_extension' then array['approve_extension', 'decline'] when 'quality' then array['request_revision', 'partial_refund', 'full_refund', 'release']
    when 'non_delivery' then array['full_refund', 'reassign'] else array['investigate', 'release', 'full_refund'] end;
  if not p_action = any (allowed) then perform fail('That outcome does not apply to this kind of dispute'); end if;
  select * into s from assignments where id = d.assignment_id for update;
  select * into c from campaigns where id = s.campaign_id;

  if p_action = 'investigate' then
    update disputes set notes = notes || jsonb_build_object('at', now(), 'by', auth.uid(), 'note', trim(p_note)), sla_due_at = now() + interval '48 hours' where id = d.id;
    new_status := 'open'; label := 'We are looking into it';
  elsif p_action = 'approve_extension' then
    if coalesce(p_new_due, d.requested_due_at) is null or coalesce(p_new_due, d.requested_due_at) <= now() then perform fail('Choose a new due date in the future'); end if;
    update assignments set due_at = coalesce(p_new_due, d.requested_due_at) where id = s.id;
    new_status := 'resolved_creator'; label := 'Extension approved';
  elsif p_action = 'decline' then
    new_status := 'declined'; label := 'Extension declined';
  elsif p_action = 'request_revision' then
    update assignments set status = 'accepted', due_at = greatest(due_at, now() + interval '5 days'), submitted_at = null, delivered_at = null where id = s.id;
    update variants v set status = 'qa_rejected', visible_to_brand = false from takes t where t.id = v.take_id and t.assignment_id = s.id and v.status = 'delivered';
    new_status := 'revision_requested'; label := 'Revision requested';
  elsif p_action = 'partial_refund' then
    perform issue_refund_internal(s.id, p_amount_minor, d.id, p_note);
    update assignments set status = 'delivered' where id = s.id and status = 'disputed';
    new_status := 'partially_refunded'; label := 'Partial refund issued';
  elsif p_action = 'full_refund' then
    perform issue_refund_internal(s.id, c.fee_per_creator_minor, d.id, p_note);
    new_status := 'refunded'; label := 'Refund issued';
  elsif p_action = 'release' then
    update assignments set status = 'delivered' where id = s.id and status = 'disputed';
    if (select status from assignments where id = s.id) = 'delivered' then perform approve_assignment_internal(s.id, null, null, false); end if;
    new_status := 'resolved_creator'; label := 'Payment released to the creator';
  elsif p_action = 'reassign' then
    delete from ledger_entries where assignment_id = s.id and state = 'pending';
    update applications set status = 'withdrawn' where campaign_id = s.campaign_id and creator_id = s.creator_id;
    delete from assignments where id = s.id;
    update campaigns set status = 'live' where id = c.id and status = 'in_progress' and not exists (select 1 from assignments a where a.campaign_id = c.id and a.status not in ('approved', 'completed'));
    new_status := 'reassigned'; label := 'The place was reopened for another creator';
  end if;

  if new_status <> 'open' then
    update disputes set status = new_status, resolution = trim(p_note), resolved_at = now(), resolved_by = auth.uid() where id = d.id;
  end if;
  perform audit_admin('dispute.' || p_action, 'dispute', d.id::text, jsonb_build_object('status', d.status, 'type', d.type),
    jsonb_build_object('status', new_status, 'amount_minor', p_amount_minor, 'new_due', p_new_due), p_note);
  perform notify(s.creator_id, 'dispute', label, trim(p_note), jsonb_build_object('campaign_id', c.id));
  perform notify_brand(c.brand_id, 'dispute', label, trim(p_note), jsonb_build_object('campaign_id', c.id));
end $$;

-- Deadline extensions: creator asks the brand first.
create or replace function public.request_extension(p_assignment_id uuid, p_new_due timestamptz, p_reason text) returns uuid
language plpgsql security definer set search_path = public as $$
declare me uuid := uid_required(); s assignments; c campaigns; rid uuid;
begin
  select * into s from assignments where id = p_assignment_id and creator_id = me;
  if s.id is null then perform fail('Assignment not found'); end if;
  if s.status not in ('accepted', 'processing', 'variants_ready') then perform fail('This work has already been submitted'); end if;
  if p_new_due is null or p_new_due <= s.due_at or p_new_due > s.due_at + interval '21 days' then perform fail('Ask for a date up to 21 days after the current one'); end if;
  if char_length(trim(coalesce(p_reason, ''))) < 10 then perform fail('Tell the brand why, in at least 10 characters'); end if;
  if exists (select 1 from extension_requests where assignment_id = s.id and status = 'pending') then perform fail('You already have a request waiting for the brand'); end if;
  insert into extension_requests (assignment_id, requested_by, new_due_at, reason) values (s.id, me, p_new_due, trim(p_reason)) returning id into rid;
  select * into c from campaigns where id = s.campaign_id;
  perform notify_brand(c.brand_id, 'extension', 'A creator asked for more time', c.title, jsonb_build_object('campaign_id', c.id, 'assignment_id', s.id));
  return rid;
end $$;

create or replace function public.escalate_extension_internal(p_request_id uuid, p_why text) returns uuid
language plpgsql security definer set search_path = public as $$
declare r extension_requests; did uuid;
begin
  select * into r from extension_requests where id = p_request_id for update;
  insert into disputes (assignment_id, opened_by, reason, type, requested_due_at) values (r.assignment_id, r.requested_by, p_why || ' Creator’s reason: ' || r.reason, 'deadline_extension', r.new_due_at) returning id into did;
  update extension_requests set status = 'escalated', dispute_id = did, responded_at = coalesce(responded_at, now()) where id = r.id;
  return did;
end $$;
revoke execute on function public.escalate_extension_internal(uuid, text) from public, anon, authenticated;

/** The brand answers within 48 hours. A decline goes to an admin, as does no answer (see the scheduler). */
create or replace function public.respond_extension(p_request_id uuid, p_approve boolean) returns void
language plpgsql security definer set search_path = public as $$
declare r extension_requests;
begin
  perform uid_required();
  select * into r from extension_requests where id = p_request_id and status = 'pending' for update;
  if r.id is null or not can_manage_assignment(r.assignment_id) then perform fail('Request not found'); end if;
  if p_approve then
    update extension_requests set status = 'approved', responded_at = now() where id = r.id;
    update assignments set due_at = r.new_due_at where id = r.assignment_id;
    perform notify(r.requested_by, 'extension', 'Your extension was approved', null, jsonb_build_object('assignment_id', r.assignment_id));
  else
    update extension_requests set status = 'declined', responded_at = now() where id = r.id;
    perform escalate_extension_internal(r.id, 'The brand declined a deadline extension.');
    perform notify(r.requested_by, 'extension', 'The brand declined your extension', 'Our team will review it within 48 hours.', jsonb_build_object('assignment_id', r.assignment_id));
  end if;
end $$;

-- ───────────────────────── payouts ─────────────────────────
/** Automatic holds, decided when the withdrawal is created. Rules live in settings.payout_hold_rules. */
create or replace function public.withdrawal_auto_hold() returns trigger language plpgsql security definer set search_path = public as $$
declare rules jsonb := coalesce((select value from settings where key = 'payout_hold_rules'), '{}'); usd bigint; why text; rule text;
begin
  usd := convert_minor(new.amount_minor, new.currency, 'USD');
  if coalesce((rules ->> 'first_withdrawal_usd_minor')::bigint, 0) > 0 and usd > (rules ->> 'first_withdrawal_usd_minor')::bigint
     and not exists (select 1 from withdrawals w where w.creator_id = new.creator_id and w.status = 'paid') then
    rule := 'first_withdrawal'; why := 'First withdrawal above the review threshold';
  elsif coalesce((rules ->> 'hold_on_verification_flag')::boolean, false) and exists (select 1 from social_accounts sa where sa.creator_id = new.creator_id and coalesce(array_length(sa.flags, 1), 0) > 0) then
    rule := 'verification_flag'; why := 'Account has an open verification flag';
  elsif coalesce((rules ->> 'hold_on_masking_flag')::boolean, false) and exists (select 1 from creators c where c.profile_id = new.creator_id and c.flagged) then
    rule := 'masking_flag'; why := 'Account is flagged for sharing contact details';
  end if;
  if rule is not null then
    new.status := 'on_hold'; new.hold_reason := why; new.hold_rule := rule; new.held_at := now(); new.provider_ref := null;
  end if;
  return new;
end $$;
create trigger withdrawal_auto_hold before insert on public.withdrawals for each row execute function public.withdrawal_auto_hold();

create or replace function public.admin_withdrawal_action(p_withdrawal_id uuid, p_action text, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare w withdrawals; next_status text;
begin
  perform admin_guard('money', p_reason);
  select * into w from withdrawals where id = p_withdrawal_id for update;
  if w.id is null then perform fail('Withdrawal not found'); end if;
  if p_action = 'hold' then
    if w.status not in ('requested', 'processing') then perform fail('Only a withdrawal that has not been paid can be held'); end if;
    update withdrawals set status = 'on_hold', hold_reason = trim(p_reason), hold_rule = 'manual', held_at = now(), held_by = auth.uid() where id = w.id;
    next_status := 'on_hold';
  elsif p_action = 'release' then
    if w.status <> 'on_hold' then perform fail('This withdrawal is not on hold'); end if;
    next_status := case when is_demo() then 'paid' else 'requested' end; -- demo: the mock provider pays at once
    update withdrawals set status = next_status, hold_reason = null, hold_rule = null, held_at = null, held_by = null,
      provider_ref = case when is_demo() then 'mock_po_' || substr(gen_random_uuid()::text, 1, 10) else provider_ref end where id = w.id;
  elsif p_action = 'retry' then
    if w.status <> 'failed' then perform fail('Only a failed withdrawal can be retried'); end if;
    next_status := case when is_demo() then 'paid' else 'processing' end;
    update withdrawals set status = next_status, provider_ref = case when is_demo() then 'mock_po_' || substr(gen_random_uuid()::text, 1, 10) else provider_ref end where id = w.id;
  else
    perform fail('Unknown action');
  end if;
  perform audit_admin('withdrawal.' || p_action, 'withdrawal', w.id::text, jsonb_build_object('status', w.status), jsonb_build_object('status', next_status), p_reason);
  perform notify(w.creator_id, 'payout', case p_action when 'hold' then 'Your withdrawal is on hold' when 'release' then 'Your withdrawal was released' else 'Your withdrawal is being retried' end,
    case when p_action = 'hold' then 'We are reviewing it and will be in touch.' end, jsonb_build_object('withdrawal_id', w.id));
end $$;

-- ───────────────────────── masking ─────────────────────────
create or replace function public.send_message(p_campaign_id uuid, p_creator_id uuid, p_body text) returns messages
language plpgsql security definer set search_path = public as $$
declare me uuid := uid_required(); m record; msg messages; n int; masked boolean;
begin
  if length(trim(coalesce(p_body, ''))) = 0 or length(p_body) > 2000 then perform fail('Message must be 1–2000 characters'); end if;
  if exists (select 1 from profiles where id = me and messaging_suspended_until > now()) then perform fail('Messaging is paused on your account for sharing contact details. Try again later.'); end if;
  if not ((me = p_creator_id and creator_in_campaign(p_campaign_id)) or can_manage_campaign(p_campaign_id)) then perform fail('Not part of this conversation'); end if;
  if me <> p_creator_id and not exists (select 1 from applications where campaign_id = p_campaign_id and creator_id = p_creator_id) then perform fail('Creator is not part of this campaign'); end if;
  select * into m from mask_contact(p_body);
  masked := coalesce(array_length(m.kinds, 1), 0) > 0;
  insert into messages (campaign_id, creator_id, sender_id, body_masked, had_masking) values (p_campaign_id, p_creator_id, me, m.masked, masked) returning * into msg;
  if masked then
    insert into masking_attempts (profile_id, campaign_id, kinds, message_id) values (me, p_campaign_id, m.kinds, msg.id);
    -- kept for Trust & Safety review only; see admin_reveal_original
    insert into masked_originals (message_id, original) values (msg.id, p_body);
    select count(*) into n from masking_attempts where profile_id = me;
    update creators set masking_attempts = n, flagged = flagged or n >= 3 where profile_id = me;
  end if;
  return msg;
end $$;

/** Trust & Safety only, with a reason, and written to the audit log every time. */
create or replace function public.admin_reveal_original(p_message_id uuid, p_reason text) returns text
language plpgsql security definer set search_path = public as $$
declare txt text;
begin
  perform admin_guard('reveal', p_reason);
  select original into txt from masked_originals where message_id = p_message_id;
  perform audit_admin('masking.reveal_original', 'message', p_message_id::text, null, jsonb_build_object('revealed', txt is not null), p_reason);
  if txt is null then perform fail('The original of this message was not kept'); end if;
  return txt;
end $$;

create or replace function public.admin_masking_action(p_profile_id uuid, p_action text, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare was profiles; new_status text;
begin
  perform admin_guard('review', p_reason);
  if p_action not in ('dismiss', 'warn', 'suspend_messaging', 'escalate') then perform fail('Unknown action'); end if;
  select * into was from profiles where id = p_profile_id for update;
  if was.id is null then perform fail('User not found'); end if;
  new_status := case p_action when 'dismiss' then 'dismissed' when 'warn' then 'warned' when 'suspend_messaging' then 'messaging_suspended' else 'escalated' end;
  update masking_attempts set status = new_status, handled_by = auth.uid(), handled_at = now() where profile_id = p_profile_id and status = 'open';
  if p_action = 'dismiss' then
    update creators set flagged = false where profile_id = p_profile_id;
  elsif p_action = 'warn' then
    perform notify(p_profile_id, 'warning', 'Please keep contact details off TakeOne', 'Sharing phone numbers, emails or links to other apps is against the terms you accepted. Further attempts will pause your messaging.', '{}');
  elsif p_action = 'suspend_messaging' then
    update profiles set messaging_suspended_until = now() + interval '7 days' where id = p_profile_id;
    perform notify(p_profile_id, 'warning', 'Messaging is paused for 7 days', trim(p_reason), '{}');
  else
    update profiles set suspended_at = now(), suspended_reason = trim(p_reason) where id = p_profile_id;
    perform notify(p_profile_id, 'account', 'Your account has been suspended', trim(p_reason), '{}');
  end if;
  perform audit_admin('masking.' || p_action, 'profile', p_profile_id::text, jsonb_build_object('messaging_suspended_until', was.messaging_suspended_until, 'suspended', was.suspended_at is not null),
    jsonb_build_object('attempts', new_status, 'suspended', p_action = 'escalate'), p_reason);
end $$;

-- ───────────────────────── settings, FX, jobs ─────────────────────────
/** One call saves several settings: p_changes is {key: new value}. Each key is audited with its old and new value. */
create or replace function public.admin_update_settings(p_changes jsonb, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare k text; v jsonb; was jsonb; lp jsonb;
begin
  perform admin_guard('settings', p_reason);
  for k, v in select * from jsonb_each(p_changes) loop
    if k not in ('qa_required_first_n_campaigns', 'license_pricing', 'pro_prices', 'feature_flags', 'demo_mode', 'payout_hold_rules', 'fee_ranges') then perform fail('Unknown setting: ' || k); end if;
    if k = 'license_pricing' then
      lp := v;
      if (lp ->> 'termDays')::int not between 35 and 45 then perform fail('The licence term must be between 35 and 45 days'); end if;
      if exists (select 1 from jsonb_each_text(lp - 'termDays') e where e.value::int < 0 or e.value::int > 50000) then perform fail('Licence prices must be between 0% and 500% of the fee'); end if;
    elsif k = 'qa_required_first_n_campaigns' then
      if jsonb_typeof(v) <> 'number' or v::text::int < 0 then perform fail('Enter a whole number of campaigns'); end if;
    elsif k = 'demo_mode' then
      if jsonb_typeof(v) <> 'boolean' then perform fail('Demo mode is on or off'); end if;
    elsif k = 'pro_prices' then
      if not (v ? 'default') or exists (select 1 from jsonb_each(v) e where (e.value ->> 'minor')::bigint <= 0) then perform fail('Every market needs a price above zero'); end if;
    end if;
    select value into was from settings where key = k;
    if was is distinct from v then
      insert into settings (key, value, updated_at) values (k, v, now()) on conflict (key) do update set value = excluded.value, updated_at = now();
      perform audit_admin('settings.update', 'setting', k, was, v, p_reason);
    end if;
  end loop;
end $$;

/** A manual rate, optionally until a date; when it lapses the next refresh replaces it. */
create or replace function public.admin_set_fx(p_currency text, p_rate numeric, p_expires timestamptz, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare was fx_rates;
begin
  perform admin_guard('settings', p_reason);
  if p_currency = 'USD' then perform fail('USD is the base currency'); end if;
  if p_rate is null or p_rate <= 0 or p_rate > 10 then perform fail('Enter the USD value of one unit'); end if;
  select * into was from fx_rates where currency = p_currency for update;
  if was.currency is null then perform fail('Unknown currency'); end if;
  update fx_rates set rate_to_usd = p_rate, updated_at = now(), source = 'Manual override', override_expires_at = p_expires where currency = p_currency;
  perform audit_admin('fx.override', 'fx_rate', p_currency, jsonb_build_object('rate_to_usd', was.rate_to_usd, 'source', was.source), jsonb_build_object('rate_to_usd', p_rate, 'expires', p_expires), p_reason);
end $$;

-- The scheduler, split into named jobs so each can be run and reported on its own.
create or replace function public.job_auto_approve() returns int language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  for r in select id from assignments where status = 'delivered' and delivered_at < now() - interval '5 days' loop
    perform approve_assignment_internal(r.id, null, null, true); n := n + 1;
  end loop;
  update ledger_entries set state = 'available' where state = 'cleared' and available_at <= now();
  return n;
end $$;
create or replace function public.job_licence_reminders() returns int language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  for r in select l.id, l.brand_id, l.campaign_id, l.ends_at, format_label(v.format) || ' · ' || c.title as what from licenses l join variants v on v.id = l.variant_id join campaigns c on c.id = l.campaign_id
      where l.ends_at between now() and now() + interval '7 days' and l.reminder_sent_at is null
      and not exists (select 1 from licenses x where x.variant_id = l.variant_id and (x.ends_at is null or x.ends_at > l.ends_at)) loop
    perform notify_brand(r.brand_id, 'renewal', 'A licence ends soon', r.what || ' · ends ' || to_char(r.ends_at, 'FMDD Mon YYYY'), jsonb_build_object('license_id', r.id, 'campaign_id', r.campaign_id, 'ends_at', r.ends_at));
    update licenses set reminder_sent_at = now() where id = r.id; n := n + 1;
  end loop;
  return n;
end $$;
create or replace function public.job_extension_escalations() returns int language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  for r in select id from extension_requests where status = 'pending' and respond_by < now() loop
    perform escalate_extension_internal(r.id, 'The brand did not answer a deadline extension within 48 hours.'); n := n + 1;
  end loop;
  return n;
end $$;
/** Hook for a live rate source. Until one is connected it only clears lapsed manual overrides and stamps the time. */
create or replace function public.job_fx_refresh() returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  with u as (update fx_rates set updated_at = now(), source = case when override_expires_at is not null and override_expires_at <= now() then 'Seeded rate' else source end,
    override_expires_at = case when override_expires_at <= now() then null else override_expires_at end where currency is not null returning 1)
  select count(*) into n from u;
  return n;
end $$;
create or replace function public.job_guarantees_leaderboards() returns int language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  update brands b set credit_balance = coalesce((select sum(amount_minor - used_minor) from credits c where c.brand_id = b.id and c.expires_at > now()), 0) where b.id is not null;
  for r in select profile_id from creators where tier = 'pro' and not is_founding loop perform refresh_guarantee(r.profile_id); n := n + 1; end loop;
  perform refresh_leaderboards();
  return n;
end $$;
revoke execute on function public.job_auto_approve(), public.job_licence_reminders(), public.job_extension_escalations(), public.job_fx_refresh(), public.job_guarantees_leaderboards() from public, anon, authenticated;

create or replace function public.run_job_internal(p_job text) returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  n := case p_job when 'auto_approve' then job_auto_approve() when 'licence_reminders' then job_licence_reminders() when 'extension_escalations' then job_extension_escalations()
    when 'fx_refresh' then job_fx_refresh() when 'leaderboards' then job_guarantees_leaderboards() end;
  if n is null then perform fail('Unknown job'); end if;
  insert into job_runs (job, detail, run_by) values (p_job, jsonb_build_object('affected', n), auth.uid());
  return n;
end $$;
revoke execute on function public.run_job_internal(text) from public, anon, authenticated;

/** The worker (or cron) runs everything on a schedule. */
create or replace function public.run_scheduled_jobs() returns jsonb language plpgsql security definer set search_path = public as $$
declare a int; l int; e int; g int;
begin
  if not is_worker() then perform fail('Not allowed'); end if;
  a := run_job_internal('auto_approve'); l := run_job_internal('licence_reminders'); e := run_job_internal('extension_escalations');
  perform run_job_internal('fx_refresh'); g := run_job_internal('leaderboards');
  return jsonb_build_object('auto_approved', a, 'renewal_reminders', l, 'extensions_escalated', e, 'guarantees_checked', g);
end $$;
revoke execute on function public.run_scheduled_jobs() from public, anon;

/** A super admin runs one job by hand, with a reason. */
create or replace function public.admin_run_job(p_job text, p_reason text) returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  perform admin_guard('settings', p_reason);
  n := run_job_internal(p_job);
  perform audit_admin('job.run', 'job', p_job, null, jsonb_build_object('affected', n), p_reason);
  return n;
end $$;

-- ───────────────────────── overview ─────────────────────────
/** Counts for the sidebar badges and the "Needs attention" panel. Each admin sees only the areas their role covers. */
create or replace function public.admin_counts() returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then perform fail('Admins only'); end if;
  return jsonb_build_object(
    'qa', (select count(distinct take_id) from variants where status = 'qa_pending'),
    'verification', (select count(*) from social_accounts where verification = 'self_reported' and (ownership_requested_at is not null or screen_recording_path is not null or coalesce(array_length(flags, 1), 0) > 0)),
    'disputes', (select count(*) from disputes where status = 'open'),
    'oldest_dispute_hours', (select floor(extract(epoch from now() - min(created_at)) / 3600) from disputes where status = 'open'),
    'masking', (select count(distinct profile_id) from masking_attempts where status = 'open'),
    'payouts_on_hold', case when admin_can('money') then (select count(*) from withdrawals where status = 'on_hold') end,
    'payouts_failed', case when admin_can('money') then (select count(*) from withdrawals where status = 'failed') end,
    'past_deadline', (select count(*) from campaigns where status in ('live', 'in_progress') and deadline < now()));
end $$;

/** Headline numbers for the Overview: this month against last month, and marketplace health. Amounts are USD minor units. */
create or replace function public.admin_overview() returns jsonb language plpgsql stable security definer set search_path = public as $$
declare m0 timestamptz := date_trunc('month', now()); m1 timestamptz := date_trunc('month', now()) - interval '1 month'; out jsonb;
begin
  if not is_admin() then perform fail('Admins only'); end if;
  with pay as (
    select p.*, convert_minor(p.gross_minor, p.currency, 'USD') as usd, (p.created_at >= m0) as cur, (p.created_at >= m1 and p.created_at < m0) as prev
    from payments p where p.status in ('held', 'released') and p.created_at >= m1
  ), camp as (
    select c.id, c.brand_id, c.creators_needed, c.published_at, (c.published_at >= m0) as cur, (c.published_at >= m1 and c.published_at < m0) as prev
    from campaigns c where c.published_at is not null
  ), paid as (
    -- an approved paid campaign: funded, and at least one creator's work approved
    select c.id, min(a.approved_at) as first_approved from campaigns c join assignments a on a.campaign_id = c.id where a.approved_at is not null group by c.id
  )
  select jsonb_build_object(
    'approved_campaigns', jsonb_build_object('now', (select count(*) from paid where first_approved >= m0), 'prev', (select count(*) from paid where first_approved >= m1 and first_approved < m0)),
    'gmv', jsonb_build_object('now', (select coalesce(sum(usd), 0) from pay where cur), 'prev', (select coalesce(sum(usd), 0) from pay where prev),
      'by_currency', (select coalesce(jsonb_object_agg(currency, total), '{}') from (select currency, sum(gross_minor) as total from pay where cur group by currency) x)),
    'revenue', jsonb_build_object('now', (select coalesce(sum(usd - creator_share(usd)), 0) from pay where cur), 'prev', (select coalesce(sum(usd - creator_share(usd)), 0) from pay where prev),
      'licence_now', (select coalesce(sum(usd - creator_share(usd)), 0) from pay where cur and kind = 'license')),
    'renewals', jsonb_build_object('now', (select count(*) from pay where cur and metadata ->> 'type' = 'renewal'), 'prev', (select count(*) from pay where prev and metadata ->> 'type' = 'renewal'),
      'value_now', (select coalesce(sum(usd), 0) from pay where cur and metadata ->> 'type' = 'renewal')),
    'fill_rate', (select jsonb_build_object('filled', count(*) filter (where (select count(*) from assignments a where a.campaign_id = camp.id and a.created_at <= camp.published_at + interval '72 hours') >= camp.creators_needed), 'of', count(*)) from camp),
    'hours_to_first_variant', (select round((percentile_cont(0.5) within group (order by extract(epoch from a.delivered_at - coalesce(a.product_shipped_at, a.created_at)) / 3600))::numeric, 0) from assignments a where a.delivered_at is not null),
    'approval_rate', (select jsonb_build_object('approved', count(*) filter (where a.approved_at is not null), 'of', count(*)) from assignments a where a.delivered_at is not null),
    'repeat_brands', (select jsonb_build_object('repeat', count(*) filter (where n >= 2), 'of', count(*)) from (
      select c.brand_id, count(*) filter (where c.published_at <= first_at + interval '60 days') as n
      from camp c join (select brand_id, min(published_at) as first_at from camp group by brand_id) f using (brand_id) group by c.brand_id) b)
  ) into out;
  return out;
end $$;

revoke execute on function public.admin_counts(), public.admin_overview(), public.admin_mfa_ok(), public.my_admin_role(), public.admin_can(text) from public, anon;

-- Credits stay disabled: the old un-audited issue function is no longer callable from the app.
revoke execute on function public.admin_issue_credit(uuid, bigint, int) from public, anon, authenticated;
