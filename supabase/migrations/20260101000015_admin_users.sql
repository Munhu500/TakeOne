-- Admin Users page: sign-in email and last sign-in live in auth.users, which the API never exposes. This function
-- returns them to admins only (any admin role, with the two-factor requirement that is_admin() carries).
create or replace function public.admin_list_users() returns table (
  id uuid, email text, display_name text, role text, admin_role text, country text, created_at timestamptz,
  suspended_at timestamptz, suspended_reason text, strikes int, messaging_suspended_until timestamptz, last_sign_in_at timestamptz
) language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  if not is_admin() then perform fail('Admins only'); end if;
  return query
    select p.id, u.email::text, p.display_name, p.role, p.admin_role, p.country, p.created_at, p.suspended_at, p.suspended_reason, p.strikes, p.messaging_suspended_until, u.last_sign_in_at
    from profiles p join auth.users u on u.id = p.id where p.role <> 'worker' order by p.created_at desc;
end $$;
revoke execute on function public.admin_list_users() from public, anon;
