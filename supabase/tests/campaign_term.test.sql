-- Campaign licence term: 35–45 days only, default 45.
begin;
do $$ declare cid uuid; begin
  select id into cid from public.campaigns limit 1;
  if cid is null then return; end if;
  if public.campaign_term_days(cid) <> 45 then raise exception 'default term should be 45'; end if;
  update public.campaigns set license_term_days = 35 where id = cid;
  if public.campaign_term_days(cid) <> 35 then raise exception 'term should follow the campaign'; end if;
  begin update public.campaigns set license_term_days = 50 where id = cid; raise exception 'term above 45 must be rejected'; exception when check_violation then null; end;
  begin update public.campaigns set license_term_days = 30 where id = cid; raise exception 'term below 35 must be rejected'; exception when check_violation then null; end;
end $$;
rollback;
