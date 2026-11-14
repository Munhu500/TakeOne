-- Business operations as SECURITY DEFINER functions. Clients call them with their own login (supabase.rpc);
-- every function checks who is calling. Money maths mirrors packages/shared/src/pricing.ts (unit-tested there).

-- ───────────────────────── helpers ─────────────────────────
create or replace function public.is_trusted() returns boolean language sql stable as $$
  -- service_role JWT, or a direct database session (migrations, cron) with no JWT at all
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', 'service_role') = 'service_role';
$$;
create or replace function public.is_worker() returns boolean language sql stable security definer set search_path = public as $$
  select is_trusted() or exists (select 1 from profiles where id = auth.uid() and role = 'worker');
$$;
create or replace function public.is_demo() returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select value from settings where key = 'demo_mode') = 'true'::jsonb, false);
$$;
create or replace function public.uid_required() returns uuid language plpgsql stable as $$
begin
  if auth.uid() is null then raise exception 'Sign in required' using errcode = 'P0001'; end if;
  return auth.uid();
end $$;
create or replace function public.fail(msg text) returns void language plpgsql as $$
begin raise exception '%', msg using errcode = 'P0001'; end $$;

-- creator 75% / platform 25%; the rounding remainder goes to the creator
create or replace function public.creator_share(gross bigint) returns bigint language sql immutable as $$
  select gross - (gross * 2500) / 10000;
$$;
create or replace function public.convert_minor(amount bigint, from_cur text, to_cur text) returns bigint
language sql stable security definer set search_path = public as $$
  select case when from_cur = to_cur then amount else
    round(amount * (select rate_to_usd from fx_rates where currency = from_cur) / (select rate_to_usd from fx_rates where currency = to_cur))::bigint end;
$$;
create or replace function public.notify(pid uuid, ntype text, ntitle text, nbody text default null, ndata jsonb default '{}') returns void
language sql security definer set search_path = public as $$
  insert into notifications (profile_id, type, title, body, data) values (pid, ntype, ntitle, nbody, ndata);
$$;
create or replace function public.notify_brand(bid uuid, ntype text, ntitle text, nbody text default null, ndata jsonb default '{}') returns void
language sql security definer set search_path = public as $$
  insert into notifications (profile_id, type, title, body, data)
  select distinct m.profile_id, ntype, ntitle, nbody, ndata from memberships m
  where m.brand_id = bid or m.agency_id = (select agency_id from brands where id = bid);
$$;
create or replace function public.audit(action text, entity text, entity_id text, data jsonb default '{}') returns void
language sql security definer set search_path = public as $$
  insert into audit_log (actor_id, action, entity, entity_id, data) values (auth.uid(), action, entity, entity_id, data);
$$;
create or replace function public.bump_month(cid uuid, w int, s int, c int, usd bigint) returns void
language sql security definer set search_path = public as $$
  insert into creator_monthly_stats (creator_id, month, wins, submissions, completed, earnings_usd_minor)
  values (cid, date_trunc('month', now())::date, w, s, c, usd)
  on conflict (creator_id, month) do update set wins = creator_monthly_stats.wins + w, submissions = creator_monthly_stats.submissions + s,
    completed = creator_monthly_stats.completed + c, earnings_usd_minor = creator_monthly_stats.earnings_usd_minor + usd;
$$;
create or replace function public.license_bps(ltype text) returns int language sql stable security definer set search_path = public as $$
  select coalesce(((select value from settings where key = 'license_pricing') ->> (case ltype
    when 'extra' then 'extraVariantBps' when 'renewal' then 'renewalBps' when 'buyout' then 'buyoutBps' when 'whitelist' then 'whitelistBps' end))::int, 0);
$$;
create or replace function public.license_term_days() returns int language sql stable security definer set search_path = public as $$
  select coalesce(((select value from settings where key = 'license_pricing') ->> 'termDays')::int, 90);
$$;

-- ───────────────────────── contact masking (mirrors packages/shared/src/masking.ts) ─────────────────────────
create or replace function public.mask_contact(body text, out masked text, out kinds text[]) language plpgsql immutable as $$
declare
  pats text[][] := array[
    ['email', '[a-z0-9._%+-]+\s*(?:@|\(at\)|\[at\]|\sat\s)\s*[a-z0-9-]+\s*(?:\.|\(dot\)|\[dot\]|\sdot\s)\s*[a-z]{2,}(?:\.[a-z]{2,})?'],
    ['link', '(?:https?://)?(?:wa\.me|api\.whatsapp\.com|chat\.whatsapp\.com|t\.me|telegram\.me|signal\.me|m\.me|discord\.gg)/\S*'],
    ['link', '(?:https?://|www\.)\S+'],
    ['phone', '(?:\+|00)?\d(?:[\s().-]*\d){7,14}'],
    ['handle', '\y(?:insta(?:gram)?|ig|tiktok|snap(?:chat)?|telegram|tg)\y\s*(?:is|:|-|@)?\s*@?[a-z0-9._]{3,30}'],
    ['handle', '(?<![a-z0-9])@[a-z0-9._]{3,30}'],
    ['phrase', '\y(?:dm me|text me|call me|ping me|my (?:number|no\.?|phone|cell|mobile|email|e-mail|whats\s?app|insta|telegram)|whats\s?app(?: me)?|telegram me|off[\s-]?platform|outside (?:the |this )?(?:app|platform)|pay (?:me )?direct(?:ly)?|contact me (?:directly|on|at))\y']
  ];
  i int;
begin
  masked := body; kinds := '{}';
  for i in 1 .. array_length(pats, 1) loop
    if masked ~* pats[i][2] then
      kinds := kinds || pats[i][1];
      masked := regexp_replace(masked, pats[i][2], '•••', 'gi');
    end if;
  end loop;
end $$;

create or replace function public.send_message(p_campaign_id uuid, p_creator_id uuid, p_body text) returns messages
language plpgsql security definer set search_path = public as $$
declare me uuid := uid_required(); m record; msg messages; n int;
begin
  if length(trim(coalesce(p_body, ''))) = 0 or length(p_body) > 2000 then perform fail('Message must be 1–2000 characters'); end if;
  if not ((me = p_creator_id and creator_in_campaign(p_campaign_id)) or can_manage_campaign(p_campaign_id)) then perform fail('Not part of this conversation'); end if;
  if me <> p_creator_id and not exists (select 1 from applications where campaign_id = p_campaign_id and creator_id = p_creator_id) then perform fail('Creator is not part of this campaign'); end if;
  select * into m from mask_contact(p_body);
  if array_length(m.kinds, 1) > 0 then
    insert into masking_attempts (profile_id, campaign_id, kinds) values (me, p_campaign_id, m.kinds);
    select count(*) into n from masking_attempts where profile_id = me;
    update creators set masking_attempts = n, flagged = flagged or n >= 3 where profile_id = me;
  end if;
  insert into messages (campaign_id, creator_id, sender_id, body_masked, had_masking)
  values (p_campaign_id, p_creator_id, me, m.masked, coalesce(array_length(m.kinds, 1), 0) > 0) returning * into msg;
  return msg;
end $$;

-- ───────────────────────── creator: onboarding, likeness, KYC, Pro ─────────────────────────
create or replace function public.complete_onboarding(p_display_name text, p_country text, p_categories text[], p_permit text default null) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := uid_required(); cur text; loc text;
begin
  if p_country not in ('IN', 'AE', 'US') then perform fail('Unsupported country'); end if;
  if p_country = 'AE' and length(trim(coalesce(p_permit, ''))) = 0 then perform fail('UAE Media Council Advertiser Permit number is required'); end if;
  if coalesce(array_length(p_categories, 1), 0) = 0 then perform fail('Pick at least one category'); end if;
  cur := case p_country when 'IN' then 'INR' when 'AE' then 'AED' else 'USD' end;
  loc := case p_country when 'IN' then 'en-IN' when 'AE' then 'en-AE' else 'en-US' end;
  update profiles set display_name = p_display_name, country = p_country, currency = cur, locale = loc, onboarded = true where id = me;
  update creators set categories = p_categories, uae_permit_number = nullif(trim(p_permit), '') where profile_id = me;
  insert into terms_acceptances (profile_id, terms_type, version) values (me, 'creator_terms', '2026-01');
  insert into guarantee_tracking (creator_id) values (me) on conflict do nothing;
end $$;

create or replace function public.setup_likeness(p_capture_paths text[]) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := uid_required();
begin
  -- demo: the voice clone id is minted here; with a real provider the worker replaces it after cloning
  insert into likeness_profiles (creator_id, status, voice_provider_id, capture_paths, consent_version)
  values (me, 'ready', 'mock-voice-' || substr(me::text, 1, 8), p_capture_paths, '2026-01')
  on conflict (creator_id) do update set status = 'ready', capture_paths = excluded.capture_paths, revoked_at = null,
    voice_provider_id = excluded.voice_provider_id, consent_version = excluded.consent_version;
  insert into terms_acceptances (profile_id, terms_type, version) values (me, 'likeness_consent', '2026-01');
end $$;

-- Revoke for all future uses and delete stored captures (files are removed by the client/worker).
create or replace function public.revoke_likeness() returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := uid_required();
begin
  update likeness_profiles set status = 'revoked', revoked_at = now(), voice_provider_id = null, capture_paths = '{}' where creator_id = me;
  update likeness_consents set revoked_at = now() where creator_id = me and revoked_at is null
    and campaign_id in (select campaign_id from assignments where creator_id = me and status = 'accepted');
end $$;

create or replace function public.submit_kyc(p_id_path text, p_selfie_path text, p_tax_id text default null) returns text
language plpgsql security definer set search_path = public as $$
declare me uuid := uid_required(); ctry text; st text;
begin
  select country into ctry from profiles where id = me;
  if ctry = 'IN' and coalesce(upper(p_tax_id), '') !~ '^[A-Z]{5}[0-9]{4}[A-Z]$' then perform fail('Enter a valid PAN (e.g. ABCDE1234F)'); end if;
  if coalesce(p_id_path, '') = '' or coalesce(p_selfie_path, '') = '' then perform fail('ID photo and selfie are required'); end if;
  st := case when is_demo() then 'verified' else 'pending' end; -- mock provider approves instantly
  update creators set kyc_status = st, kyc_paths = jsonb_build_object('id', p_id_path, 'selfie', p_selfie_path), tax_id = nullif(upper(p_tax_id), '') where profile_id = me;
  return st;
end $$;

-- Activates Pro. Demo mode: callable by the creator (mock checkout). Otherwise only the Stripe webhook (service role).
create or replace function public.activate_pro(p_creator uuid default null, p_provider_ref text default null) returns void
language plpgsql security definer set search_path = public as $$
declare cid uuid := coalesce(p_creator, auth.uid());
begin
  if not (is_trusted() or (is_demo() and cid = auth.uid())) then perform fail('Payment confirmation required'); end if;
  update creators set tier = 'pro' where profile_id = cid;
  insert into subscriptions (creator_id, provider, provider_ref, status, current_period_end)
  values (cid, case when is_trusted() then 'stripe' else 'mock' end, coalesce(p_provider_ref, 'mock_sub_' || substr(gen_random_uuid()::text, 1, 8)), 'active', now() + interval '1 month')
  on conflict (creator_id) do update set status = 'active', provider_ref = excluded.provider_ref, current_period_end = excluded.current_period_end;
  insert into guarantee_tracking (creator_id, window_start) values (cid, now())
  on conflict (creator_id) do update set window_start = now();
end $$;
create or replace function public.cancel_pro() returns void
language plpgsql security definer set search_path = public as $$
begin
  update subscriptions set status = 'canceled' where creator_id = uid_required();
  update creators set tier = 'free' where profile_id = auth.uid();
end $$;

-- ───────────────────────── brand / agency setup ─────────────────────────
create or replace function public.create_brand(p_name text, p_country text, p_accept_terms boolean) returns uuid
language plpgsql security definer set search_path = public as $$
declare me uuid := uid_required(); bid uuid;
begin
  if not coalesce(p_accept_terms, false) then perform fail('You must accept the non-circumvention terms'); end if;
  if (select role from profiles where id = me) <> 'brand_member' then perform fail('Only brand accounts can create a brand'); end if;
  insert into brands (name, country, currency) values (p_name, p_country, case p_country when 'IN' then 'INR' when 'AE' then 'AED' else 'USD' end) returning id into bid;
  insert into memberships (profile_id, brand_id) values (me, bid);
  update profiles set country = p_country, currency = case p_country when 'IN' then 'INR' when 'AE' then 'AED' else 'USD' end, onboarded = true where id = me;
  insert into terms_acceptances (profile_id, terms_type, version) values (me, 'brand_non_circumvention', '2026-01');
  return bid;
end $$;

create or replace function public.create_agency(p_name text, p_subdomain text, p_color text, p_country text, p_accept_terms boolean) returns uuid
language plpgsql security definer set search_path = public as $$
declare me uuid := uid_required(); aid uuid;
begin
  if not coalesce(p_accept_terms, false) then perform fail('You must accept the non-circumvention terms'); end if;
  if (select role from profiles where id = me) <> 'agency_member' then perform fail('Only agency accounts can create an agency'); end if;
  if p_subdomain !~ '^[a-z0-9.-]{2,120}$' then perform fail('Invalid subdomain'); end if;
  insert into agencies (name, subdomain, primary_color) values (p_name, p_subdomain, coalesce(p_color, '#7C5CFF')) returning id into aid;
  insert into memberships (profile_id, agency_id) values (me, aid);
  update profiles set country = p_country, currency = case p_country when 'IN' then 'INR' when 'AE' then 'AED' else 'USD' end, onboarded = true where id = me;
  insert into terms_acceptances (profile_id, terms_type, version) values (me, 'agency_non_circumvention', '2026-01');
  return aid;
end $$;

create or replace function public.create_client_brand(p_agency_id uuid, p_name text, p_country text, p_markup_bps int default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare bid uuid;
begin
  if p_agency_id not in (select my_agency_ids()) then perform fail('Not your agency'); end if;
  insert into brands (name, country, currency, agency_id, markup_bps)
  values (p_name, p_country, case p_country when 'IN' then 'INR' when 'AE' then 'AED' else 'USD' end, p_agency_id, p_markup_bps) returning id into bid;
  return bid;
end $$;

-- ───────────────────────── escrow payment → campaign goes live ─────────────────────────
-- Demo mode: the brand calls this after the mock checkout. Otherwise only the Stripe/Razorpay webhook (service role) may.
create or replace function public.confirm_campaign_payment(p_campaign_id uuid, p_provider text default 'mock', p_provider_ref text default null) returns payments
language plpgsql security definer set search_path = public as $$
declare c campaigns; gross bigint; pool bigint; fee bigint; apply bigint := 0; take bigint; cr record; pay payments; live_count int; threshold int;
begin
  select * into c from campaigns where id = p_campaign_id for update;
  if c.id is null then perform fail('Campaign not found'); end if;
  if not (is_trusted() or (is_demo() and can_manage_campaign(c.id))) then perform fail('Payment confirmation required'); end if;
  if c.status not in ('draft', 'pending_payment') then perform fail('Campaign is already funded'); end if;
  gross := c.fee_per_creator_minor * c.creators_needed;
  pool := creator_share(c.fee_per_creator_minor) * c.creators_needed;
  fee := gross - pool;
  -- Option B credit: only ever reduces the platform fee, never the creator pool
  for cr in select * from credits where brand_id = c.brand_id and currency = c.currency and expires_at > now() and used_minor < amount_minor order by expires_at for update loop
    exit when apply >= fee;
    take := least(cr.amount_minor - cr.used_minor, fee - apply);
    update credits set used_minor = used_minor + take where id = cr.id;
    apply := apply + take;
  end loop;
  update brands set credit_balance = greatest(credit_balance - apply, 0) where id = c.brand_id;
  insert into payments (brand_id, campaign_id, kind, provider, provider_ref, gross_minor, amount_minor, credit_applied_minor, currency, status)
  values (c.brand_id, c.id, 'campaign', p_provider, coalesce(p_provider_ref, 'mock_pi_' || substr(gen_random_uuid()::text, 1, 12)), gross, gross - apply, apply, c.currency, 'held')
  returning * into pay;
  select count(*) into live_count from campaigns where published_at is not null;
  select coalesce((value #>> '{}')::int, 100) into threshold from settings where key = 'qa_required_first_n_campaigns';
  update campaigns set status = 'live', published_at = now(), early_access_until = now() + interval '48 hours', qa_required = live_count < coalesce(threshold, 100) where id = c.id;
  perform audit('campaign.funded', 'campaign', c.id::text, jsonb_build_object('gross', gross, 'credit', apply));
  return pay;
end $$;

-- ───────────────────────── applicants ─────────────────────────
create or replace function public.accept_creator(p_campaign campaigns, p_creator uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare aid uuid; ccur text;
begin
  if (select count(*) from assignments where campaign_id = p_campaign.id) >= p_campaign.creators_needed then perform fail('All creator slots are filled'); end if;
  insert into assignments (campaign_id, creator_id, due_at) values (p_campaign.id, p_creator, p_campaign.deadline) returning id into aid;
  select currency into ccur from profiles where id = p_creator;
  insert into ledger_entries (creator_id, source, amount_minor, currency, state, campaign_id, assignment_id, payment_id, description)
  values (p_creator, 'campaign', convert_minor(creator_share(p_campaign.fee_per_creator_minor), p_campaign.currency, ccur), ccur, 'pending', p_campaign.id, aid,
    (select id from payments where campaign_id = p_campaign.id and kind = 'campaign' order by created_at limit 1), p_campaign.title);
  update campaigns set status = 'in_progress' where id = p_campaign.id and status = 'live';
  perform notify(p_creator, 'accepted', 'You''re in: ' || p_campaign.title, 'Open the campaign to see your shot list and start shooting.', jsonb_build_object('campaign_id', p_campaign.id, 'assignment_id', aid));
  return aid;
end $$;
revoke execute on function public.accept_creator(campaigns, uuid) from public, anon, authenticated;

create or replace function public.set_application_status(p_application_id uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
declare a applications; c campaigns;
begin
  select * into a from applications where id = p_application_id for update;
  if a.id is null or not can_manage_campaign(a.campaign_id) then perform fail('Application not found'); end if;
  if p_status not in ('shortlisted', 'accepted', 'rejected') then perform fail('Invalid status'); end if;
  if a.status in ('accepted', 'declined', 'withdrawn') then perform fail('Application is already closed'); end if;
  select * into c from campaigns where id = a.campaign_id;
  if c.status not in ('live', 'in_progress') then perform fail('Fund the campaign before choosing creators'); end if;
  if p_status = 'accepted' then
    if a.status = 'invited' then perform fail('Waiting for the creator to respond to your invite'); end if;
    perform accept_creator(c, a.creator_id);
  end if;
  update applications set status = p_status where id = a.id;
end $$;

create or replace function public.invite_creator(p_campaign_id uuid, p_creator_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare c campaigns;
begin
  select * into c from campaigns where id = p_campaign_id;
  if c.id is null or not can_manage_campaign(c.id) then perform fail('Campaign not found'); end if;
  if c.status not in ('live', 'in_progress') then perform fail('Fund the campaign before inviting creators'); end if;
  insert into applications (campaign_id, creator_id, status, invited, invited_at) values (c.id, p_creator_id, 'invited', true, now())
  on conflict (campaign_id, creator_id) do nothing;
  perform notify(p_creator_id, 'invite', 'Invitation: ' || c.title, 'A brand invited you directly. Respond within 48 hours.', jsonb_build_object('campaign_id', c.id));
end $$;

create or replace function public.respond_invite(p_application_id uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = public as $$
declare a applications; c campaigns;
begin
  select * into a from applications where id = p_application_id and creator_id = uid_required() for update;
  if a.id is null or a.status <> 'invited' then perform fail('Invite not found'); end if;
  select * into c from campaigns where id = a.campaign_id;
  if p_accept then perform accept_creator(c, a.creator_id); end if;
  update applications set status = case when p_accept then 'accepted' else 'declined' end, responded_at = now() where id = a.id;
end $$;

-- ───────────────────────── studio → QA → delivery ─────────────────────────
create or replace function public.deliver_assignment(p_assignment_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare s assignments; c campaigns; n int;
begin
  select * into s from assignments where id = p_assignment_id;
  select * into c from campaigns where id = s.campaign_id;
  select count(*) into n from variants v join takes t on t.id = v.take_id where t.assignment_id = s.id and v.status = 'delivered';
  update assignments set status = 'delivered', delivered_at = now() where id = s.id;
  update creators set submissions_count = submissions_count + n where profile_id = s.creator_id;
  perform bump_month(s.creator_id, 0, n, 0, 0);
  perform notify_brand(c.brand_id, 'delivered', 'New variants to review', c.title, jsonb_build_object('campaign_id', c.id, 'assignment_id', s.id));
end $$;
revoke execute on function public.deliver_assignment(uuid) from public, anon, authenticated;

create or replace function public.set_hook(p_variant_id uuid, p_hook text) returns void
language plpgsql security definer set search_path = public as $$
begin
  update variants set hook_text = p_hook where id = p_variant_id and owns_take(take_id) and status in ('ready', 'qa_rejected') and p_hook = any (hook_options);
  if not found then perform fail('Pick one of the suggested hooks'); end if;
end $$;

create or replace function public.submit_variants(p_assignment_id uuid, p_variant_ids uuid[]) returns text
language plpgsql security definer set search_path = public as $$
declare s assignments; c campaigns; n int;
begin
  select * into s from assignments where id = p_assignment_id and creator_id = uid_required() for update;
  if s.id is null then perform fail('Assignment not found'); end if;
  if s.status <> 'variants_ready' then perform fail('Nothing to submit right now'); end if;
  select * into c from campaigns where id = s.campaign_id;
  update variants v set visible_to_brand = not c.qa_required, status = case when c.qa_required then 'qa_pending' else 'delivered' end
  from takes t where t.id = v.take_id and t.assignment_id = s.id and v.id = any (p_variant_ids) and v.status in ('ready', 'qa_rejected');
  get diagnostics n = row_count;
  if n = 0 then perform fail('Choose at least one finished variant'); end if;
  update assignments set submitted_at = now(), status = case when c.qa_required then 'qa_review' else status end where id = s.id;
  if not c.qa_required then perform deliver_assignment(s.id); return 'delivered'; end if;
  return 'qa_review';
end $$;

create or replace function public.qa_review(p_variant_id uuid, p_approve boolean, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare aid uuid; pending int; ok int; cre uuid;
begin
  if not is_admin() then perform fail('Admins only'); end if;
  update variants set status = case when p_approve then 'delivered' else 'qa_rejected' end, visible_to_brand = p_approve, qa_note = p_note
  where id = p_variant_id and status = 'qa_pending';
  if not found then perform fail('Variant is not awaiting QA'); end if;
  select t.assignment_id into aid from variants v join takes t on t.id = v.take_id where v.id = p_variant_id;
  select count(*) filter (where v.status = 'qa_pending'), count(*) filter (where v.status = 'delivered') into pending, ok
  from variants v join takes t on t.id = v.take_id where t.assignment_id = aid;
  perform audit('qa.review', 'variant', p_variant_id::text, jsonb_build_object('approve', p_approve, 'note', p_note));
  if pending = 0 then
    if ok > 0 then perform deliver_assignment(aid);
    else
      update assignments set status = 'variants_ready' where id = aid returning creator_id into cre;
      perform notify(cre, 'qa_rejected', 'Your variants need changes', coalesce(p_note, 'Review the QA notes in Studio and resubmit.'), jsonb_build_object('assignment_id', aid));
    end if;
  end if;
end $$;

-- ───────────────────────── selection, licensing, approval ─────────────────────────
create or replace function public.record_win(p_creator uuid, n int) returns void
language sql security definer set search_path = public as $$
  update creators set wins_count = wins_count + n, win_rate = case when submissions_count > 0 then least(1, (wins_count + n)::numeric / submissions_count) else 0 end where profile_id = p_creator;
  select bump_month(p_creator, n, 0, 0, 0);
$$;
revoke execute on function public.record_win(uuid, int) from public, anon, authenticated;

-- Base campaign: up to 3 selected variants, 90 days paid usage + perpetual organic use on the brand's own channels.
create or replace function public.select_variants(p_assignment_id uuid, p_variant_ids uuid[]) returns void
language plpgsql security definer set search_path = public as $$
declare s assignments; c campaigns; have int; n int;
begin
  select * into s from assignments where id = p_assignment_id for update;
  if s.id is null or not can_manage_campaign(s.campaign_id) then perform fail('Assignment not found'); end if;
  if s.status not in ('delivered', 'approved', 'completed') then perform fail('Variants have not been delivered yet'); end if;
  select * into c from campaigns where id = s.campaign_id;
  select count(*) into have from licenses l join variants v on v.id = l.variant_id join takes t on t.id = v.take_id where t.assignment_id = s.id and l.type = 'base';
  if have + coalesce(array_length(p_variant_ids, 1), 0) > 3 then perform fail('The base campaign includes up to 3 variants. License more as add-ons.'); end if;
  with picked as (
    update variants v set status = 'licensed' from takes t
    where t.id = v.take_id and t.assignment_id = s.id and v.id = any (p_variant_ids) and v.status = 'delivered' and v.visible_to_brand returning v.id
  ), ins as (
    insert into licenses (variant_id, brand_id, campaign_id, type, ends_at, price_minor, currency)
    select id, c.brand_id, c.id, 'base', now() + make_interval(days => license_term_days()), 0, c.currency from picked returning 1
  ) select count(*) into n from ins;
  if n = 0 then perform fail('Choose delivered variants to select'); end if;
  perform record_win(s.creator_id, n);
  perform notify(s.creator_id, 'selected', n || ' of your variants were selected', c.title, jsonb_build_object('assignment_id', s.id));
end $$;

-- Paid add-ons: extra variant, renewal, buyout, whitelisting. Creator gets 75% of every one.
create or replace function public.purchase_license(p_variant_id uuid, p_type text, p_provider text default 'mock', p_provider_ref text default null) returns licenses
language plpgsql security definer set search_path = public as $$
declare v variants; s assignments; c campaigns; price bigint; starts timestamptz := now(); ends timestamptz; pay payments; lic licenses; ccur text; share bigint; approved boolean; tier_days int;
begin
  select * into v from variants where id = p_variant_id for update;
  select s2.* into s from assignments s2 join takes t on t.assignment_id = s2.id where t.id = v.take_id;
  if v.id is null or s.id is null or not (is_trusted() or (is_demo() and can_manage_campaign(s.campaign_id))) then perform fail('Variant not found'); end if;
  if p_type not in ('extra', 'renewal', 'buyout', 'whitelist') then perform fail('Invalid license type'); end if;
  if not v.visible_to_brand or v.status not in ('delivered', 'licensed') then perform fail('Variant is not available to license'); end if;
  if p_type = 'extra' and v.status = 'licensed' then perform fail('Variant is already licensed'); end if;
  if p_type <> 'extra' and v.status <> 'licensed' then perform fail('License this variant first'); end if;
  select * into c from campaigns where id = s.campaign_id;
  price := (c.fee_per_creator_minor * license_bps(p_type)) / 10000;
  if p_type = 'renewal' then
    select greatest(max(ends_at), now()) into starts from licenses where variant_id = v.id and type in ('base', 'extra', 'renewal');
    if exists (select 1 from licenses where variant_id = v.id and type = 'buyout') then perform fail('This variant is already bought out'); end if;
  end if;
  ends := case when p_type = 'buyout' then null else starts + make_interval(days => license_term_days()) end;
  insert into payments (brand_id, campaign_id, kind, provider, provider_ref, gross_minor, amount_minor, currency, status, settled_at, metadata)
  values (c.brand_id, c.id, 'license', p_provider, coalesce(p_provider_ref, 'mock_pi_' || substr(gen_random_uuid()::text, 1, 12)), price, price, c.currency, 'released', now(), jsonb_build_object('type', p_type, 'variant_id', v.id))
  returning * into pay;
  insert into licenses (variant_id, brand_id, campaign_id, type, starts_at, ends_at, price_minor, currency, payment_id)
  values (v.id, c.brand_id, c.id, p_type, starts, ends, price, c.currency, pay.id) returning * into lic;
  update variants set status = 'licensed' where id = v.id;
  if p_type = 'extra' then perform record_win(s.creator_id, 1); end if;
  select currency into ccur from profiles where id = s.creator_id;
  share := convert_minor(creator_share(price), c.currency, ccur);
  approved := s.approved_at is not null;
  select case when is_pro(s.creator_id) then 3 else 14 end into tier_days;
  -- license payments settle immediately, so they clear as soon as the submission is approved
  insert into ledger_entries (creator_id, source, amount_minor, currency, state, cleared_at, available_at, campaign_id, assignment_id, license_id, payment_id, description)
  values (s.creator_id, 'license', share, ccur, case when approved then 'cleared' else 'pending' end, case when approved then now() end,
    case when approved then now() + make_interval(days => tier_days) end, c.id, s.id, lic.id, pay.id, initcap(p_type) || ' license · ' || c.title);
  if approved then perform bump_month(s.creator_id, 0, 0, 0, convert_minor(share, ccur, 'USD')); end if;
  perform notify(s.creator_id, 'license', 'New license payment', initcap(p_type) || ' license on ' || c.title, jsonb_build_object('assignment_id', s.id));
  return lic;
end $$;

create or replace function public.maybe_complete_campaign(p_campaign_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare c campaigns; approved int; open_ int; credit bigint; gross bigint;
begin
  select * into c from campaigns where id = p_campaign_id for update;
  if c.status <> 'in_progress' then return; end if;
  select count(*) filter (where approved_at is not null), count(*) filter (where approved_at is null) into approved, open_ from assignments where campaign_id = c.id;
  if approved < c.creators_needed or open_ > 0 then return; end if;
  update campaigns set status = 'completed', completed_at = now() where id = c.id;
  update payments set status = 'released', settled_at = now() where campaign_id = c.id and kind = 'campaign' and status = 'held' returning gross_minor into gross;
  -- Option B: first completed campaign → credit worth 25% of its value, valid 60 days
  if not exists (select 1 from campaigns where brand_id = c.brand_id and status = 'completed' and id <> c.id)
     and not exists (select 1 from credits where brand_id = c.brand_id and source_campaign_id is not null) then
    credit := (coalesce(gross, c.fee_per_creator_minor * c.creators_needed) * 2500) / 10000;
    insert into credits (brand_id, amount_minor, currency, expires_at, source_campaign_id) values (c.brand_id, credit, c.currency, now() + interval '60 days', c.id);
    update brands set credit_balance = credit_balance + credit where id = c.brand_id;
    perform notify_brand(c.brand_id, 'credit', 'You earned campaign credit', 'Valid for 60 days against the platform fee on your next campaign.', jsonb_build_object('campaign_id', c.id, 'amount_minor', credit, 'currency', c.currency));
  end if;
end $$;
revoke execute on function public.maybe_complete_campaign(uuid) from public, anon, authenticated;

create or replace function public.approve_assignment_internal(p_assignment_id uuid, p_rating int, p_comment text, p_auto boolean) returns void
language plpgsql security definer set search_path = public as $$
declare s assignments; tier_days int; earned bigint;
begin
  select * into s from assignments where id = p_assignment_id for update;
  if s.id is null then perform fail('Assignment not found'); end if;
  if s.status <> 'delivered' then perform fail('Nothing to approve yet'); end if;
  update assignments set status = 'approved', approved_at = now(), auto_approved = p_auto where id = s.id;
  select case when is_pro(s.creator_id) then 3 else 14 end into tier_days;
  -- pending → cleared: the escrow payment is settled (held) AND the submission is now approved
  with moved as (
    update ledger_entries set state = 'cleared', cleared_at = now(), available_at = now() + make_interval(days => tier_days)
    where assignment_id = s.id and state = 'pending' returning convert_minor(amount_minor, currency, 'USD') as usd
  ) select coalesce(sum(usd), 0) into earned from moved;
  update creators set campaigns_completed = campaigns_completed + 1 where profile_id = s.creator_id;
  perform bump_month(s.creator_id, 0, 0, 1, earned);
  if p_rating between 1 and 5 then
    insert into reviews (assignment_id, rating, comment) values (s.id, p_rating, p_comment) on conflict (assignment_id) do nothing;
    update creators set rating_avg = round(((coalesce(rating_avg, 0) * rating_count) + p_rating) / (rating_count + 1), 2), rating_count = rating_count + 1 where profile_id = s.creator_id;
  end if;
  perform notify(s.creator_id, 'approved', case when p_auto then 'Auto-approved after 5 days' else 'Submission approved' end, 'Your earnings have cleared and will be available after your payout delay.', jsonb_build_object('assignment_id', s.id));
  perform maybe_complete_campaign(s.campaign_id);
end $$;

revoke execute on function public.approve_assignment_internal(uuid, int, text, boolean) from public, anon, authenticated;

create or replace function public.approve_assignment(p_assignment_id uuid, p_rating int default null, p_comment text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from assignments where id = p_assignment_id and can_manage_campaign(campaign_id)) then perform fail('Assignment not found'); end if;
  perform approve_assignment_internal(p_assignment_id, p_rating, p_comment, false);
end $$;

create or replace function public.choose_winner(p_assignment_id uuid, p_variant_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare s assignments;
begin
  select * into s from assignments where id = p_assignment_id for update;
  if s.id is null or not can_manage_campaign(s.campaign_id) then perform fail('Assignment not found'); end if;
  if not exists (select 1 from variants v join takes t on t.id = v.take_id where v.id = p_variant_id and t.assignment_id = s.id and v.status = 'licensed') then perform fail('Pick one of your licensed variants'); end if;
  update assignments set winning_variant_id = p_variant_id where id = s.id;
  perform notify(s.creator_id, 'winner', 'Post your winning ad', 'The brand picked the variant for your feed. Post it and share the link.', jsonb_build_object('assignment_id', s.id, 'variant_id', p_variant_id));
end $$;

create or replace function public.submit_post_link(p_assignment_id uuid, p_url text) returns void
language plpgsql security definer set search_path = public as $$
declare s assignments;
begin
  if p_url !~* '^https://[^\s]+\.[^\s]+$' then perform fail('Enter the full https:// link to your post'); end if;
  update assignments set post_url = p_url, posted_at = now(), status = case when status = 'approved' then 'completed' else status end
  where id = p_assignment_id and creator_id = uid_required() and winning_variant_id is not null returning * into s;
  if s.id is null then perform fail('No winning variant chosen yet'); end if;
  perform notify_brand((select brand_id from campaigns where id = s.campaign_id), 'posted', 'Creator posted the winning ad', p_url, jsonb_build_object('assignment_id', s.id));
end $$;

create or replace function public.open_dispute(p_assignment_id uuid, p_reason text) returns uuid
language plpgsql security definer set search_path = public as $$
declare did uuid;
begin
  if not (owns_assignment(p_assignment_id) or can_manage_assignment(p_assignment_id)) then perform fail('Assignment not found'); end if;
  insert into disputes (assignment_id, opened_by, reason) values (p_assignment_id, uid_required(), p_reason) returning id into did;
  update assignments set status = 'disputed' where id = p_assignment_id and status = 'delivered';
  return did;
end $$;

-- ───────────────────────── withdrawals ─────────────────────────
create or replace function public.request_withdrawal(p_method text, p_destination jsonb, p_amount_minor bigint) returns withdrawals
language plpgsql security definer set search_path = public as $$
declare me uuid := uid_required(); cr creators; p profiles; avail bigint; w withdrawals; e record; remaining bigint := p_amount_minor;
begin
  select * into cr from creators where profile_id = me for update;
  select * into p from profiles where id = me;
  if cr.kyc_status <> 'verified' then perform fail('KYC_REQUIRED'); end if;
  if not (p_method in ('paypal', 'wise', 'payoneer') or (p.country = 'IN' and p_method in ('upi', 'bank_in')) or (p.country = 'AE' and p_method = 'bank_iban')) then
    perform fail('This payout method is not available in your country');
  end if;
  if p_amount_minor is null or p_amount_minor <= 0 then perform fail('Enter a valid amount'); end if;
  select coalesce(sum(amount_minor), 0) into avail from ledger_entries where creator_id = me and state = 'available';
  if p_amount_minor > avail then perform fail('Amount exceeds your available balance'); end if;
  -- demo: the mock payout provider pays instantly; with a real provider this starts as 'requested'
  insert into withdrawals (creator_id, method, destination, amount_minor, currency, status, provider_ref)
  values (me, p_method, p_destination, p_amount_minor, p.currency, case when is_demo() then 'paid' else 'requested' end, case when is_demo() then 'mock_po_' || substr(gen_random_uuid()::text, 1, 10) end)
  returning * into w;
  for e in select * from ledger_entries where creator_id = me and state = 'available' order by available_at, created_at for update loop
    exit when remaining = 0;
    if e.amount_minor <= remaining then
      update ledger_entries set state = 'withdrawn', withdrawal_id = w.id where id = e.id;
      remaining := remaining - e.amount_minor;
    else
      update ledger_entries set amount_minor = amount_minor - remaining where id = e.id;
      insert into ledger_entries (creator_id, source, amount_minor, currency, state, available_at, cleared_at, campaign_id, assignment_id, license_id, payment_id, withdrawal_id, description)
      values (me, e.source, remaining, e.currency, 'withdrawn', e.available_at, e.cleared_at, e.campaign_id, e.assignment_id, e.license_id, e.payment_id, w.id, e.description);
      remaining := 0;
    end if;
  end loop;
  return w;
end $$;

-- ───────────────────────── admin ─────────────────────────
create or replace function public.admin_verify_social(p_social_id uuid, p_verification text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then perform fail('Admins only'); end if;
  update social_accounts set verification = p_verification, ownership_verified_at = case when p_verification = 'self_reported' then null else now() end where id = p_social_id;
  perform audit('social.verify', 'social_account', p_social_id::text, jsonb_build_object('verification', p_verification));
end $$;

create or replace function public.admin_resolve_dispute(p_dispute_id uuid, p_status text, p_resolution text) returns void
language plpgsql security definer set search_path = public as $$
declare d disputes; s assignments;
begin
  if not is_admin() then perform fail('Admins only'); end if;
  update disputes set status = p_status, resolution = p_resolution, resolved_at = now() where id = p_dispute_id and status = 'open' returning * into d;
  if d.id is null then perform fail('Dispute not open'); end if;
  select * into s from assignments where id = d.assignment_id;
  if p_status = 'resolved_creator' then
    update assignments set status = 'delivered' where id = s.id and status = 'disputed';
    perform approve_assignment_internal(s.id, null, null, false);
  elsif p_status = 'refunded' then
    -- mock refund of this creator's slot: the pending earning is removed and a refund row is recorded
    delete from ledger_entries where assignment_id = s.id and state = 'pending';
    insert into payments (brand_id, campaign_id, kind, provider, gross_minor, amount_minor, currency, status, metadata)
    select c.brand_id, c.id, 'campaign', 'mock', c.fee_per_creator_minor, c.fee_per_creator_minor, c.currency, 'refunded', jsonb_build_object('dispute_id', d.id) from campaigns c where c.id = s.campaign_id;
  end if;
  perform audit('dispute.resolve', 'dispute', d.id::text, jsonb_build_object('status', p_status));
end $$;

create or replace function public.admin_issue_credit(p_brand_id uuid, p_amount_minor bigint, p_days int default 60) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then perform fail('Admins only'); end if;
  insert into credits (brand_id, amount_minor, currency, expires_at) select id, p_amount_minor, currency, now() + make_interval(days => p_days) from brands where id = p_brand_id;
  update brands set credit_balance = credit_balance + p_amount_minor where id = p_brand_id;
  perform audit('credit.issue', 'brand', p_brand_id::text, jsonb_build_object('amount_minor', p_amount_minor));
end $$;

-- ───────────────────────── Pro guarantee ─────────────────────────
create or replace function public.refresh_guarantee(p_creator uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare cr creators; p profiles; g guarantee_tracking; ws timestamptz; socials int; apps int; accepted int; ontime int; inv int; inv_ok int; landed int; crit jsonb; ok boolean;
begin
  select * into cr from creators where profile_id = p_creator;
  select * into p from profiles where id = p_creator;
  insert into guarantee_tracking (creator_id) values (p_creator) on conflict (creator_id) do nothing;
  select * into g from guarantee_tracking where creator_id = p_creator;
  ws := greatest(g.window_start, now() - interval '60 days');
  select count(*) into socials from social_accounts where creator_id = p_creator;
  select count(*) into apps from applications a join campaigns c on c.id = a.campaign_id
    where a.creator_id = p_creator and not a.invited and a.created_at >= ws and p.country = any (c.countries) and c.categories && cr.categories;
  select count(*), count(*) filter (where submitted_at is not null and submitted_at <= due_at or (submitted_at is null and due_at > now())) into accepted, ontime
    from assignments where creator_id = p_creator and created_at >= ws;
  select count(*), count(*) filter (where responded_at is not null and responded_at <= invited_at + interval '48 hours' or (responded_at is null and invited_at > now() - interval '48 hours')) into inv, inv_ok
    from applications where creator_id = p_creator and invited and invited_at >= ws;
  landed := accepted;
  crit := jsonb_build_array(
    jsonb_build_object('key', 'profile', 'label', 'Complete profile', 'met', p.onboarded and length(coalesce(cr.bio, '')) > 0 and array_length(cr.categories, 1) > 0),
    jsonb_build_object('key', 'socials', 'label', 'At least 2 linked social accounts', 'met', socials >= 2, 'current', least(socials, 2), 'target', 2),
    jsonb_build_object('key', 'applications', 'label', 'Applied to 15 matching campaigns', 'met', apps >= 15, 'current', least(apps, 15), 'target', 15),
    jsonb_build_object('key', 'on_time', 'label', 'On-time submission for every accepted campaign', 'met', ontime >= accepted),
    jsonb_build_object('key', 'rating', 'label', 'Rating 4.0 or higher', 'met', cr.rating_avg is null or cr.rating_avg >= 4.0),
    jsonb_build_object('key', 'invites', 'label', 'Responded to invites within 48h', 'met', inv_ok >= inv),
    jsonb_build_object('key', 'single_account', 'label', 'One account per person', 'met', not cr.flagged));
  if p.country = 'AE' then
    crit := crit || jsonb_build_object('key', 'uae_permit', 'label', 'UAE Advertiser Permit number on file', 'met', length(coalesce(cr.uae_permit_number, '')) > 0);
  end if;
  select bool_and((x ->> 'met')::boolean) into ok from jsonb_array_elements(crit) x;
  update guarantee_tracking set criteria = crit, eligible = ok and landed = 0, updated_at = now() where creator_id = p_creator;
  -- window elapsed with every rule met and nothing landed → a free Pro month, repeated until a paid campaign lands
  if ok and landed = 0 and is_pro(p_creator) and g.window_start <= now() - interval '60 days'
     and coalesce(cr.pro_free_until, g.window_start + interval '60 days') <= now() then
    update creators set pro_free_until = now() + interval '1 month' where profile_id = p_creator;
    update guarantee_tracking set free_months_issued = free_months_issued + 1 where creator_id = p_creator;
    perform notify(p_creator, 'guarantee', 'Free Pro month added', 'You met every guarantee rule and no paid campaign landed, so this month is on us.');
  end if;
  return crit;
end $$;
revoke execute on function public.refresh_guarantee(uuid) from public, anon, authenticated;
create or replace function public.my_guarantee() returns jsonb language sql security definer set search_path = public as $$
  select jsonb_build_object('criteria', refresh_guarantee(uid_required()), 'tracking', (select to_jsonb(g) from guarantee_tracking g where g.creator_id = auth.uid()));
$$;

-- ───────────────────────── scheduled jobs ─────────────────────────
-- Run by pg_cron, the worker's tick, or an admin from the console.
create or replace function public.run_scheduled_jobs() returns jsonb
language plpgsql security definer set search_path = public as $$
declare r record; auto_n int := 0; avail_n int; remind_n int := 0; g_n int := 0;
begin
  if not (is_worker() or is_admin()) then perform fail('Not allowed'); end if;
  -- escrow auto-approve: 5 days after delivery with no brand response
  for r in select id from assignments where status = 'delivered' and delivered_at < now() - interval '5 days' loop
    perform approve_assignment_internal(r.id, null, null, true); auto_n := auto_n + 1;
  end loop;
  -- cleared → available after the tier delay
  update ledger_entries set state = 'available' where state = 'cleared' and available_at <= now();
  get diagnostics avail_n = row_count;
  -- renewal reminders 7 days before expiry
  for r in select l.id, l.brand_id, l.campaign_id, l.ends_at from licenses l where l.ends_at between now() and now() + interval '7 days' and l.reminder_sent_at is null
      and not exists (select 1 from licenses n where n.variant_id = l.variant_id and (n.ends_at is null or n.ends_at > l.ends_at)) loop
    perform notify_brand(r.brand_id, 'renewal', 'A license expires soon', 'Renew in one click to keep running the ad.', jsonb_build_object('license_id', r.id, 'campaign_id', r.campaign_id, 'ends_at', r.ends_at));
    update licenses set reminder_sent_at = now() where id = r.id; remind_n := remind_n + 1;
  end loop;
  update brands b set credit_balance = coalesce((select sum(amount_minor - used_minor) from credits c where c.brand_id = b.id and c.expires_at > now()), 0);
  for r in select profile_id from creators where tier = 'pro' and not is_founding loop perform refresh_guarantee(r.profile_id); g_n := g_n + 1; end loop;
  perform refresh_leaderboards();
  return jsonb_build_object('auto_approved', auto_n, 'made_available', avail_n, 'renewal_reminders', remind_n, 'guarantees_checked', g_n);
end $$;

-- ───────────────────────── worker API (least privilege: no table grants, only these) ─────────────────────────
create or replace function public.worker_claim_job() returns jsonb
language plpgsql security definer set search_path = public as $$
declare j jobs; ctx jsonb := '{}'; t takes; s assignments; c campaigns;
begin
  if not is_worker() then perform fail('Workers only'); end if;
  select * into j from claim_job(array['process_take', 'product_check', 'verify_metrics']) limit 1;
  if j.id is null then return null; end if;
  if j.type in ('process_take', 'product_check') then
    select * into t from takes where id = (j.payload ->> 'take_id')::uuid;
    select * into s from assignments where id = t.assignment_id;
    select * into c from campaigns where id = s.campaign_id;
    ctx := jsonb_build_object('take', to_jsonb(t), 'assignment_id', s.id, 'creator_id', s.creator_id, 'is_pro', is_pro(s.creator_id),
      'campaign', jsonb_build_object('id', c.id, 'title', c.title, 'product_name', c.product_name, 'product_images', c.product_images, 'brief', c.brief),
      'likeness', (select jsonb_build_object('voice_provider_id', l.voice_provider_id) from likeness_profiles l where l.creator_id = s.creator_id and l.status = 'ready'
         and exists (select 1 from likeness_consents lc where lc.creator_id = s.creator_id and lc.campaign_id = c.id and lc.revoked_at is null)));
  elsif j.type = 'verify_metrics' then
    ctx := jsonb_build_object('social', (select to_jsonb(sa) from social_accounts sa where sa.id = (j.payload ->> 'social_id')::uuid));
  end if;
  return jsonb_build_object('job', to_jsonb(j), 'context', ctx);
end $$;

create or replace function public.worker_update_job(p_job_id uuid, p_status text, p_progress int default null, p_error text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_worker() then perform fail('Workers only'); end if;
  update jobs set status = p_status, progress = coalesce(p_progress, progress), error = p_error, locked_at = now(),
    finished_at = case when p_status in ('done', 'failed') then now() end where id = p_job_id;
end $$;

create or replace function public.worker_update_take(p_take_id uuid, p_patch jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_worker() then perform fail('Workers only'); end if;
  update takes set transcript = coalesce(p_patch -> 'transcript', transcript), duration = coalesce((p_patch ->> 'duration')::numeric, duration),
    product_check = coalesce(p_patch ->> 'product_check', product_check), product_check_reason = coalesce(p_patch ->> 'product_check_reason', product_check_reason)
  where id = p_take_id;
end $$;

create or replace function public.worker_upsert_variant(p_take_id uuid, p_format text, p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare vid uuid;
begin
  if not is_worker() then perform fail('Workers only'); end if;
  insert into variants (take_id, format, storage_path, renditions, preview_renditions, thumbnail, hook_text, hook_options, score, score_reason, is_synthetic, ai_disclosure, language, status)
  values (p_take_id, p_format, p ->> 'storage_path', coalesce(p -> 'renditions', '{}'), coalesce(p -> 'preview_renditions', '{}'), p ->> 'thumbnail', p ->> 'hook_text',
    coalesce(array(select jsonb_array_elements_text(p -> 'hook_options')), '{}'), (p ->> 'score')::int, p ->> 'score_reason', coalesce((p ->> 'is_synthetic')::boolean, false),
    p ->> 'ai_disclosure', p ->> 'language', coalesce(p ->> 'status', 'ready'))
  on conflict (take_id, format) do update set storage_path = excluded.storage_path, renditions = excluded.renditions, preview_renditions = excluded.preview_renditions,
    thumbnail = excluded.thumbnail, hook_text = excluded.hook_text, hook_options = excluded.hook_options, score = excluded.score, score_reason = excluded.score_reason,
    is_synthetic = excluded.is_synthetic, ai_disclosure = excluded.ai_disclosure, language = excluded.language, status = excluded.status
  where variants.status in ('processing', 'ready', 'failed', 'coming_soon', 'qa_rejected')
  returning id into vid;
  return vid;
end $$;

create or replace function public.worker_finish_take(p_take_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare s assignments;
begin
  if not is_worker() then perform fail('Workers only'); end if;
  select a.* into s from assignments a join takes t on t.assignment_id = a.id where t.id = p_take_id;
  update assignments set status = 'variants_ready' where id = s.id and status = 'processing';
  perform notify(s.creator_id, 'variants_ready', 'Your variants are ready', 'Review them in Studio and choose what the brand sees.', jsonb_build_object('assignment_id', s.id));
end $$;

create or replace function public.worker_set_metrics(p_social_id uuid, p_public jsonb, p_score int, p_flags text[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_worker() then perform fail('Workers only'); end if;
  update social_accounts set public_metrics = p_public, plausibility_score = p_score, flags = p_flags where id = p_social_id;
end $$;

-- claimed metrics changed → queue the public cross-check
create or replace function public.enqueue_metrics_check() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or (new.followers, new.avg_views, new.engagement_rate, new.handle) is distinct from (old.followers, old.avg_views, old.engagement_rate, old.handle) then
    insert into jobs (type, payload) values ('verify_metrics', jsonb_build_object('social_id', new.id));
  end if;
  return new;
end $$;
create trigger social_metrics_check after insert or update on public.social_accounts for each row execute function public.enqueue_metrics_check();

-- ───────────────────────── storage access for variants + worker ─────────────────────────
-- Object names in the `variants` bucket: {take_id}/{format}/{clean|preview}_{aspect}.mp4 or thumb.jpg
create or replace function public.can_read_variant_object(obj text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare parts text[] := string_to_array(obj, '/'); tid uuid; v variants;
begin
  if array_length(parts, 1) <> 3 then return false; end if;
  begin tid := parts[1]::uuid; exception when others then return false; end;
  if is_admin() or is_worker() or owns_take(tid) then return true; end if;
  select * into v from variants where take_id = tid and format = parts[2];
  if v.id is null or not v.visible_to_brand or v.status not in ('delivered', 'licensed') or not can_manage_take(tid) then return false; end if;
  if parts[3] not like 'clean\_%' then return true; end if; -- watermarked previews and thumbnails
  return v.status = 'licensed' and exists (select 1 from licenses l where l.variant_id = v.id and (l.ends_at is null or l.ends_at > now()));
end $$;

create policy "variant files by license" on storage.objects for select to authenticated using (bucket_id = 'variants' and public.can_read_variant_object(name));
create policy "worker reads takes" on storage.objects for select to authenticated using (bucket_id in ('takes', 'public-assets') and public.is_worker());
create policy "worker writes variants" on storage.objects for insert to authenticated with check (bucket_id in ('variants', 'public-assets', 'takes') and public.is_worker());
create policy "worker updates variants" on storage.objects for update to authenticated using (bucket_id in ('variants', 'public-assets', 'takes') and public.is_worker());
create policy "admins read review files" on storage.objects for select to authenticated using (bucket_id in ('takes', 'verification', 'kyc') and public.is_admin());

-- nothing here is callable without signing in; internal helpers are not callable by clients at all
do $$ declare f record; begin
  for f in select p.oid::regprocedure as sig, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e') loop
    execute format('revoke execute on function %s from public, anon', f.sig);
    if f.proname in ('notify', 'notify_brand', 'audit', 'bump_month', 'handle_new_user', 'enforce_application_rules', 'enqueue_take_jobs', 'enqueue_metrics_check') then
      execute format('revoke execute on function %s from authenticated', f.sig);
    end if;
  end loop;
end $$;
