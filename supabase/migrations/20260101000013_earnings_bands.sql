-- Finer earnings bands, set per market. Earnings still leave the database only as a band floor (unless the creator
-- opted in to exact figures): the floor is the highest display threshold, in any market's bands, at or below the amount.
-- INR ₹25K ₹50K ₹1L ₹2L ₹3L ₹5L ₹8L ₹12L ₹20L · AED 1K 2.5K 5K 10K 15K 25K 40K 60K · USD 100 500 1K 2.5K 5K 10K 25K
create or replace function public.earnings_band_floor(usd_minor bigint) returns bigint
language sql stable security definer set search_path = public as $$
  select coalesce(max(t), 0) from (
    -- rounded up, so converting the floor back to the local currency never lands just under its own threshold
    select ceil(x.major * 100 * (select rate_to_usd from fx_rates f where f.currency = x.cur))::bigint as t
    from (values ('INR', 25000), ('INR', 50000), ('INR', 100000), ('INR', 200000), ('INR', 300000), ('INR', 500000), ('INR', 800000), ('INR', 1200000), ('INR', 2000000),
                 ('AED', 1000), ('AED', 2500), ('AED', 5000), ('AED', 10000), ('AED', 15000), ('AED', 25000), ('AED', 40000), ('AED', 60000),
                 ('USD', 100), ('USD', 500), ('USD', 1000), ('USD', 2500), ('USD', 5000), ('USD', 10000), ('USD', 25000)) as x(cur, major)
  ) s where t <= usd_minor;
$$;
