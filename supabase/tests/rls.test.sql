-- RLS smoke tests. Each block raises if a privacy rule is broken. Runs inside one rolled-back transaction.
begin;
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'c1@test.dev', '{"role":"creator","display_name":"C1"}'),
  ('00000000-0000-0000-0000-0000000000a2', 'c2@test.dev', '{"role":"creator","display_name":"C2"}'),
  ('00000000-0000-0000-0000-0000000000b1', 'b1@test.dev', '{"role":"brand_member","display_name":"B1"}'),
  ('00000000-0000-0000-0000-0000000000b2', 'b2@test.dev', '{"role":"brand_member","display_name":"B2"}'),
  ('00000000-0000-0000-0000-0000000000d1', 'evil@test.dev', '{"role":"admin","display_name":"Evil"}');
insert into brands (id, name) values ('00000000-0000-0000-0000-00000000b001', 'Brand One'), ('00000000-0000-0000-0000-00000000b002', 'Brand Two');
insert into memberships (profile_id, brand_id) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-00000000b001'),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-00000000b002');
update creators set tax_id = 'ABCDE1234F' where profile_id = '00000000-0000-0000-0000-0000000000a1';
insert into campaigns (id, brand_id, title, product_name, fee_per_creator_minor, currency, deadline, status, early_access_until) values
  ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000b001', 'Live', 'P', 100000, 'INR', now() + interval '10 days', 'live', null),
  ('00000000-0000-0000-0000-00000000c002', '00000000-0000-0000-0000-00000000b001', 'Early', 'P', 100000, 'INR', now() + interval '10 days', 'live', now() + interval '1 day'),
  ('00000000-0000-0000-0000-00000000c003', '00000000-0000-0000-0000-00000000b001', 'Draft', 'P', 100000, 'INR', now() + interval '10 days', 'draft', null);
insert into assignments (id, campaign_id, creator_id) values ('00000000-0000-0000-0000-00000000a501', '00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-0000000000a1');
insert into takes (id, assignment_id, storage_path) values ('00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-00000000a501', 'x/y.mp4');
insert into variants (take_id, format, status, visible_to_brand) values
  ('00000000-0000-0000-0000-00000000e001', 'hook_first', 'delivered', true),
  ('00000000-0000-0000-0000-00000000e001', 'testimonial_tight', 'ready', false);
insert into ledger_entries (creator_id, source, amount_minor, currency) values ('00000000-0000-0000-0000-0000000000a1', 'campaign', 75000, 'INR');

create function pg_temp.as_user(uid text) returns void language plpgsql as $$
begin perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true); end $$;
create function pg_temp.expect(ok boolean, msg text) returns void language plpgsql as $$
begin if not ok then raise exception 'RLS TEST FAILED: %', msg; end if; end $$;
grant execute on all functions in schema pg_temp to authenticated;

do $$ begin
  perform pg_temp.expect((select role from profiles where id = '00000000-0000-0000-0000-0000000000d1') = 'creator', 'admin role cannot be self-assigned at signup');
  perform pg_temp.expect((select count(*) from jobs) = 2, 'take insert queues 2 jobs');
end $$;

set local role authenticated;
-- creator 2
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a2');
select pg_temp.expect((select count(*) from creators) = 1, 'creator sees only own creators row');
select pg_temp.expect((select count(*) from ledger_entries) = 0, 'creator cannot see other ledgers');
select pg_temp.expect((select count(*) from variants) = 0, 'creator cannot see other variants');
select pg_temp.expect((select count(*) from campaigns) = 1, 'free creator sees live, not early-access or draft');
do $$ begin
  begin update creators set tier = 'pro' where profile_id = auth.uid(); raise exception 'RLS TEST FAILED: creator set own tier';
  exception when insufficient_privilege then null; end;
  begin update profiles set role = 'admin' where id = auth.uid(); raise exception 'RLS TEST FAILED: creator set own role';
  exception when insufficient_privilege then null; end;
  begin insert into applications (campaign_id, creator_id) values ('00000000-0000-0000-0000-00000000c002', auth.uid()); raise exception 'RLS TEST FAILED: applied in early access';
  exception when sqlstate 'P0001' then null; end;
  insert into applications (campaign_id, creator_id) values ('00000000-0000-0000-0000-00000000c001', auth.uid());
  begin insert into messages (campaign_id, creator_id, sender_id, body_masked) values ('00000000-0000-0000-0000-00000000c001', auth.uid(), auth.uid(), 'call 9876543210'); raise exception 'RLS TEST FAILED: direct message insert skipped masking';
  exception when insufficient_privilege then null; end;
end $$;
-- brand 1 (owns the campaign)
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
select pg_temp.expect((select count(*) from creators) = 0, 'brand cannot read creators (tax id, kyc)');
select pg_temp.expect((select count(*) from social_accounts) = 0, 'brand cannot read raw social accounts');
select pg_temp.expect((select count(*) from creator_public) = 3, 'brand reads creator_public');
select pg_temp.expect((select count(*) from variants) = 1, 'brand sees only delivered+visible variants');
select pg_temp.expect((select count(*) from takes) = 0, 'brand cannot see raw takes');
select pg_temp.expect((select count(*) from campaigns) = 3, 'brand sees all own campaigns');
select pg_temp.expect((select count(*) from applications) = 1, 'brand sees applicants');
do $$ begin
  begin update campaigns set status = 'live' where id = '00000000-0000-0000-0000-00000000c003'; raise exception 'RLS TEST FAILED: brand published without paying';
  exception when insufficient_privilege then null; end;
end $$;
-- brand 2 (unrelated)
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b2');
select pg_temp.expect((select count(*) from variants) = 0, 'other brand sees no variants');
select pg_temp.expect((select count(*) from applications) = 0, 'other brand sees no applicants');
select pg_temp.expect((select count(*) from payments) = 0, 'other brand sees no payments');
reset role;
rollback;
