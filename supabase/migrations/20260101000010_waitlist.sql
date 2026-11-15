-- TakeOne Live waitlist (landing page). Anyone may add themselves; nobody can read, change or delete rows through the API.
-- Entries are read by the team from the database directly.
create table public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null check (char_length(email) between 5 and 254 and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  role text not null check (role in ('creator', 'brand')),
  country text not null check (country in ('IN', 'AE')),
  created_at timestamptz not null default now()
);
alter table public.waitlist enable row level security;
-- Insert only: there is deliberately no select, update or delete policy. Duplicates are allowed so the response never
-- reveals whether an address is already on the list.
create policy "anyone can join the waitlist" on public.waitlist for insert to anon, authenticated with check (true);
revoke all on public.waitlist from public, anon, authenticated;
-- Clients may set only these columns; id and created_at always come from the defaults.
grant insert (email, role, country) on public.waitlist to anon, authenticated;
