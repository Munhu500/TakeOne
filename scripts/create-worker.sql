-- Creates the video worker's least-privilege login. Run once in the Supabase SQL editor (or psql) after the migrations.
-- Replace CHANGE_ME with a long random password and put the same value in WORKER_PASSWORD.
do $$
declare wid uuid := gen_random_uuid(); pw text := 'CHANGE_ME';
begin
  if pw = 'CHANGE_ME' then raise exception 'Set a real password first'; end if;
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change, email_change_token_new)
  values ('00000000-0000-0000-0000-000000000000', wid, 'authenticated', 'authenticated', 'worker@takeone.internal', extensions.crypt(pw, extensions.gen_salt('bf', 10)), now(),
    '{"provider":"email","providers":["email"]}', '{"role":"brand_member","display_name":"Video Worker"}', now(), now(), '', '', '', '');
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), wid, wid::text, jsonb_build_object('sub', wid::text, 'email', 'worker@takeone.internal', 'email_verified', true), 'email', now(), now(), now());
  update public.profiles set role = 'worker', display_name = 'Video Worker', onboarded = true where id = wid;
end $$;
