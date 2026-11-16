-- Admin roles, the two-factor requirement, reasons and the audit log. Rolled back at the end.
begin;
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000aa01', 'super@test.dev', '{"display_name":"Super"}'),
  ('00000000-0000-0000-0000-00000000aa02', 'ops@test.dev', '{"display_name":"Ops"}'),
  ('00000000-0000-0000-0000-00000000aa03', 'fin@test.dev', '{"display_name":"Finance"}'),
  ('00000000-0000-0000-0000-00000000aa04', 'trust@test.dev', '{"display_name":"Trust"}'),
  ('00000000-0000-0000-0000-00000000aa05', 'nomfa@test.dev', '{"display_name":"No second factor"}'),
  ('00000000-0000-0000-0000-00000000aa06', 'creator@test.dev', '{"role":"creator","display_name":"Creator"}');
delete from creators where profile_id::text like '00000000-0000-0000-0000-00000000aa0%' and profile_id <> '00000000-0000-0000-0000-00000000aa06';
update profiles set role = 'admin', mfa_exempt = true, admin_role = case right(id::text, 1) when '1' then 'super_admin' when '2' then 'operations' when '3' then 'finance' else 'trust_safety' end
  where id::text like '00000000-0000-0000-0000-00000000aa0%' and right(id::text, 1) in ('1', '2', '3', '4');
update profiles set role = 'admin', admin_role = 'super_admin' where id = '00000000-0000-0000-0000-00000000aa05'; -- no exemption
insert into withdrawals (creator_id, method, amount_minor, currency, status) values ('00000000-0000-0000-0000-00000000aa06', 'upi', 5000, 'INR', 'failed');
insert into masking_attempts (profile_id, kinds) values ('00000000-0000-0000-0000-00000000aa06', array['phone']);

create function pg_temp.as_user(uid text, aal text default 'aal1') returns void language plpgsql as $$
begin perform set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000aa0' || uid, 'role', 'authenticated', 'aal', aal)::text, true); end $$;
create function pg_temp.expect(ok boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'ADMIN ROLE TEST FAILED: %', msg; end if; end $$;
/** Runs a statement and checks it fails with a message matching `pattern`. */
create function pg_temp.denied(stmt text, pattern text, msg text) returns void language plpgsql as $$
begin
  begin execute stmt; exception when others then
    if sqlerrm !~* pattern then raise exception 'ADMIN ROLE TEST FAILED: % (got: %)', msg, sqlerrm; end if;
    return;
  end;
  raise exception 'ADMIN ROLE TEST FAILED: % (the statement was allowed)', msg;
end $$;
set local role authenticated;
\set R '''A reason that is long enough'''

-- two-factor: an admin without a second factor is not an admin at all, except the documented demo exemption
select pg_temp.as_user('5');
select pg_temp.expect(not is_admin(), 'admin without a second factor is not treated as an admin');
select pg_temp.expect((select count(*) from audit_log) = 0, 'and reads nothing admin-only');
select pg_temp.denied($$select admin_update_settings('{"qa_required_first_n_campaigns":50}', 'A reason that is long enough')$$, 'Admins only', 'no admin actions without a second factor');
select pg_temp.as_user('5', 'aal2');
select pg_temp.expect(is_admin() and admin_can('settings'), 'with a second factor the same account is a super admin');
reset role; update settings set value = 'false' where key = 'demo_mode'; set local role authenticated;
select pg_temp.as_user('1');
select pg_temp.expect(not is_admin(), 'the exemption applies in demo mode only');
reset role; update settings set value = 'true' where key = 'demo_mode'; set local role authenticated;

-- a creator is never an admin
select pg_temp.as_user('6');
select pg_temp.denied($$select qa_review(gen_random_uuid(), true, 'A reason that is long enough')$$, 'Admins only', 'creators cannot review QA');
select pg_temp.denied($$select admin_overview()$$, 'Admins only', 'creators cannot read the overview');
select pg_temp.expect((select count(*) from audit_log) = 0 and (select count(*) from masking_attempts) = 0, 'creators read no audit or masking rows');

select pg_temp.denied($$select * from admin_list_users()$$, 'Admins only', 'creators cannot list users with their emails');

-- reasons are required
select pg_temp.as_user('1');
select pg_temp.denied($$select admin_update_settings('{"qa_required_first_n_campaigns":50}', 'too short')$$, 'at least 10 characters', 'a short reason is refused');

-- operations: review yes; money, settings and unmasking no
select pg_temp.as_user('2');
select pg_temp.expect(my_admin_role() = 'operations' and admin_can('review') and not admin_can('money') and not admin_can('settings') and not admin_can('reveal'), 'operations areas');
select pg_temp.denied($$select admin_verify_social(gen_random_uuid(), 'checked', 'A reason that is long enough')$$, 'Account not found', 'operations passes the verification guard');
select pg_temp.denied($$select qa_review(gen_random_uuid(), true, 'A reason that is long enough')$$, 'not awaiting QA', 'operations passes the QA guard');
select pg_temp.denied($$select admin_withdrawal_action((select id from withdrawals limit 1), 'retry', 'A reason that is long enough')$$, 'role does not allow', 'operations cannot touch payouts');
select pg_temp.denied($$select admin_resolve_dispute(gen_random_uuid(), 'full_refund', 'A reason that is long enough')$$, 'role does not allow', 'operations cannot refund');
select pg_temp.denied($$select admin_campaign_action(gen_random_uuid(), 'cancel_refund', 'A reason that is long enough')$$, 'role does not allow', 'operations cannot cancel with a refund');
select pg_temp.denied($$select admin_update_settings('{"qa_required_first_n_campaigns":50}', 'A reason that is long enough')$$, 'role does not allow', 'operations cannot change settings');
select pg_temp.denied($$select admin_set_fx('INR', 0.012, null, 'A reason that is long enough')$$, 'role does not allow', 'operations cannot change FX');
select pg_temp.denied($$select admin_run_job('leaderboards', 'A reason that is long enough')$$, 'role does not allow', 'operations cannot run jobs');
select pg_temp.denied($$select admin_reveal_original(gen_random_uuid(), 'A reason that is long enough')$$, 'role does not allow', 'operations cannot unmask a message');
select pg_temp.denied($$select admin_set_admin_role('00000000-0000-0000-0000-00000000aa03', 'super_admin', 'A reason that is long enough')$$, 'role does not allow', 'operations cannot grant roles');
select pg_temp.denied($$select run_scheduled_jobs()$$, 'Not allowed', 'admins cannot call the worker entry point');
select pg_temp.expect((select count(*) from withdrawals) = 0, 'operations cannot read payout destinations');
select pg_temp.expect((select count(*) from masking_attempts) = 1, 'operations reads masking records');
-- direct table writes are closed too, including promoting yourself
update settings set value = '1' where key = 'qa_required_first_n_campaigns';
select pg_temp.expect((select value from settings where key = 'qa_required_first_n_campaigns') <> '1'::jsonb, 'operations cannot write settings directly');
update fx_rates set rate_to_usd = 9 where currency = 'INR';
select pg_temp.expect((select rate_to_usd from fx_rates where currency = 'INR') <> 9, 'operations cannot write FX directly');
select pg_temp.denied($$update profiles set admin_role = 'super_admin' where id = '00000000-0000-0000-0000-00000000aa02'$$, 'permission denied', 'an admin cannot promote themselves');
select pg_temp.denied($$insert into audit_log (action) values ('forged')$$, 'permission denied|row-level security', 'the audit log cannot be written directly');
select pg_temp.denied($$select audit_admin('forged', 'x', 'y', null, null, 'A reason that is long enough')$$, 'permission denied', 'nor through the helper');
select pg_temp.denied($$select count(*) from masked_originals$$, 'permission denied', 'unmasked text is not readable as a table');

-- finance: money yes; review, settings and unmasking no
select pg_temp.as_user('3');
select pg_temp.expect(admin_can('money') and not admin_can('review') and not admin_can('settings'), 'finance areas');
select pg_temp.expect((select count(*) from admin_list_users() where email = 'creator@test.dev') = 1, 'admins can look a user up by email');
select pg_temp.expect((admin_overview() -> 'gmv') ? 'now' and (admin_counts()) ? 'qa', 'overview and counts load for an admin');
select pg_temp.expect((select count(*) from withdrawals) = 1 and (select count(*) from masking_attempts) = 0, 'finance reads payouts, not masking records');
select pg_temp.denied($$select qa_review(gen_random_uuid(), true, 'A reason that is long enough')$$, 'role does not allow', 'finance cannot review QA');
select pg_temp.denied($$select admin_verify_social(gen_random_uuid(), 'checked', 'A reason that is long enough')$$, 'role does not allow', 'finance cannot verify accounts');
select pg_temp.denied($$select admin_masking_action('00000000-0000-0000-0000-00000000aa06', 'warn', 'A reason that is long enough')$$, 'role does not allow', 'finance cannot act on masking flags');
select pg_temp.denied($$select admin_update_settings('{"demo_mode":false}', 'A reason that is long enough')$$, 'role does not allow', 'finance cannot change settings');
select pg_temp.denied($$select admin_resolve_dispute(gen_random_uuid(), 'full_refund', 'A reason that is long enough')$$, 'not open', 'finance passes the refund guard');
select admin_withdrawal_action((select id from withdrawals limit 1), 'retry', 'Bank details corrected by the creator');
select pg_temp.expect((select status from withdrawals limit 1) = 'paid', 'finance retries a failed payout');

-- trust & safety: review and unmasking; not money or settings
select pg_temp.as_user('4');
select pg_temp.expect(admin_can('review') and admin_can('reveal') and not admin_can('money') and not admin_can('settings'), 'trust and safety areas');
select pg_temp.denied($$select admin_reveal_original(gen_random_uuid(), 'A reason that is long enough')$$, 'was not kept', 'trust and safety passes the unmasking guard');
select admin_masking_action('00000000-0000-0000-0000-00000000aa06', 'suspend_messaging', 'Third attempt to share a phone number');
select pg_temp.denied($$select admin_withdrawal_action((select id from withdrawals limit 1), 'hold', 'A reason that is long enough')$$, 'role does not allow', 'trust and safety cannot touch payouts');

-- super admin: settings, with before / after / reason in the audit log
select pg_temp.as_user('1');
select pg_temp.denied($$select admin_reveal_original(gen_random_uuid(), 'A reason that is long enough')$$, 'role does not allow', 'even a super admin cannot unmask a message');
select admin_update_settings('{"qa_required_first_n_campaigns":50}', 'Lowering the gate for the test run');
select pg_temp.denied($$select admin_update_settings('{"license_pricing":{"termDays":60,"renewalBps":5000}}', 'A reason that is long enough')$$, 'between 35 and 45', 'the licence term stays within 35 to 45 days');
select admin_set_admin_role('00000000-0000-0000-0000-00000000aa02', 'trust_safety', 'Moved to the trust and safety team');
select pg_temp.denied($$select admin_set_admin_role('00000000-0000-0000-0000-00000000aa01', 'finance', 'A reason that is long enough')$$, 'another super admin', 'a super admin cannot change their own role');
select pg_temp.expect((select before = '100'::jsonb and after = '50'::jsonb and reason = 'Lowering the gate for the test run' and actor_id = '00000000-0000-0000-0000-00000000aa01' from audit_log where action = 'settings.update'), 'settings change is audited with before, after and reason');
select pg_temp.expect((select count(*) from audit_log where action in ('withdrawal.retry', 'masking.suspend_messaging', 'admin.set_role') and char_length(reason) >= 10 and before is not null and after is not null) = 3, 'money, masking and role changes are audited with before, after and reason');

-- suspended accounts cannot act; messaging suspension blocks messages
select pg_temp.as_user('6');
select pg_temp.denied($$select send_message(gen_random_uuid(), '00000000-0000-0000-0000-00000000aa06', 'hello there')$$, 'Messaging is paused', 'a messaging suspension blocks new messages');
select pg_temp.as_user('1');
select admin_set_user_status('00000000-0000-0000-0000-00000000aa06', 'suspend', 'Confirmed duplicate of another account');
select pg_temp.as_user('6');
select pg_temp.denied($$select uid_required()$$, 'suspended', 'a suspended account cannot act');
rollback;
