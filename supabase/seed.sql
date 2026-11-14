-- TakeOne demo data. Idempotent only on an empty database (supabase db reset). All demo logins use the password below.
-- Seeded variants and products carry no media: the web shows neutral frames until real footage and photos are supplied
-- (apps/web/public/media). `pnpm samples` still builds the worker's test take.
create or replace function public.seed_user(p_id uuid, p_email text, p_role text, p_name text) returns uuid
language plpgsql security definer set search_path = public, extensions, auth as $$
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new)
  values ('00000000-0000-0000-0000-000000000000', p_id, 'authenticated', 'authenticated', p_email, crypt('TakeOne-demo-2026', gen_salt('bf', 8)), now(),
    '{"provider":"email","providers":["email"]}', jsonb_build_object('role', case when p_role in ('admin', 'worker') then 'brand_member' else p_role end, 'display_name', p_name), now(), now(), '', '', '', '');
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), p_id, p_id::text, jsonb_build_object('sub', p_id::text, 'email', p_email, 'email_verified', true), 'email', now(), now(), now());
  update public.profiles set role = p_role, display_name = p_name, onboarded = true where id = p_id;
  return p_id;
end $$;
create or replace function public.seed_brief(product text, b1 text, b2 text, b3 text, audience text) returns jsonb language sql as $$
  select jsonb_build_object('description', product || ' — ' || b1 || ', ' || lower(b2) || ' and ' || lower(b3) || '.',
    'key_benefits', jsonb_build_array(b1, b2, b3), 'goals', 'Authentic UGC ads that show real use of ' || product || ' and drive first purchases.',
    'key_messages', jsonb_build_array(b1, 'Show the product in real use', 'Give your honest verdict'),
    'must_say', jsonb_build_array(product), 'must_not_say', jsonb_build_array('Medical or guaranteed-results claims', 'Competitor brand names'),
    'target_audience', audience, 'uses_ai_likeness', true);
$$;
create or replace function public.seed_shots(product text, b1 text) returns jsonb language sql as $$
  select jsonb_build_object('shots', jsonb_build_array(
      jsonb_build_object('title', 'Hook', 'direction', 'Look at the camera and name the problem ' || product || ' solves for you.', 'seconds', 5),
      jsonb_build_object('title', 'Show the product', 'direction', 'Hold ' || product || ' at chest height, label facing the lens, in good light.', 'seconds', 8),
      jsonb_build_object('title', 'Use it', 'direction', 'Use it on camera exactly as you normally would.', 'seconds', 15),
      jsonb_build_object('title', 'Your verdict', 'direction', 'Say what you honestly think and who it is for.', 'seconds', 10)),
    'talking_points', jsonb_build_array(b1, 'How long you have used it', 'What surprised you', 'Who you would recommend it to'),
    'framing_tips', jsonb_build_array('Vertical, phone at eye level', 'Face a window for light', 'Keep the product inside the guide box'));
$$;

do $$
declare
  pw_done boolean; i int; r record; cid uuid; hero uuid := 'aaaaaaaa-0000-4000-8000-000000000001'; bid uuid; agency uuid := 'a9000000-0000-4000-8000-000000000001';
  names text[] := array['Priya Sharma','Arjun Mehta','Fatima Al Mansoori','Rohan Kapoor','Layla Hassan','Ananya Iyer','Omar Khalid','Sneha Reddy','Zayed Al Falasi','Kavya Nair',
    'Mariam Saeed','Vikram Singh','Noura Al Hashimi','Ishaan Verma','Hessa Al Suwaidi','Meera Pillai','Khalid Rahman','Tanvi Desai','Salma Yousef','Aditya Rao',
    'Reem Al Ketbi','Nikhil Joshi','Dana Farouk','Pooja Bhatt','Hamdan Al Marri','Riya Chatterjee','Yousef Nasser','Aisha Qureshi','Dev Malhotra','Lina Haddad'];
  cats text[] := array['beauty','fashion','fitness','food','tech','lifestyle'];
  camp record; t uuid; fmt text; fmts text[] := array['hook_first','testimonial_tight','day_in_life','silent_montage','language_version'];
  soon text[] := array['unboxing_first_use','before_after','three_reasons','reaction_first_impression','comparison'];
  hooks jsonb := '{"hook_first":["My skin looked tired by 3pm. Not anymore.","I stopped hiding my skin on calls","Dull skin? Watch this first"],"testimonial_tight":["30 days, one serum, honest verdict","My honest month with this serum","Would I buy it again? Yes."],"day_in_life":["It fits into my actual morning","My 2-minute morning step","The step I never skip now"],"silent_montage":["Dull → glow in 30 days","One serum. Real skin.","Watch the texture"],"language_version":["30 दिन, एक सीरम, सच्ची राय","मेरी असली राय","क्या मैं दोबारा खरीदूंगी? हाँ"]}';
  scores jsonb := '{"hook_first":91,"testimonial_tight":84,"day_in_life":78,"silent_montage":73,"language_version":69}';
  a1 uuid; a2 uuid; a3 uuid; a4 uuid; lic uuid; pay uuid; w uuid;
begin
  -- ── staff + brand-side logins ──
  perform seed_user('dddddddd-0000-4000-8000-000000000001', 'admin@takeone.demo', 'admin', 'TakeOne Admin');
  perform seed_user('bbbbbbbb-0000-4000-8000-000000000001', 'brand@takeone.demo', 'brand_member', 'Neha (Kaya Glow)');
  perform seed_user('bbbbbbbb-0000-4000-8000-000000000002', 'brand.chai@takeone.demo', 'brand_member', 'Rahul (Chai & Co)');
  perform seed_user('bbbbbbbb-0000-4000-8000-000000000003', 'brand.ae@takeone.demo', 'brand_member', 'Sara (Dune Athletics)');
  perform seed_user('bbbbbbbb-0000-4000-8000-000000000004', 'brand.tech@takeone.demo', 'brand_member', 'Faisal (Souk Tech)');
  perform seed_user('bbbbbbbb-0000-4000-8000-000000000005', 'agency@takeone.demo', 'agency_member', 'Maya (Mirage Media)');
  update profiles set country = 'AE', currency = 'AED', locale = 'en-AE' where id in ('bbbbbbbb-0000-4000-8000-000000000003', 'bbbbbbbb-0000-4000-8000-000000000004', 'bbbbbbbb-0000-4000-8000-000000000005');

  insert into agencies (id, name, primary_color, subdomain, markup_default_bps) values (agency, 'Mirage Media', '#E0A526', 'mirage.localhost', 2000);
  insert into brands (id, name, country, currency, agency_id, markup_bps, created_at) values
    ('b0000000-0000-4000-8000-000000000001', 'Kaya Glow', 'IN', 'INR', null, null, now() - interval '120 days'),
    ('b0000000-0000-4000-8000-000000000002', 'Chai & Co', 'IN', 'INR', null, null, now() - interval '90 days'),
    ('b0000000-0000-4000-8000-000000000003', 'Dune Athletics', 'AE', 'AED', null, null, now() - interval '80 days'),
    ('b0000000-0000-4000-8000-000000000004', 'Souk Tech', 'AE', 'AED', null, null, now() - interval '60 days'),
    ('b0000000-0000-4000-8000-000000000005', 'Noor Beauty', 'AE', 'AED', agency, 2500, now() - interval '50 days'),
    ('b0000000-0000-4000-8000-000000000006', 'Veda Wear', 'IN', 'INR', agency, 1500, now() - interval '40 days');
  insert into memberships (profile_id, brand_id) select ('bbbbbbbb-0000-4000-8000-00000000000' || n)::uuid, ('b0000000-0000-4000-8000-00000000000' || n)::uuid from generate_series(1, 4) n;
  insert into memberships (profile_id, agency_id) values ('bbbbbbbb-0000-4000-8000-000000000005', agency);
  insert into terms_acceptances (profile_id, terms_type, version)
    select id, case role when 'agency_member' then 'agency_non_circumvention' else 'brand_non_circumvention' end, '2026-01' from profiles where role in ('brand_member', 'agency_member');

  -- ── 30 creators: odd = India, even = UAE; varied tiers, stats, join dates (last 8 are Rising Stars) ──
  for i in 1 .. 30 loop
    cid := ('aaaaaaaa-0000-4000-8000-0000000000' || lpad(i::text, 2, '0'))::uuid;
    perform seed_user(cid, case i when 1 then 'creator@takeone.demo' when 2 then 'creator.ae@takeone.demo' when 4 then 'creator.free@takeone.demo' else 'creator' || i || '@takeone.demo' end, 'creator', names[i]);
    update profiles set country = case when i % 2 = 1 then 'IN' else 'AE' end, currency = case when i % 2 = 1 then 'INR' else 'AED' end,
      locale = case when i % 2 = 1 then 'en-IN' else 'en-AE' end, created_at = now() - make_interval(days => case when i > 22 then 10 + i else 100 + i * 9 end) where id = cid;
    update creators set bio = 'UGC creator · ' || cats[1 + i % 6] || ' & ' || cats[1 + (i + 2) % 6] || ' · honest reviews only',
      categories = array[cats[1 + i % 6], cats[1 + (i + 2) % 6]], tier = case when i % 3 = 1 then 'pro' else 'free' end, is_founding = i in (3, 12),
      uae_permit_number = case when i % 2 = 0 then 'MC-ADV-' || (48200 + i * 37) end,
      submissions_count = case when i > 22 then 3 + i % 5 else 12 + (i * 7) % 40 end,
      wins_count = case when i > 22 then 1 + i % 3 else least(12 + (i * 7) % 40, 4 + (i * 11) % 30) end,
      campaigns_completed = case when i > 22 then 1 + i % 3 else 3 + (i * 5) % 28 end,
      rating_avg = 3.9 + ((i * 13) % 11) / 10.0, rating_count = case when i > 22 then 1 + i % 3 else 3 + (i * 5) % 20 end,
      show_exact_earnings = i % 5 = 0, kyc_status = case when i % 4 = 1 then 'verified' else 'none' end, tax_id = case when i = 1 then 'ABCPS1234K' end,
      created_at = now() - make_interval(days => case when i > 22 then 10 + i else 100 + i * 9 end) where profile_id = cid;
    insert into social_accounts (creator_id, platform, handle, followers, avg_views, engagement_rate, verification, ownership_verified_at, plausibility_score, public_metrics) values
      (cid, 'instagram', lower(replace(names[i], ' ', '.')), 8000 + i * 4100, 3000 + i * 1900, 2.5 + (i % 6) * 0.7, case i % 3 when 0 then 'checked' when 1 then 'api_verified' else 'self_reported' end, case when i % 3 < 2 then now() - interval '20 days' end, 92, jsonb_build_object('followers', 7900 + i * 4000, 'avgLikes', 200 + i * 110, 'avgComments', 12 + i)),
      (cid, case when i % 2 = 0 then 'tiktok' else 'youtube' end, lower(replace(names[i], ' ', '')) || case when i % 2 = 0 then '' else 'vlogs' end, 5000 + i * 2600, 4000 + i * 2300, 3.1 + (i % 4) * 0.9, case when i % 2 = 1 and i % 3 = 1 then 'api_verified' else 'self_reported' end, null, 88, null);
    insert into creator_monthly_stats (creator_id, month, wins, submissions, completed, earnings_usd_minor)
      values (cid, date_trunc('month', now())::date, 1 + (i * 3) % 6, 4 + (i * 3) % 7, 1 + i % 4, 12000 + ((i * 7919) % 90) * 9000),
             (cid, (date_trunc('month', now()) - interval '1 month')::date, 2 + i % 5, 6 + i % 6, 1 + i % 3, 20000 + ((i * 104729) % 70) * 8000);
    insert into terms_acceptances (profile_id, terms_type, version) values (cid, 'creator_terms', '2026-01');
    insert into guarantee_tracking (creator_id, window_start) values (cid, now() - interval '25 days');
  end loop;
  update creators set win_rate = round(wins_count::numeric / greatest(submissions_count, 1), 4);
  update creators set tier = 'pro', bio = 'Skincare obsessive from Mumbai. I test everything for 30 days before I say a word.', categories = array['beauty', 'lifestyle', 'food'] where profile_id = hero;
  update creators set tier = 'free', is_founding = false where profile_id = 'aaaaaaaa-0000-4000-8000-000000000004';
  update profiles set country = 'IN', currency = 'INR', locale = 'en-IN' where id = 'aaaaaaaa-0000-4000-8000-000000000004';
  update creators set uae_permit_number = null, categories = array['beauty', 'fashion'] where profile_id = 'aaaaaaaa-0000-4000-8000-000000000004';
  insert into subscriptions (creator_id, provider, provider_ref, status, current_period_end) select profile_id, 'mock', 'mock_sub_seed', 'active', now() + interval '20 days' from creators where tier = 'pro';
  insert into likeness_profiles (creator_id, status, voice_provider_id, capture_paths, consent_version) select profile_id, 'ready', 'mock-voice-' || substr(profile_id::text, 33), '{}', '2026-01' from creators where tier = 'pro' or is_founding;
  -- verification queue material: a pending ownership check, a screen recording, and an implausible claim
  update social_accounts set ownership_requested_at = now() - interval '2 hours' where creator_id = 'aaaaaaaa-0000-4000-8000-000000000005' and platform = 'instagram';
  update social_accounts set screen_recording_path = 'aaaaaaaa-0000-4000-8000-000000000008/insights.mp4', screen_recording_code = 'T1-7F3K9Q', ownership_requested_at = now() - interval '5 hours' where creator_id = 'aaaaaaaa-0000-4000-8000-000000000008' and platform = 'tiktok';
  update social_accounts set avg_views = 2400000, plausibility_score = 20, flags = array['views_vs_likes', 'followers_mismatch'], public_metrics = '{"followers":21000,"avgLikes":900,"avgComments":31}' where creator_id = 'aaaaaaaa-0000-4000-8000-000000000014' and platform = 'instagram';

  -- ── 12 campaigns ──
  for camp in select * from (values
    (1, 1, 'Vitamin C Glow Serum — 30-day results', 'Vitamin C Glow Serum', 'serum', array['beauty'], 1, 2500000, 'completed', -40, 'Brightens dull skin', 'Lightweight, non-sticky', 'Fragrance-free', 'Women 22–35 in metros who want a simple routine'),
    (2, 1, 'SPF 50 Invisible Sunscreen launch', 'Invisible Sunscreen SPF 50', 'sunscreen', array['beauty', 'lifestyle'], 3, 1800000, 'in_progress', -9, 'No white cast', 'Sits under makeup', 'Sweat-resistant', 'Daily commuters who skip sunscreen because it feels heavy'),
    (3, 2, 'Masala Chai Instant Premix', 'Masala Chai Premix', 'chai', array['food', 'lifestyle'], 4, 1200000, 'live', -6, 'Real spices, no flavouring', 'Ready in 30 seconds', 'Less sugar', 'Office-goers and students who miss home chai'),
    (4, 2, 'Cold Brew Chai cans — summer drop', 'Cold Brew Chai', 'coldbrew', array['food'], 3, 1500000, 'live', 0, 'Brewed 12 hours', 'No preservatives', 'Light and refreshing', 'Gen Z looking for a cold-coffee alternative'),
    (5, 3, 'Sandstorm Running Shoes', 'Sandstorm Runner', 'shoes', array['fitness', 'fashion'], 3, 180000, 'live', -5, 'Breathable in the heat', 'Cushioned for road runs', 'Sand-resistant mesh', 'Runners in the Gulf who train outdoors'),
    (6, 3, 'Recovery Protein Date Bars', 'Protein Date Bar', 'bar', array['fitness', 'food'], 5, 120000, 'live', -3, '20g protein', 'Sweetened only with dates', 'No chalky taste', 'Gym-goers who want a clean post-workout snack'),
    (7, 4, 'Falcon Buds Pro earbuds', 'Falcon Buds Pro', 'earbuds', array['tech', 'lifestyle'], 2, 220000, 'live', -4, 'Noise cancelling', '36-hour battery', 'Clear calls', 'Commuters and remote workers'),
    (8, 4, 'MagCharge 3-in-1 travel dock', 'MagCharge Travel Dock', 'dock', array['tech'], 3, 150000, 'live', 0, 'Charges three devices', 'Folds flat', 'One cable', 'Frequent flyers with too many chargers'),
    (9, 5, 'Oud Rose Hair Mist', 'Oud Rose Hair Mist', 'mist', array['beauty'], 2, 160000, 'in_progress', -12, 'Lasts all day', 'Alcohol-free', 'Light, not oily', 'Women 20–40 who love fragrance layering'),
    (10, 5, 'Desert Dew Moisturiser', 'Desert Dew Moisturiser', 'moisturiser', array['beauty', 'lifestyle'], 3, 140000, 'live', -2, 'Hydrates for 48 hours', 'Made for dry climates', 'Absorbs fast', 'Anyone whose skin dries out in air conditioning'),
    (11, 6, 'Handloom Co-ord Sets — festive edit', 'Handloom Co-ord Set', 'coord', array['fashion'], 4, 2000000, 'live', -7, 'Handwoven cotton', 'Easy to dress up or down', 'Made by artisan clusters', 'Women 24–40 shopping for festive season'),
    (12, 1, 'Night Repair Retinol Cream', 'Night Repair Retinol Cream', 'retinol', array['beauty'], 2, 2200000, 'draft', 0, 'Beginner-friendly retinol', 'Buffers irritation', 'Visible in 4 weeks', 'Skincare beginners nervous about retinol')
  ) as x(n, b, title, product, slug, categories, needed, fee, status, age, b1, b2, b3, audience) loop
    bid := ('b0000000-0000-4000-8000-00000000000' || camp.b)::uuid;
    insert into campaigns (id, brand_id, agency_id, title, product_name, product_url, product_images, brief, shot_list, categories, countries, creators_needed, fee_per_creator_minor, currency,
      deadline, status, early_access_until, qa_required, published_at, completed_at, created_at)
    select ('c0000000-0000-4000-8000-0000000000' || lpad(camp.n::text, 2, '0'))::uuid, bid, b.agency_id, camp.title, camp.product, 'https://example.com/products/' || camp.slug,
      '{}'::text[], seed_brief(camp.product, camp.b1, camp.b2, camp.b3, camp.audience), seed_shots(camp.product, camp.b1), camp.categories, array[b.country],
      camp.needed, camp.fee, b.currency, now() + make_interval(days => 12 + camp.n), camp.status,
      case when camp.status = 'draft' then null when camp.age = 0 then now() + interval '40 hours' else now() + make_interval(days => camp.age, hours => 48) end,
      camp.n in (9, 12), case when camp.status <> 'draft' then now() + make_interval(days => camp.age) end, case when camp.status = 'completed' then now() - interval '6 days' end,
      now() + make_interval(days => camp.age, hours => -5 - camp.n)
    from brands b where b.id = bid;
    if camp.status <> 'draft' then
      insert into payments (brand_id, campaign_id, kind, provider, provider_ref, gross_minor, amount_minor, currency, status, settled_at, created_at)
      values (bid, ('c0000000-0000-4000-8000-0000000000' || lpad(camp.n::text, 2, '0'))::uuid, 'campaign', 'mock', 'mock_pi_seed_' || camp.n, camp.fee * camp.needed, camp.fee * camp.needed,
        (select currency from brands where id = bid), case when camp.status = 'completed' then 'released' else 'held' end, case when camp.status = 'completed' then now() - interval '6 days' end, now() + make_interval(days => camp.age, hours => -camp.n));
    end if;
  end loop;

  -- applicants on live/in-progress campaigns: creators from the campaign's country whose categories overlap
  insert into applications (campaign_id, creator_id, pitch, status, created_at)
  select c.id, cr.profile_id, 'I already use products like this daily and can shoot this week.', case when row_number() over (partition by c.id order by cr.win_rate desc) = 2 then 'shortlisted' else 'applied' end, now() - make_interval(hours => (row_number() over ())::int * 3)
  from campaigns c join creators cr on cr.categories && c.categories join profiles p on p.id = cr.profile_id and p.country = any (c.countries)
  where c.status in ('live', 'in_progress') and cr.profile_id <> hero and (c.early_access_until <= now() or cr.tier = 'pro');
  -- hero: invited to the running shoes? no — invited to chai (same country), and has used 1 of 3 weekly applications as context for the free demo creator
  insert into applications (campaign_id, creator_id, status, invited, invited_at) values ('c0000000-0000-4000-8000-000000000003', hero, 'invited', true, now() - interval '5 hours');
  insert into applications (campaign_id, creator_id, pitch, status, created_at) values
    ('c0000000-0000-4000-8000-000000000011', 'aaaaaaaa-0000-4000-8000-000000000004', 'Festive looks are my whole feed.', 'applied', now() - interval '1 day') on conflict do nothing;

  -- ── assignments ──
  -- a1: hero, campaign 1 — complete end to end. a2: hero, campaign 2 — accepted, ready to shoot (live demo of the Variant Engine)
  -- a3: creator 5, campaign 2 — delivered, waiting for the brand to select. a4: creator 2, campaign 9 (agency) — in the admin QA queue
  insert into applications (campaign_id, creator_id, pitch, status, created_at) values
    ('c0000000-0000-4000-8000-000000000001', hero, 'Vitamin C is my whole personality.', 'accepted', now() - interval '38 days'),
    ('c0000000-0000-4000-8000-000000000002', hero, 'SPF every single day — happy to show it.', 'accepted', now() - interval '8 days')
    on conflict (campaign_id, creator_id) do update set status = 'accepted';
  update applications set status = 'accepted' where (campaign_id, creator_id) in (('c0000000-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000005'), ('c0000000-0000-4000-8000-000000000009', 'aaaaaaaa-0000-4000-8000-000000000002'));
  insert into applications (campaign_id, creator_id, status) values ('c0000000-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000005', 'accepted'), ('c0000000-0000-4000-8000-000000000009', 'aaaaaaaa-0000-4000-8000-000000000002', 'accepted') on conflict do nothing;
  insert into assignments (campaign_id, creator_id, status, due_at, submitted_at, delivered_at, approved_at, created_at, post_url, posted_at)
    values ('c0000000-0000-4000-8000-000000000001', hero, 'completed', now() - interval '10 days', now() - interval '16 days', now() - interval '15 days', now() - interval '14 days', now() - interval '36 days', 'https://www.instagram.com/reel/C8demoTakeOne/', now() - interval '12 days') returning id into a1;
  insert into assignments (campaign_id, creator_id, status, due_at, created_at) values ('c0000000-0000-4000-8000-000000000002', hero, 'accepted', now() + interval '9 days', now() - interval '2 days') returning id into a2;
  insert into assignments (campaign_id, creator_id, status, due_at, submitted_at, delivered_at, created_at) values ('c0000000-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000005', 'delivered', now() + interval '9 days', now() - interval '1 day', now() - interval '20 hours', now() - interval '6 days') returning id into a3;
  insert into assignments (campaign_id, creator_id, status, due_at, submitted_at, created_at) values ('c0000000-0000-4000-8000-000000000009', 'aaaaaaaa-0000-4000-8000-000000000002', 'qa_review', now() + interval '5 days', now() - interval '3 hours', now() - interval '8 days') returning id into a4;
  insert into likeness_consents (creator_id, campaign_id) values (hero, 'c0000000-0000-4000-8000-000000000001'), (hero, 'c0000000-0000-4000-8000-000000000002'), ('aaaaaaaa-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000002');

  -- takes + variants. Files live at variants/{take_id}/{format}/{clean|preview}_{aspect}.mp4 (uploaded by `pnpm samples`).
  for r in select * from (values (1, a1, hero, 'licensed'), (2, a3, 'aaaaaaaa-0000-4000-8000-000000000005'::uuid, 'delivered'), (3, a4, 'aaaaaaaa-0000-4000-8000-000000000002'::uuid, 'qa_pending')) as x(n, aid, creator, st) loop
    t := ('7a000000-0000-4000-8000-00000000000' || r.n)::uuid;
    insert into takes (id, assignment_id, storage_path, duration, product_check, product_check_reason, dub_language, transcript, created_at)
    values (t, r.aid, r.creator || '/seed-take.mp4', 24, 'passed', 'Product label clearly visible in 4 of 5 sampled frames.', 'hi',
      '{"language":"en","text":"Okay so my skin used to look really tired by the afternoon. I have been using this serum every morning for thirty days. It is lightweight, it is not sticky, and it sits well under sunscreen. Honestly my skin looks brighter and I would buy it again."}', now() - interval '17 days');
    foreach fmt in array fmts loop
      insert into variants (take_id, format, storage_path, renditions, preview_renditions, thumbnail, hook_text, hook_options, score, score_reason, is_synthetic, ai_disclosure, language, visible_to_brand, status)
      values (t, fmt, null, '{}'::jsonb, '{}'::jsonb,
        null, hooks -> fmt ->> 0, array(select jsonb_array_elements_text(hooks -> fmt)), (scores ->> fmt)::int,
        case fmt when 'hook_first' then 'Problem lands in 1.4s, hook is 8 words, product on screen by 0:04. Strong brief fit.' when 'testimonial_tight' then 'Clean verdict kept word for word; filler removed. Slightly slow first line.'
          when 'day_in_life' then 'Scene suits the audience; foreground untouched. Hook is softer than Hook First.' when 'silent_montage' then 'Reads well muted; one caption card runs long.' else 'Faithful Hindi translation of the verdict; captions match.' end,
        fmt in ('day_in_life', 'language_version'), case when fmt in ('day_in_life', 'language_version') then 'Enable the platform’s AI-info label when publishing' end, case when fmt = 'language_version' then 'hi' end,
        r.st <> 'qa_pending' and not (r.n = 1 and fmt = 'language_version'),
        case when r.n = 1 then (case when fmt in ('hook_first', 'testimonial_tight', 'day_in_life') then 'licensed' when fmt = 'silent_montage' then 'delivered' else 'ready' end) else r.st end);
    end loop;
    insert into variants (take_id, format, status) select t, f, 'coming_soon' from unnest(soon) f;
  end loop;
  delete from jobs;

  -- ── complete campaign money: 3 base licenses + a renewal-soon one, review, ledger in every state ──
  insert into licenses (variant_id, brand_id, campaign_id, type, starts_at, ends_at, price_minor, currency)
    select v.id, 'b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'base', now() - interval '40 days', now() + interval '5 days', 0, 'INR'
    from variants v where v.take_id = '7a000000-0000-4000-8000-000000000001' and v.status = 'licensed';
  update assignments set winning_variant_id = (select id from variants where take_id = '7a000000-0000-4000-8000-000000000001' and format = 'hook_first') where id = a1;
  insert into payments (brand_id, campaign_id, kind, provider, provider_ref, gross_minor, amount_minor, currency, status, settled_at, metadata, created_at)
    values ('b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'license', 'mock', 'mock_pi_seed_wl', 750000, 750000, 'INR', 'released', now() - interval '2 days', '{"type":"whitelist"}', now() - interval '2 days') returning id into pay;
  insert into licenses (variant_id, brand_id, campaign_id, type, starts_at, ends_at, price_minor, currency, payment_id)
    select id, 'b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'whitelist', now() - interval '2 days', now() + interval '43 days', 750000, 'INR', pay
    from variants where take_id = '7a000000-0000-4000-8000-000000000001' and format = 'hook_first' returning id into lic;
  insert into reviews (assignment_id, rating, comment) values (a1, 5, 'Delivered early, variants were on-brief. Hook First is running as our top ad.');
  insert into withdrawals (creator_id, method, destination, amount_minor, currency, status, provider_ref, created_at) values (hero, 'upi', '{"upi_id":"priya@okhdfc"}', 1200000, 'INR', 'paid', 'mock_po_seed', now() - interval '20 days') returning id into w;
  insert into ledger_entries (creator_id, source, amount_minor, currency, state, cleared_at, available_at, campaign_id, assignment_id, license_id, payment_id, withdrawal_id, description, created_at) values
    (hero, 'campaign', 1200000, 'INR', 'withdrawn', now() - interval '50 days', now() - interval '47 days', null, null, null, null, w, 'Hydra Lip Tint launch', now() - interval '60 days'),
    (hero, 'campaign', 1875000, 'INR', 'available', now() - interval '14 days', now() - interval '11 days', 'c0000000-0000-4000-8000-000000000001', a1, null, null, null, 'Vitamin C Glow Serum — 30-day results', now() - interval '36 days'),
    (hero, 'license', 562500, 'INR', 'cleared', now() - interval '2 days', now() + interval '1 day', 'c0000000-0000-4000-8000-000000000001', a1, lic, pay, null, 'Partnership ad · Vitamin C Glow Serum — 30-day results', now() - interval '2 days'),
    (hero, 'campaign', 1350000, 'INR', 'pending', null, null, 'c0000000-0000-4000-8000-000000000002', a2, null, null, null, 'SPF 50 Invisible Sunscreen launch', now() - interval '2 days'),
    ('aaaaaaaa-0000-4000-8000-000000000005', 'campaign', 1350000, 'INR', 'pending', null, null, 'c0000000-0000-4000-8000-000000000002', a3, null, null, null, 'SPF 50 Invisible Sunscreen launch', now() - interval '6 days'),
    ('aaaaaaaa-0000-4000-8000-000000000002', 'campaign', 120000, 'AED', 'pending', null, null, 'c0000000-0000-4000-8000-000000000009', a4, null, null, null, 'Oud Rose Hair Mist', now() - interval '8 days');
  update creators set kyc_status = 'verified' where profile_id = hero;

  -- ── messages (one masked), notifications, a dispute ──
  insert into messages (campaign_id, creator_id, sender_id, body_masked, had_masking, created_at) values
    ('c0000000-0000-4000-8000-000000000002', hero, 'bbbbbbbb-0000-4000-8000-000000000001', 'Hi Priya! Your sunscreen ships today. Please show it under makeup if you can.', false, now() - interval '30 hours'),
    ('c0000000-0000-4000-8000-000000000002', hero, hero, 'Perfect — I will shoot in morning light this weekend.', false, now() - interval '29 hours'),
    ('c0000000-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000005', 'aaaaaaaa-0000-4000-8000-000000000005', 'Can we discuss rates? ••• or ••• on ••• ', true, now() - interval '26 hours');
  insert into masking_attempts (profile_id, campaign_id, kinds, created_at) select 'aaaaaaaa-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000002', array['phrase', 'phone'], now() - make_interval(hours => 26 + g) from generate_series(0, 2) g;
  update creators set masking_attempts = 3, flagged = true where profile_id = 'aaaaaaaa-0000-4000-8000-000000000005';
  insert into notifications (profile_id, type, title, body, data, created_at) values
    (hero, 'accepted', 'You''re in: SPF 50 Invisible Sunscreen launch', 'Open the campaign to see your shot list and start shooting.', jsonb_build_object('assignment_id', a2), now() - interval '2 days'),
    (hero, 'invite', 'Invitation: Masala Chai Instant Premix', 'A brand invited you directly. Respond within 48 hours.', '{"campaign_id":"c0000000-0000-4000-8000-000000000003"}', now() - interval '5 hours'),
    ('bbbbbbbb-0000-4000-8000-000000000001', 'delivered', 'New variants to review', 'SPF 50 Invisible Sunscreen launch', jsonb_build_object('assignment_id', a3), now() - interval '20 hours');
  insert into disputes (assignment_id, opened_by, reason, created_at) values (a3, 'aaaaaaaa-0000-4000-8000-000000000005', 'Product arrived 4 days late; asking for a deadline extension.', now() - interval '3 days');
  insert into audit_log (action, entity, entity_id, data) values ('seed', 'database', 'demo', '{}');
end $$;

drop function public.seed_user(uuid, text, text, text);
drop function public.seed_brief(text, text, text, text, text);
drop function public.seed_shots(text, text);
select public.refresh_leaderboards();
