-- Business decisions (override earlier behaviour):
--   1. Campaign credit is removed from the product (setting credits_enabled = false; code path kept behind it).
--   2. A licence runs 35–45 days (default 45). Renewals extend by the same term.
--   3. "Whitelist" is shown as "Partnership ad" everywhere (the stored licence type stays `whitelist`).
insert into public.settings (key, value) values ('credits_enabled', 'false') on conflict (key) do update set value = excluded.value;
update public.settings set value = jsonb_set(value, '{termDays}', '45') where key = 'license_pricing';

create or replace function public.credits_enabled() returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select value from settings where key = 'credits_enabled') = 'true'::jsonb, false);
$$;
-- always 35–45 days, whatever the setting says
create or replace function public.license_term_days() returns int language sql stable security definer set search_path = public as $$
  select least(45, greatest(35, coalesce(((select value from settings where key = 'license_pricing') ->> 'termDays')::int, 45)));
$$;
create or replace function public.license_label(ltype text) returns text language sql immutable as $$
  select case ltype when 'whitelist' then 'Partnership ad' when 'extra' then 'Extra variant licence' when 'renewal' then 'Licence renewal' when 'buyout' then 'Buyout' else 'Licence' end;
$$;

create or replace function public.confirm_campaign_payment(p_campaign_id uuid, p_provider text default 'mock', p_provider_ref text default null) returns payments
language plpgsql security definer set search_path = public as $$
declare c campaigns; gross bigint; pool bigint; fee bigint; apply bigint := 0; take bigint; cr record; pay payments; live_count int; threshold int;
begin
  select * into c from campaigns where id = p_campaign_id for update;
  if c.id is null then perform fail('Campaign not found'); end if;
  if not (is_trusted() or (is_demo() and can_manage_campaign(c.id))) then perform fail('Payment confirmation required'); end if;
  if c.status not in ('draft', 'pending_payment') then perform fail('Campaign is already funded'); end if;
  gross := c.fee_per_creator_minor * c.creators_needed;
  pool := creator_share(c.fee_per_creator_minor) * c.creators_needed;
  fee := gross - pool;
  if credits_enabled() then
    -- legacy Option B credit: only ever reduces the platform fee, never the creator pool
    for cr in select * from credits where brand_id = c.brand_id and currency = c.currency and expires_at > now() and used_minor < amount_minor order by expires_at for update loop
      exit when apply >= fee;
      take := least(cr.amount_minor - cr.used_minor, fee - apply);
      update credits set used_minor = used_minor + take where id = cr.id;
      apply := apply + take;
    end loop;
    update brands set credit_balance = greatest(credit_balance - apply, 0) where id = c.brand_id;
  end if;
  insert into payments (brand_id, campaign_id, kind, provider, provider_ref, gross_minor, amount_minor, credit_applied_minor, currency, status)
  values (c.brand_id, c.id, 'campaign', p_provider, coalesce(p_provider_ref, 'mock_pi_' || substr(gen_random_uuid()::text, 1, 12)), gross, gross - apply, apply, c.currency, 'held')
  returning * into pay;
  select count(*) into live_count from campaigns where published_at is not null;
  select coalesce((value #>> '{}')::int, 100) into threshold from settings where key = 'qa_required_first_n_campaigns';
  update campaigns set status = 'live', published_at = now(), early_access_until = now() + interval '48 hours', qa_required = live_count < coalesce(threshold, 100) where id = c.id;
  perform audit('campaign.funded', 'campaign', c.id::text, jsonb_build_object('gross', gross, 'credit', apply));
  return pay;
end $$;

create or replace function public.maybe_complete_campaign(p_campaign_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare c campaigns; approved int; open_ int; credit bigint; gross bigint;
begin
  select * into c from campaigns where id = p_campaign_id for update;
  if c.status <> 'in_progress' then return; end if;
  select count(*) filter (where approved_at is not null), count(*) filter (where approved_at is null) into approved, open_ from assignments where campaign_id = c.id;
  if approved < c.creators_needed or open_ > 0 then return; end if;
  update campaigns set status = 'completed', completed_at = now() where id = c.id;
  update payments set status = 'released', settled_at = now() where campaign_id = c.id and kind = 'campaign' and status = 'held' returning gross_minor into gross;
  -- legacy Option B credit, only while credits are switched on
  if credits_enabled()
     and not exists (select 1 from campaigns where brand_id = c.brand_id and status = 'completed' and id <> c.id)
     and not exists (select 1 from credits where brand_id = c.brand_id and source_campaign_id is not null) then
    credit := (coalesce(gross, c.fee_per_creator_minor * c.creators_needed) * 2500) / 10000;
    insert into credits (brand_id, amount_minor, currency, expires_at, source_campaign_id) values (c.brand_id, credit, c.currency, now() + interval '60 days', c.id);
    update brands set credit_balance = credit_balance + credit where id = c.brand_id;
    perform notify_brand(c.brand_id, 'credit', 'You earned campaign credit', 'Valid for 60 days against the platform fee on your next campaign.', jsonb_build_object('campaign_id', c.id, 'amount_minor', credit, 'currency', c.currency));
  end if;
end $$;

-- Paid add-ons: extra variant, renewal, buyout, partnership ad. Creator gets 75% of every one.
create or replace function public.purchase_license(p_variant_id uuid, p_type text, p_provider text default 'mock', p_provider_ref text default null) returns licenses
language plpgsql security definer set search_path = public as $$
declare v variants; s assignments; c campaigns; price bigint; starts timestamptz := now(); ends timestamptz; pay payments; lic licenses; ccur text; share bigint; approved boolean; tier_days int;
begin
  select * into v from variants where id = p_variant_id for update;
  select s2.* into s from assignments s2 join takes t on t.assignment_id = s2.id where t.id = v.take_id;
  if v.id is null or s.id is null or not (is_trusted() or (is_demo() and can_manage_campaign(s.campaign_id))) then perform fail('Variant not found'); end if;
  if p_type not in ('extra', 'renewal', 'buyout', 'whitelist') then perform fail('Invalid licence type'); end if;
  if not v.visible_to_brand or v.status not in ('delivered', 'licensed') then perform fail('Variant is not available to license'); end if;
  if p_type = 'extra' and v.status = 'licensed' then perform fail('Variant is already licensed'); end if;
  if p_type <> 'extra' and v.status <> 'licensed' then perform fail('License this variant first'); end if;
  select * into c from campaigns where id = s.campaign_id;
  price := (c.fee_per_creator_minor * license_bps(p_type)) / 10000;
  if p_type = 'renewal' then
    -- a renewal adds one more term, starting when the current licence ends (or now, if it has lapsed)
    select greatest(max(ends_at), now()) into starts from licenses where variant_id = v.id and type in ('base', 'extra', 'renewal');
    if exists (select 1 from licenses where variant_id = v.id and type = 'buyout') then perform fail('This variant is already bought out'); end if;
  end if;
  ends := case when p_type = 'buyout' then null else starts + make_interval(days => license_term_days()) end;
  insert into payments (brand_id, campaign_id, kind, provider, provider_ref, gross_minor, amount_minor, currency, status, settled_at, metadata)
  values (c.brand_id, c.id, 'license', p_provider, coalesce(p_provider_ref, 'mock_pi_' || substr(gen_random_uuid()::text, 1, 12)), price, price, c.currency, 'released', now(), jsonb_build_object('type', p_type, 'variant_id', v.id))
  returning * into pay;
  insert into licenses (variant_id, brand_id, campaign_id, type, starts_at, ends_at, price_minor, currency, payment_id)
  values (v.id, c.brand_id, c.id, p_type, starts, ends, price, c.currency, pay.id) returning * into lic;
  update variants set status = 'licensed' where id = v.id;
  if p_type = 'extra' then perform record_win(s.creator_id, 1); end if;
  select currency into ccur from profiles where id = s.creator_id;
  share := convert_minor(creator_share(price), c.currency, ccur);
  approved := s.approved_at is not null;
  select case when is_pro(s.creator_id) then 3 else 14 end into tier_days;
  insert into ledger_entries (creator_id, source, amount_minor, currency, state, cleared_at, available_at, campaign_id, assignment_id, license_id, payment_id, description)
  values (s.creator_id, 'license', share, ccur, case when approved then 'cleared' else 'pending' end, case when approved then now() end,
    case when approved then now() + make_interval(days => tier_days) end, c.id, s.id, lic.id, pay.id, license_label(p_type) || ' · ' || c.title);
  if approved then perform bump_month(s.creator_id, 0, 0, 0, convert_minor(share, ccur, 'USD')); end if;
  perform notify(s.creator_id, 'license', 'New licence payment', license_label(p_type) || ' on ' || c.title, jsonb_build_object('assignment_id', s.id));
  return lic;
end $$;

update public.ledger_entries set description = replace(description, 'Whitelist license', 'Partnership ad') where description like 'Whitelist license%';
revoke execute on function public.credits_enabled(), public.license_label(text), public.license_term_days(), public.confirm_campaign_payment(uuid, text, text), public.purchase_license(uuid, text, text, text) from public, anon;
revoke execute on function public.maybe_complete_campaign(uuid) from public, anon, authenticated;
