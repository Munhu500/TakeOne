-- Each campaign carries its own licence term (35–45 days, chosen in the new-campaign wizard; default 45).
-- Included selections, extra variants, renewals and partnership ads for that campaign all run for this term.
alter table public.campaigns add column license_term_days int not null default 45 check (license_term_days between 35 and 45);

create or replace function public.campaign_term_days(p_campaign_id uuid) returns int language sql stable security definer set search_path = public as $$
  select least(45, greatest(35, coalesce((select license_term_days from campaigns where id = p_campaign_id), license_term_days())));
$$;
revoke execute on function public.campaign_term_days(uuid) from public, anon;

-- The two functions below are unchanged except that they read the campaign's term instead of the global default.
create or replace function public.select_variants(p_assignment_id uuid, p_variant_ids uuid[]) returns void
language plpgsql security definer set search_path = public as $$
declare s assignments; c campaigns; have int; n int;
begin
  select * into s from assignments where id = p_assignment_id for update;
  if s.id is null or not can_manage_campaign(s.campaign_id) then perform fail('Assignment not found'); end if;
  if s.status not in ('delivered', 'approved', 'completed') then perform fail('Variants have not been delivered yet'); end if;
  select * into c from campaigns where id = s.campaign_id;
  select count(*) into have from licenses l join variants v on v.id = l.variant_id join takes t on t.id = v.take_id where t.assignment_id = s.id and l.type = 'base';
  if have + coalesce(array_length(p_variant_ids, 1), 0) > 3 then perform fail('The base campaign includes up to 3 variants. License more as add-ons.'); end if;
  with picked as (
    update variants v set status = 'licensed' from takes t
    where t.id = v.take_id and t.assignment_id = s.id and v.id = any (p_variant_ids) and v.status = 'delivered' and v.visible_to_brand returning v.id
  ), ins as (
    insert into licenses (variant_id, brand_id, campaign_id, type, ends_at, price_minor, currency)
    select id, c.brand_id, c.id, 'base', now() + make_interval(days => campaign_term_days(c.id)), 0, c.currency from picked returning 1
  ) select count(*) into n from ins;
  if n = 0 then perform fail('Choose delivered variants to select'); end if;
  perform record_win(s.creator_id, n);
  perform notify(s.creator_id, 'selected', n || ' of your variants were selected', c.title, jsonb_build_object('assignment_id', s.id));
end $$;

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
  ends := case when p_type = 'buyout' then null else starts + make_interval(days => campaign_term_days(c.id)) end;
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
