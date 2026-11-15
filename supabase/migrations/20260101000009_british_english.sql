-- Language standard: British English in everything users read. "licence" (noun), "license" (verb).
-- Only the reminder wording changes; the scheduler's behaviour and grants are identical to migration 7.
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
  for r in select l.id, l.brand_id, l.campaign_id, l.ends_at from licenses l where l.ends_at between now() and now() + interval '7 days' and l.reminder_sent_at is null
      and not exists (select 1 from licenses n where n.variant_id = l.variant_id and (n.ends_at is null or n.ends_at > l.ends_at)) loop
    perform notify_brand(r.brand_id, 'renewal', 'A licence ends soon', 'Renew in one click to keep running the ad.', jsonb_build_object('license_id', r.id, 'campaign_id', r.campaign_id, 'ends_at', r.ends_at));
    update licenses set reminder_sent_at = now() where id = r.id; remind_n := remind_n + 1;
  end loop;
  update brands b set credit_balance = coalesce((select sum(amount_minor - used_minor) from credits c where c.brand_id = b.id and c.expires_at > now()), 0) where b.id is not null;
  for r in select profile_id from creators where tier = 'pro' and not is_founding loop perform refresh_guarantee(r.profile_id); g_n := g_n + 1; end loop;
  perform refresh_leaderboards();
  return jsonb_build_object('auto_approved', auto_n, 'made_available', avail_n, 'renewal_reminders', remind_n, 'guarantees_checked', g_n);
end $$;
revoke execute on function public.run_scheduled_jobs() from public, anon;
update public.notifications set title = 'A licence ends soon' where title = 'A license expires soon';
update public.notifications set title = replace(title, 'license payment', 'licence payment') where title like '%license payment%';
