-- 1. Creator Pro: fixed price per market (never an FX conversion). India ₹699, UAE AED 69, elsewhere USD 19.
insert into public.settings (key, value) values
  ('pro_prices', '{"IN":{"currency":"INR","minor":69900},"AE":{"currency":"AED","minor":6900},"default":{"currency":"USD","minor":1900}}'::jsonb)
on conflict (key) do nothing;

-- 2. A two or three character short name for the product tile shown when there is no photo ("SPF", "VC").
alter table public.campaigns add column product_short_name text check (product_short_name is null or char_length(product_short_name) between 1 and 3);

-- 3. Renewal reminders name the ad and the date, so several reminders never read the same.
create or replace function public.format_label(fmt text) returns text language sql immutable as $$
  select case fmt when 'hook_first' then 'Hook First' when 'testimonial_tight' then 'Tight Testimonial' when 'day_in_life' then 'Day in the Life'
    when 'silent_montage' then 'Silent Montage' when 'language_version' then 'Language Version' else initcap(replace(fmt, '_', ' ')) end;
$$;
-- Unchanged apart from the reminder text.
create or replace function public.run_scheduled_jobs() returns jsonb
language plpgsql security definer set search_path = public as $$
declare r record; auto_n int := 0; avail_n int; remind_n int := 0; g_n int := 0;
begin
  if not (is_worker() or is_admin()) then perform fail('Not allowed'); end if;
  for r in select id from assignments where status = 'delivered' and delivered_at < now() - interval '5 days' loop
    perform approve_assignment_internal(r.id, null, null, true); auto_n := auto_n + 1;
  end loop;
  update ledger_entries set state = 'available' where state = 'cleared' and available_at <= now();
  get diagnostics avail_n = row_count;
  for r in select l.id, l.brand_id, l.campaign_id, l.ends_at, format_label(v.format) || ' · ' || c.title as what from licenses l join variants v on v.id = l.variant_id join campaigns c on c.id = l.campaign_id where l.ends_at between now() and now() + interval '7 days' and l.reminder_sent_at is null
      and not exists (select 1 from licenses n where n.variant_id = l.variant_id and (n.ends_at is null or n.ends_at > l.ends_at)) loop
    perform notify_brand(r.brand_id, 'renewal', 'A licence ends soon', r.what || ' · ends ' || to_char(r.ends_at, 'FMDD Mon YYYY'), jsonb_build_object('license_id', r.id, 'campaign_id', r.campaign_id, 'ends_at', r.ends_at));
    update licenses set reminder_sent_at = now() where id = r.id; remind_n := remind_n + 1;
  end loop;
  update brands b set credit_balance = coalesce((select sum(amount_minor - used_minor) from credits c where c.brand_id = b.id and c.expires_at > now()), 0) where b.id is not null;
  for r in select profile_id from creators where tier = 'pro' and not is_founding loop perform refresh_guarantee(r.profile_id); g_n := g_n + 1; end loop;
  perform refresh_leaderboards();
  return jsonb_build_object('auto_approved', auto_n, 'made_available', avail_n, 'renewal_reminders', remind_n, 'guarantees_checked', g_n);
end $$;
revoke execute on function public.run_scheduled_jobs() from public, anon;
update public.notifications n set body = format_label(v.format) || ' · ' || c.title || ' · ends ' || to_char(l.ends_at, 'FMDD Mon YYYY')
  from public.licenses l join public.variants v on v.id = l.variant_id join public.campaigns c on c.id = l.campaign_id
  where n.type = 'renewal' and (n.data ->> 'license_id')::uuid = l.id;
