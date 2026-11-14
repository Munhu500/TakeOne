-- Choosing a different hook re-renders that variant so the burned-in text always matches what the brand will see.
alter table public.jobs drop constraint jobs_type_check;
alter table public.jobs add constraint jobs_type_check check (type in ('process_take', 'product_check', 'verify_metrics', 'rerender_variant'));

create or replace function public.set_hook(p_variant_id uuid, p_hook text) returns void
language plpgsql security definer set search_path = public as $$
declare v variants;
begin
  select * into v from variants where id = p_variant_id and owns_take(take_id) for update;
  if v.id is null or v.status not in ('ready', 'qa_rejected') or not (p_hook = any (v.hook_options)) then perform fail('Pick one of the suggested hooks'); end if;
  if v.hook_text is not distinct from p_hook then return; end if;
  update variants set hook_text = p_hook, status = 'processing' where id = v.id;
  insert into jobs (type, payload) values ('rerender_variant', jsonb_build_object('take_id', v.take_id, 'format', v.format, 'hook', p_hook, 'variant_id', v.id));
end $$;

-- Win Predictor (Pro): AI rewrites are added as extra options; the creator still chooses.
create or replace function public.add_hook_options(p_variant_id uuid, p_hooks text[]) returns text[]
language plpgsql security definer set search_path = public as $$
declare opts text[];
begin
  if not is_pro(uid_required()) then perform fail('Win Predictor is a Pro feature'); end if;
  update variants set hook_options = (select array(select distinct x from unnest(hook_options || p_hooks[1:3]) x where length(x) between 1 and 120))
  where id = p_variant_id and owns_take(take_id) and status in ('ready', 'qa_rejected') returning hook_options into opts;
  if opts is null then perform fail('Variant not found'); end if;
  return opts;
end $$;

create or replace function public.worker_claim_job() returns jsonb
language plpgsql security definer set search_path = public as $$
declare j jobs; ctx jsonb := '{}'; t takes; s assignments; c campaigns;
begin
  if not is_worker() then perform fail('Workers only'); end if;
  select * into j from claim_job(array['process_take', 'product_check', 'verify_metrics', 'rerender_variant']) limit 1;
  if j.id is null then return null; end if;
  if j.type in ('process_take', 'product_check', 'rerender_variant') then
    select * into t from takes where id = (j.payload ->> 'take_id')::uuid;
    select * into s from assignments where id = t.assignment_id;
    select * into c from campaigns where id = s.campaign_id;
    ctx := jsonb_build_object('take', to_jsonb(t), 'assignment_id', s.id, 'creator_id', s.creator_id, 'is_pro', is_pro(s.creator_id),
      'campaign', jsonb_build_object('id', c.id, 'title', c.title, 'product_name', c.product_name, 'product_images', c.product_images, 'brief', c.brief),
      'variant', (select jsonb_build_object('hook_options', v.hook_options) from variants v where v.take_id = t.id and v.format = j.payload ->> 'format'),
      'likeness', (select jsonb_build_object('voice_provider_id', l.voice_provider_id) from likeness_profiles l where l.creator_id = s.creator_id and l.status = 'ready'
         and exists (select 1 from likeness_consents lc where lc.creator_id = s.creator_id and lc.campaign_id = c.id and lc.revoked_at is null)));
  elsif j.type = 'verify_metrics' then
    ctx := jsonb_build_object('social', (select to_jsonb(sa) from social_accounts sa where sa.id = (j.payload ->> 'social_id')::uuid));
  end if;
  return jsonb_build_object('job', to_jsonb(j), 'context', ctx);
end $$;
revoke execute on function public.set_hook(uuid, text), public.add_hook_options(uuid, text[]), public.worker_claim_job() from public, anon;
