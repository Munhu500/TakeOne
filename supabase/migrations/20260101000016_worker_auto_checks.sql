-- The worker stores the automated QA checks it computed with each variant. Otherwise unchanged.
create or replace function public.worker_upsert_variant(p_take_id uuid, p_format text, p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare vid uuid;
begin
  if not is_worker() then perform fail('Workers only'); end if;
  insert into variants (take_id, format, storage_path, renditions, preview_renditions, thumbnail, hook_text, hook_options, score, score_reason, is_synthetic, ai_disclosure, language, status, auto_checks)
  values (p_take_id, p_format, p ->> 'storage_path', coalesce(p -> 'renditions', '{}'), coalesce(p -> 'preview_renditions', '{}'), p ->> 'thumbnail', p ->> 'hook_text',
    coalesce(array(select jsonb_array_elements_text(p -> 'hook_options')), '{}'), (p ->> 'score')::int, p ->> 'score_reason', coalesce((p ->> 'is_synthetic')::boolean, false),
    p ->> 'ai_disclosure', p ->> 'language', coalesce(p ->> 'status', 'ready'), coalesce(p -> 'auto_checks', '[]'))
  on conflict (take_id, format) do update set storage_path = excluded.storage_path, renditions = excluded.renditions, preview_renditions = excluded.preview_renditions,
    thumbnail = excluded.thumbnail, hook_text = excluded.hook_text, hook_options = excluded.hook_options, score = excluded.score, score_reason = excluded.score_reason,
    is_synthetic = excluded.is_synthetic, ai_disclosure = excluded.ai_disclosure, language = excluded.language, status = excluded.status, auto_checks = excluded.auto_checks
  where variants.status in ('processing', 'ready', 'failed', 'coming_soon', 'qa_rejected')
  returning id into vid;
  return vid;
end $$;
