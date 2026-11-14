-- End-to-end money flow through the RPCs. Rolled back at the end.
begin;
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'c1@test.dev', '{"role":"creator","display_name":"C1"}'),
  ('00000000-0000-0000-0000-0000000000b1', 'b1@test.dev', '{"role":"brand_member","display_name":"B1"}'),
  ('00000000-0000-0000-0000-0000000000d1', 'adm@test.dev', '{"display_name":"Admin"}'),
  ('00000000-0000-0000-0000-0000000000e1', 'wrk@test.dev', '{"display_name":"Worker"}');
update profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000000d1';
update profiles set role = 'worker' where id = '00000000-0000-0000-0000-0000000000e1';
delete from creators where profile_id in ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000e1');
create function pg_temp.as_user(uid text) returns void language plpgsql as $$
begin perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true); end $$;
create function pg_temp.expect(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'OPS TEST FAILED: %', msg; end if; end $$;
create temp table ids (k text primary key, v uuid); grant all on ids to authenticated;
set local role authenticated;

-- creator onboarding
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select complete_onboarding('Creator One', 'IN', array['beauty'], null);
insert into social_accounts (creator_id, platform, handle, followers, avg_views, engagement_rate) values (auth.uid(), 'instagram', 'c1', 1000, 500, 4);
-- brand: create, draft campaign, pay (demo)
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
insert into ids select 'brand', create_brand('Glow', 'IN', true);
insert into campaigns (brand_id, title, product_name, categories, countries, creators_needed, fee_per_creator_minor, currency, deadline)
  select v, 'Serum launch', 'Serum', array['beauty'], array['IN'], 1, 1000001, 'INR', now() + interval '14 days' from ids where k = 'brand';
insert into ids select 'camp', id from campaigns limit 1;
select pg_temp.expect((select (confirm_campaign_payment(v)).amount_minor from ids where k = 'camp') = 1000001, 'brand pays gross without credit');
select pg_temp.expect((select status = 'live' and qa_required from campaigns), 'campaign live with QA gate');
-- creator applies (campaign is in early access → free creator blocked, so lift it for the test)
reset role; update campaigns set early_access_until = now() - interval '1 hour'; set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
insert into applications (campaign_id, creator_id, pitch) select v, auth.uid(), 'hi' from ids where k = 'camp';
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
select set_application_status((select id from applications), 'accepted');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select pg_temp.expect((select amount_minor = 750001 and state = 'pending' from ledger_entries), 'creator gets 75% (+remainder) pending');
insert into takes (assignment_id, storage_path, duration) select id, auth.uid() || '/take.mp4', 42 from assignments;
insert into ids select 'take', id from takes;
-- worker builds variants
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1');
select pg_temp.expect((worker_claim_job() -> 'job' ->> 'type') is not null, 'worker claims a job');
select worker_upsert_variant((select v from ids where k = 'take'), f, jsonb_build_object('hook_text', 'h', 'hook_options', '["h","i"]'::jsonb, 'score', 80, 'status', 'ready'))
  from unnest(array['hook_first', 'testimonial_tight', 'day_in_life', 'silent_montage']) f;
select worker_finish_take((select v from ids where k = 'take'));
-- creator submits 4 → QA queue
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select set_hook((select id from variants where format = 'hook_first'), 'i');
select pg_temp.expect((select status = 'processing' from variants where format = 'hook_first'), 'changing the hook queues a re-render');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1');
select worker_upsert_variant((select v from ids where k = 'take'), 'hook_first', jsonb_build_object('hook_text', 'i', 'hook_options', '["h","i"]'::jsonb, 'score', 82, 'status', 'ready'));
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select pg_temp.expect(submit_variants((select id from assignments), array(select id from variants)) = 'qa_review', 'submission goes to QA');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
select pg_temp.expect((select count(*) from variants) = 0, 'brand sees nothing before QA');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d1');
select qa_review(id, format <> 'silent_montage', 'ok') from variants;
-- brand selects 2 (base), buys 1 extra, approves
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
select pg_temp.expect((select count(*) from variants) = 3, 'brand sees the 3 QA-approved variants');
select pg_temp.expect(not can_read_variant_object((select take_id || '/hook_first/clean_9x16.mp4' from variants limit 1)), 'clean file locked before licensing');
select pg_temp.expect(can_read_variant_object((select take_id || '/hook_first/preview_9x16.mp4' from variants limit 1)), 'preview readable');
select select_variants((select id from assignments), array(select id from variants where format in ('hook_first', 'testimonial_tight')));
select pg_temp.expect(can_read_variant_object((select take_id || '/hook_first/clean_9x16.mp4' from variants limit 1)), 'clean file readable once licensed');
select pg_temp.expect((purchase_license((select id from variants where format = 'day_in_life'), 'extra')).price_minor = 200000, 'extra variant = 20% of fee');
select approve_assignment((select id from assignments), 5, 'great');
select pg_temp.expect((select status = 'completed' from campaigns), 'campaign completes when all slots approved');
select pg_temp.expect((select credit_balance from brands where id = (select v from ids where k = 'brand')) = 0 and (select count(*) from credits) = 0, 'credits are switched off: none issued on completion');
select pg_temp.expect((select bool_and(ends_at::date = (starts_at + interval '45 days')::date) from licenses), 'licences run 45 days');
select pg_temp.expect((select (purchase_license((select id from variants where format = 'hook_first'), 'renewal')).ends_at::date = (now() + interval '90 days')::date), 'renewal adds another 45 days after the current end');
select pg_temp.expect((purchase_license((select id from variants where format = 'hook_first'), 'whitelist')).price_minor = 300000, 'partnership ad = 30% of fee');
-- creator: cleared, then available after the delay, then KYC + partial withdrawal
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select pg_temp.expect((select count(*) = 4 and bool_and(state = 'cleared') and sum(amount_minor) = 750001 + 150000 + 375000 + 225000 from ledger_entries), 'campaign + licence earnings cleared, 75% of each');
select pg_temp.expect((select count(*) = 1 from ledger_entries where description like 'Partnership ad · %') and not exists (select 1 from ledger_entries where description ilike '%whitelist%'), 'creators see "Partnership ad", never "whitelist"');
select pg_temp.expect((select wins_count = 3 and submissions_count = 3 and campaigns_completed = 1 and rating_avg = 5 from creators), 'creator stats updated');
reset role; select set_config('request.jwt.claims', '', true); update ledger_entries set available_at = now() - interval '1 minute'; select run_scheduled_jobs(); set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
do $$ begin
  begin perform request_withdrawal('upi', '{"upi_id":"c1@upi"}', 100000); raise exception 'OPS TEST FAILED: withdrew without KYC';
  exception when sqlstate 'P0001' then if sqlerrm <> 'KYC_REQUIRED' then raise; end if; end;
  begin perform submit_kyc('a', 'b', 'bad'); raise exception 'OPS TEST FAILED: accepted bad PAN';
  exception when sqlstate 'P0001' then if sqlerrm not like 'Enter a valid PAN%' then raise; end if; end;
  begin perform notify(auth.uid(), 'x', 'spam'); raise exception 'OPS TEST FAILED: client called internal notify';
  exception when insufficient_privilege then null; end;
end $$;
select pg_temp.expect(submit_kyc('a', 'b', 'ABCDE1234F') = 'verified', 'demo KYC approves instantly');
select pg_temp.expect((request_withdrawal('upi', '{"upi_id":"c1@upi"}', 800000)).status = 'paid', 'mock payout');
select pg_temp.expect((select sum(amount_minor) filter (where state = 'withdrawn') = 800000 and sum(amount_minor) filter (where state = 'available') = 700001 from ledger_entries), 'partial withdrawal splits an entry');
-- second campaign: a leftover credit row is ignored while credits are off, and applied (platform fee only) when switched on
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
insert into campaigns (brand_id, title, product_name, categories, countries, creators_needed, fee_per_creator_minor, currency, deadline)
  select v, t, 'Serum', array['beauty'], array['IN'], 2, 400000, 'INR', now() + interval '14 days' from ids, unnest(array['Second', 'Third']) t where k = 'brand';
reset role; select set_config('request.jwt.claims', '', true);
insert into credits (brand_id, amount_minor, currency, expires_at) select v, 250000, 'INR', now() + interval '30 days' from ids where k = 'brand';
set local role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
select pg_temp.expect((select p.credit_applied_minor = 0 and p.amount_minor = 800000 from confirm_campaign_payment((select id from campaigns where title = 'Second')) p), 'credits off: brand pays the full amount');
reset role; select set_config('request.jwt.claims', '', true); update settings set value = 'true' where key = 'credits_enabled';
set local role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
select pg_temp.expect((select p.credit_applied_minor = 200000 and p.amount_minor = 600000 from confirm_campaign_payment((select id from campaigns where title = 'Third')) p), 'legacy path: credit capped at the 25% fee; creators untouched');
-- masking parity with the TypeScript implementation
select pg_temp.expect((select masked not like '%gmail%' and kinds @> array['email', 'phone'] from mask_contact('Mail priya.k@gmail.com or call +971 50 123 4567')), 'masks email + phone');
select pg_temp.expect((select kinds = '{}' from mask_contact('Can you ship 2 units? The 30ml one, order 4521.')), 'normal message untouched');
select pg_temp.expect((send_message((select v from ids where k = 'camp'), '00000000-0000-0000-0000-0000000000a1', 'just DM me on insta')).had_masking, 'send_message masks');
reset role;
rollback;
