-- Brands may not read `takes` (raw footage rows), so variants carry their assignment id directly.
alter table public.variants add column assignment_id uuid references public.assignments (id) on delete cascade;
update public.variants v set assignment_id = t.assignment_id from public.takes t where t.id = v.take_id;
create index on public.variants (assignment_id);

create or replace function public.set_variant_assignment() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  select assignment_id into new.assignment_id from takes where id = new.take_id;
  return new;
end $$;
create trigger variants_set_assignment before insert on public.variants for each row execute function public.set_variant_assignment();
revoke execute on function public.set_variant_assignment() from public, anon, authenticated;
