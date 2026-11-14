-- Storage buckets. Everything creator-private is in a private bucket under a {user_id}/ prefix.
-- Variant files are never readable by clients directly: the server signs URLs after checking licenses.
insert into storage.buckets (id, name, public) values
  ('public-assets', 'public-assets', true),
  ('takes', 'takes', false),
  ('variants', 'variants', false),
  ('verification', 'verification', false),
  ('likeness', 'likeness', false),
  ('kyc', 'kyc', false)
on conflict (id) do nothing;

create policy "public assets are readable" on storage.objects for select to anon, authenticated using (bucket_id = 'public-assets');
create policy "members upload public assets" on storage.objects for insert to authenticated
  with check (bucket_id = 'public-assets' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "creators write own private files" on storage.objects for insert to authenticated
  with check (bucket_id in ('takes', 'verification', 'likeness', 'kyc') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "creators update own private files" on storage.objects for update to authenticated
  using (bucket_id in ('takes', 'verification', 'likeness', 'kyc') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "creators read own private files" on storage.objects for select to authenticated
  using (bucket_id in ('takes', 'verification', 'likeness', 'kyc') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "creators delete own likeness" on storage.objects for delete to authenticated
  using (bucket_id = 'likeness' and (storage.foldername(name))[1] = auth.uid()::text);

-- Realtime: chat, job progress, variants, notifications.
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.messages, public.jobs, public.variants, public.notifications, public.assignments;
  end if;
end $$;
