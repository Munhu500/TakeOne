-- Waitlist: anonymous insert only.
begin;
set local role anon;
insert into public.waitlist (email, role, country) values ('someone@example.com', 'creator', 'IN');
do $$ begin
  begin perform 1 from public.waitlist; raise exception 'anon must not read the waitlist'; exception when insufficient_privilege then null; end;
  begin update public.waitlist set email = 'x@example.com' where true; raise exception 'anon must not update the waitlist'; exception when insufficient_privilege then null; end;
  begin delete from public.waitlist where true; raise exception 'anon must not delete from the waitlist'; exception when insufficient_privilege then null; end;
  begin insert into public.waitlist (email, role, country, created_at) values ('a@example.com', 'brand', 'AE', now() - interval '1 year'); raise exception 'created_at must not be settable'; exception when insufficient_privilege then null; end;
  begin insert into public.waitlist (email, role, country) values ('not-an-email', 'brand', 'AE'); raise exception 'email must be validated'; exception when check_violation then null; end;
  begin insert into public.waitlist (email, role, country) values ('b@example.com', 'admin', 'AE'); raise exception 'role must be validated'; exception when check_violation then null; end;
  begin insert into public.waitlist (email, role, country) values ('c@example.com', 'brand', 'US'); raise exception 'country must be validated'; exception when check_violation then null; end;
end $$;
reset role;
do $$ begin if (select count(*) from public.waitlist) <> 1 then raise exception 'expected exactly one waitlist row'; end if; end $$;
rollback;
