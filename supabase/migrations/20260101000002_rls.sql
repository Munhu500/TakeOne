-- Helper functions, triggers, RLS policies, column grants and brand-safe views.
-- Cross-table checks go through SECURITY DEFINER helpers so policies never recurse.

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.my_agency_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select agency_id from memberships where profile_id = auth.uid() and agency_id is not null;
$$;

-- brands I belong to directly, plus client brands of my agencies
create or replace function public.my_brand_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select brand_id from memberships where profile_id = auth.uid() and brand_id is not null
  union
  select b.id from brands b where b.agency_id in (select agency_id from memberships where profile_id = auth.uid() and agency_id is not null);
$$;

create or replace function public.is_pro(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from creators
    where profile_id = uid and (tier = 'pro' or is_founding or (pro_free_until is not null and pro_free_until > now()))
  );
$$;

create or replace function public.can_manage_campaign(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (select 1 from campaigns c where c.id = cid and c.brand_id in (select public.my_brand_ids()));
$$;

create or replace function public.creator_in_campaign(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from applications a where a.campaign_id = cid and a.creator_id = auth.uid())
      or exists (select 1 from assignments s where s.campaign_id = cid and s.creator_id = auth.uid());
$$;

create or replace function public.owns_assignment(aid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from assignments s where s.id = aid and s.creator_id = auth.uid());
$$;

create or replace function public.can_manage_assignment(aid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from assignments s where s.id = aid and public.can_manage_campaign(s.campaign_id));
$$;

create or replace function public.owns_take(tid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from takes t join assignments s on s.id = t.assignment_id where t.id = tid and s.creator_id = auth.uid());
$$;

create or replace function public.can_manage_take(tid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from takes t join assignments s on s.id = t.assignment_id where t.id = tid and public.can_manage_campaign(s.campaign_id));
$$;

-- applications this ISO week by a creator (invites don't count)
create or replace function public.applications_this_week(uid uuid) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from applications where creator_id = uid and not invited and created_at >= date_trunc('week', now());
$$;

-- ───────────────────────── triggers ─────────────────────────
-- New auth user → profile (+ creator row). Role comes from signup metadata; 'admin' can never be self-assigned.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  r text := coalesce(new.raw_user_meta_data ->> 'role', 'creator');
begin
  if r not in ('creator', 'brand_member', 'agency_member') then r := 'creator'; end if;
  insert into profiles (id, role, display_name)
  values (new.id, r, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(coalesce(new.email, ''), '@', 1)))
  on conflict (id) do nothing;
  if r = 'creator' then
    insert into creators (profile_id) values (new.id) on conflict do nothing;
  end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Free tier: 3 applications per week. Also blocks applying to campaigns that aren't open to this creator.
create or replace function public.enforce_application_rules() returns trigger
language plpgsql security definer set search_path = public as $$
declare c campaigns%rowtype;
begin
  if auth.uid() is null then return new; end if; -- service role
  new.status := 'applied'; new.invited := false; new.invited_at := null; new.responded_at := null;
  select * into c from campaigns where id = new.campaign_id;
  if c.status <> 'live' then raise exception 'This campaign is not open for applications' using errcode = 'P0001'; end if;
  if c.early_access_until is not null and c.early_access_until > now() and not is_pro(new.creator_id) then
    raise exception 'This campaign is in Pro early access' using errcode = 'P0001';
  end if;
  if not is_pro(new.creator_id) and applications_this_week(new.creator_id) >= 3 then
    raise exception 'Weekly application limit reached. Upgrade to Pro for unlimited applications.' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger applications_rules before insert on public.applications for each row execute function public.enforce_application_rules();

-- Uploading a take queues the worker jobs.
create or replace function public.enqueue_take_jobs() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into jobs (type, payload) values ('product_check', jsonb_build_object('take_id', new.id));
  insert into jobs (type, payload) values ('process_take', jsonb_build_object('take_id', new.id));
  update assignments set status = 'processing' where id = new.assignment_id and status in ('accepted', 'variants_ready');
  return new;
end $$;
create trigger takes_enqueue after insert on public.takes for each row execute function public.enqueue_take_jobs();

-- Worker claims the next job atomically.
create or replace function public.claim_job(job_types text[]) returns setof public.jobs
language plpgsql security definer set search_path = public as $$
begin
  return query
  update jobs set status = 'running', attempts = attempts + 1, locked_at = now()
  where id = (
    select id from jobs
    where type = any (job_types) and (status = 'queued' or (status = 'running' and locked_at < now() - interval '15 minutes' and attempts < 3))
    order by created_at limit 1 for update skip locked
  )
  returning *;
end $$;
revoke execute on function public.claim_job(text[]) from public, anon, authenticated;

-- ───────────────────────── RLS ─────────────────────────
do $$ declare t text; begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- profiles: no contact details live here (email stays in auth.users), so signed-in users can read names/avatars.
create policy profiles_read on profiles for select to authenticated using (true);
create policy profiles_update_self on profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_admin on profiles for all to authenticated using (is_admin()) with check (is_admin());
revoke update on profiles from authenticated, anon;
grant update (display_name, country, currency, locale, avatar, onboarded) on profiles to authenticated;

-- creators: private row (tax id, KYC, permit). Brands read the creator_public view instead.
create policy creators_self on creators for select to authenticated using (profile_id = auth.uid() or is_admin());
create policy creators_update_self on creators for update to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy creators_admin on creators for all to authenticated using (is_admin()) with check (is_admin());
revoke insert, update, delete on creators from authenticated, anon;
grant update (bio, categories, uae_permit_number, show_exact_earnings) on creators to authenticated;

create policy social_self_read on social_accounts for select to authenticated using (creator_id = auth.uid() or is_admin());
create policy social_self_insert on social_accounts for insert to authenticated with check (creator_id = auth.uid());
create policy social_self_update on social_accounts for update to authenticated using (creator_id = auth.uid()) with check (creator_id = auth.uid());
create policy social_self_delete on social_accounts for delete to authenticated using (creator_id = auth.uid());
create policy social_admin on social_accounts for all to authenticated using (is_admin()) with check (is_admin());
revoke insert, update on social_accounts from authenticated, anon;
grant insert (creator_id, platform, handle, followers, avg_views, engagement_rate) on social_accounts to authenticated;
grant update (handle, followers, avg_views, engagement_rate, ownership_requested_at, screen_recording_path, screen_recording_code) on social_accounts to authenticated;

create policy likeness_self on likeness_profiles for select to authenticated using (creator_id = auth.uid() or is_admin());
create policy consents_self_read on likeness_consents for select to authenticated using (creator_id = auth.uid() or is_admin() or can_manage_campaign(campaign_id));
create policy consents_self_insert on likeness_consents for insert to authenticated with check (creator_id = auth.uid());
create policy consents_self_update on likeness_consents for update to authenticated using (creator_id = auth.uid()) with check (creator_id = auth.uid());

-- brands / agencies / memberships
create policy brands_read on brands for select to authenticated using (true);
create policy brands_manage on brands for update to authenticated using (id in (select my_brand_ids()) or is_admin()) with check (id in (select my_brand_ids()) or is_admin());
revoke insert, update, delete on brands from authenticated, anon;
grant update (name, logo, country, currency, markup_bps) on brands to authenticated;
create policy agencies_read on agencies for select to anon, authenticated using (true);
create policy agencies_manage on agencies for update to authenticated using (id in (select my_agency_ids()) or is_admin()) with check (id in (select my_agency_ids()) or is_admin());
revoke insert, delete on agencies from authenticated, anon;
create policy memberships_read on memberships for select to authenticated
  using (profile_id = auth.uid() or is_admin() or brand_id in (select my_brand_ids()) or agency_id in (select my_agency_ids()));

-- campaigns: brand side manages; creators see open campaigns (early access = Pro only) and ones they're part of
create policy campaigns_manage on campaigns for all to authenticated using (can_manage_campaign(id)) with check (brand_id in (select my_brand_ids()) or is_admin());
create policy campaigns_creator_read on campaigns for select to authenticated using (
  (status in ('live', 'in_progress', 'completed') and (early_access_until is null or early_access_until <= now() or is_pro(auth.uid())))
  or creator_in_campaign(id)
);
-- status/payment fields only move through the server
revoke insert, update on campaigns from authenticated, anon;
grant insert (brand_id, agency_id, title, product_name, product_url, product_images, brief, shot_list, categories, countries, creators_needed, fee_per_creator_minor, currency, deadline) on campaigns to authenticated;
grant update (title, product_name, product_url, product_images, brief, shot_list, categories, countries, creators_needed, fee_per_creator_minor, deadline) on campaigns to authenticated;

create policy applications_creator_read on applications for select to authenticated using (creator_id = auth.uid() or can_manage_campaign(campaign_id));
create policy applications_creator_insert on applications for insert to authenticated with check (creator_id = auth.uid());
revoke insert, update, delete on applications from authenticated, anon;
grant insert (campaign_id, creator_id, pitch) on applications to authenticated;

create policy assignments_read on assignments for select to authenticated using (creator_id = auth.uid() or can_manage_campaign(campaign_id));
revoke insert, update, delete on assignments from authenticated, anon;

create policy takes_creator on takes for select to authenticated using (owns_assignment(assignment_id) or is_admin());
create policy takes_creator_insert on takes for insert to authenticated with check (owns_assignment(assignment_id));
revoke insert, update, delete on takes from authenticated, anon;
grant insert (assignment_id, storage_path, duration, dub_language) on takes to authenticated;

-- jobs: creators can watch progress of their own take's jobs; nothing else
create policy jobs_creator_read on jobs for select to authenticated using (is_admin() or owns_take((payload ->> 'take_id')::uuid));
revoke insert, update, delete on jobs from authenticated, anon;

-- variants: creator sees all of theirs; brand only sees what was delivered to them
create policy variants_creator on variants for select to authenticated using (owns_take(take_id) or is_admin());
create policy variants_brand on variants for select to authenticated using (visible_to_brand and status in ('delivered', 'selected', 'licensed') and can_manage_take(take_id));
revoke insert, update, delete on variants from authenticated, anon;

-- money: read-only for the owner; all writes go through the server (service role)
create policy payments_read on payments for select to authenticated using (brand_id in (select my_brand_ids()) or is_admin());
create policy licenses_read on licenses for select to authenticated using (brand_id in (select my_brand_ids()) or is_admin() or owns_take((select take_id from variants v where v.id = variant_id)));
create policy ledger_read on ledger_entries for select to authenticated using (creator_id = auth.uid() or is_admin());
create policy withdrawals_read on withdrawals for select to authenticated using (creator_id = auth.uid() or is_admin());
create policy credits_read on credits for select to authenticated using (brand_id in (select my_brand_ids()) or is_admin());
create policy subscriptions_read on subscriptions for select to authenticated using (creator_id = auth.uid() or is_admin());
create policy guarantee_read on guarantee_tracking for select to authenticated using (creator_id = auth.uid() or is_admin());
create policy monthly_stats_read on creator_monthly_stats for select to authenticated using (creator_id = auth.uid() or is_admin());
revoke insert, update, delete on payments, licenses, ledger_entries, withdrawals, credits, subscriptions, guarantee_tracking, creator_monthly_stats from authenticated, anon;

-- messages: both sides of the thread read; inserts go through the API so masking can't be skipped
create policy messages_read on messages for select to authenticated using (creator_id = auth.uid() or can_manage_campaign(campaign_id));
revoke insert, update, delete on messages from authenticated, anon;
create policy masking_admin on masking_attempts for select to authenticated using (is_admin());
revoke insert, update, delete on masking_attempts from authenticated, anon;

create policy reviews_read on reviews for select to authenticated using (owns_assignment(assignment_id) or can_manage_assignment(assignment_id));
revoke insert, update, delete on reviews from authenticated, anon;

create policy notifications_read on notifications for select to authenticated using (profile_id = auth.uid());
create policy notifications_update on notifications for update to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());
revoke insert, update, delete on notifications from authenticated, anon;
grant update (read_at) on notifications to authenticated;

create policy disputes_read on disputes for select to authenticated using (opened_by = auth.uid() or is_admin() or can_manage_assignment(assignment_id) or owns_assignment(assignment_id));
revoke insert, update, delete on disputes from authenticated, anon;

create policy fx_read on fx_rates for select to anon, authenticated using (true);
create policy fx_admin on fx_rates for all to authenticated using (is_admin()) with check (is_admin());
create policy terms_read on terms_acceptances for select to authenticated using (profile_id = auth.uid() or is_admin());
create policy terms_insert on terms_acceptances for insert to authenticated with check (profile_id = auth.uid());
revoke update, delete on terms_acceptances from authenticated, anon;
create policy settings_read on settings for select to anon, authenticated using (true);
create policy settings_admin on settings for all to authenticated using (is_admin()) with check (is_admin());
create policy audit_admin on audit_log for select to authenticated using (is_admin());
revoke insert, update, delete on audit_log from authenticated, anon;

-- ───────────────────────── brand-safe views ─────────────────────────
-- Views run as their owner on purpose: they expose only the columns brands/agencies may see.
create view public.creator_public as
  select c.profile_id, p.display_name, p.avatar, p.country, c.bio, c.categories,
         (c.tier = 'pro' or c.is_founding or coalesce(c.pro_free_until > now(), false)) as is_pro,
         c.is_founding, c.rating_avg, c.rating_count, c.win_rate, c.wins_count, c.submissions_count, c.campaigns_completed,
         c.created_at as joined_at,
         exists (select 1 from likeness_profiles l where l.creator_id = c.profile_id and l.status = 'ready') as has_likeness
  from creators c join profiles p on p.id = c.profile_id;

create view public.social_accounts_public as
  select id, creator_id, platform, handle, followers, avg_views, engagement_rate, verification from social_accounts;

revoke all on public.creator_public, public.social_accounts_public from anon;
grant select on public.creator_public, public.social_accounts_public to authenticated, service_role;

-- ───────────────────────── leaderboards ─────────────────────────
-- Earnings leave the database as a band floor unless the creator opted in to exact figures.
create or replace function public.earnings_band_floor(usd_minor bigint) returns bigint
language sql immutable as $$
  select case
    when usd_minor >= 2500000 then 2500000 when usd_minor >= 1000000 then 1000000 when usd_minor >= 500000 then 500000
    when usd_minor >= 250000 then 250000 when usd_minor >= 100000 then 100000 when usd_minor >= 50000 then 50000
    when usd_minor >= 10000 then 10000 else 0 end;
$$;

create materialized view public.leaderboard_creators as
  select c.profile_id as creator_id, p.display_name, p.avatar, p.country, c.categories, c.created_at as joined_at,
         (c.tier = 'pro' or c.is_founding) as is_pro,
         c.wins_count as wins, c.submissions_count as submissions, c.campaigns_completed, c.rating_avg, c.rating_count,
         coalesce(m.wins, 0) as month_wins, coalesce(m.submissions, 0) as month_submissions, coalesce(m.completed, 0) as month_completed,
         c.show_exact_earnings as earnings_exact,
         case when c.show_exact_earnings then coalesce(m.earnings_usd_minor, 0) else earnings_band_floor(coalesce(m.earnings_usd_minor, 0)) end as month_earnings_usd_minor,
         case when c.show_exact_earnings then coalesce(t.total, 0) else earnings_band_floor(coalesce(t.total, 0)) end as total_earnings_usd_minor
  from creators c
  join profiles p on p.id = c.profile_id
  left join creator_monthly_stats m on m.creator_id = c.profile_id and m.month = date_trunc('month', now())::date
  left join (select creator_id, sum(earnings_usd_minor)::bigint as total from creator_monthly_stats group by 1) t on t.creator_id = c.profile_id
  where not c.flagged and p.onboarded;
create unique index on public.leaderboard_creators (creator_id);

create materialized view public.leaderboard_brands as
  select b.id as brand_id, b.name, b.logo, b.country,
         (select count(*) from campaigns c where c.brand_id = b.id and c.status in ('live', 'in_progress', 'completed'))::int as campaigns_run,
         (select avg(extract(epoch from (s.approved_at - s.delivered_at)) / 3600)::numeric(10,2)
            from assignments s join campaigns c on c.id = s.campaign_id
            where c.brand_id = b.id and s.approved_at is not null and s.delivered_at is not null) as avg_approval_hours,
         (select avg(extract(epoch from (pm.created_at - c.created_at)) / 3600)::numeric(10,2)
            from payments pm join campaigns c on c.id = pm.campaign_id
            where pm.brand_id = b.id and pm.kind = 'campaign' and pm.status in ('held', 'released')) as avg_payment_hours
  from brands b;
create unique index on public.leaderboard_brands (brand_id);

revoke all on public.leaderboard_creators, public.leaderboard_brands from anon;
grant select on public.leaderboard_creators, public.leaderboard_brands to authenticated, service_role;

-- Called by the scheduler (worker / cron / pg_cron).
create or replace function public.refresh_leaderboards() returns void
language plpgsql security definer set search_path = public as $$
begin
  refresh materialized view leaderboard_creators;
  refresh materialized view leaderboard_brands;
end $$;
revoke execute on function public.refresh_leaderboards() from public, anon, authenticated;
grant execute on function public.refresh_leaderboards() to service_role;
grant execute on function public.claim_job(text[]) to service_role;
