-- Offers, matching (mutual only, scopes, ranking) and the username blocklist.
begin;
select plan(22);

insert into public.country_config (country, launched, min_age) values ('MX', true, 14), ('PT', true, 14);
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'a@test.local'),
  ('00000000-0000-0000-0000-0000000000b1', 'b@test.local'),
  ('00000000-0000-0000-0000-0000000000c1', 'c@test.local'),
  ('00000000-0000-0000-0000-0000000000d1', 'd@test.local'),
  ('00000000-0000-0000-0000-0000000000e1', 'e@test.local'),
  ('00000000-0000-0000-0000-0000000000f1', 'f@test.local'),
  ('00000000-0000-0000-0000-0000000000a9', 'g@test.local');
insert into public.groups (id, name, monogram, color, status) values ('m-g', 'Test', 'T', 'cobalt', 'approved');
insert into public.members (id, group_id, name, status) values ('m-m', 'm-g', 'Uno', 'approved');
insert into public.releases (id, group_id, title, kind, year, era_color, status)
  values ('m-r', 'm-g', 'Era', 'album', 2025, 'mint', 'approved');
insert into public.cards (id, group_id, member_id, release_id, type, year, status)
select 'm-c' || i, 'm-g', 'm-m', 'm-r', 'album', 2025, 'approved' from generate_series(1, 4) i;

-- a: Valencia, wants c1, spare c2. b: Valencia, mutual. c: Madrid, mutual. g: Madrid, one way only.
-- d: Mexico, international, mutual. e: Portugal, region scope, mutual. f: no @username yet.
insert into public.profiles (id, username, birth_date, country, subdivision, match_scope) values
  ('00000000-0000-0000-0000-0000000000a1', 'ana', '1990-01-01', 'ES', 'ES-VC', 'country'),
  ('00000000-0000-0000-0000-0000000000b1', 'bea', '1990-01-01', 'ES', 'ES-VC', 'country'),
  ('00000000-0000-0000-0000-0000000000c1', 'carla', '1990-01-01', 'ES', 'ES-MD', 'country'),
  ('00000000-0000-0000-0000-0000000000d1', 'dani', '1990-01-01', 'MX', 'MX-CMX', 'international'),
  ('00000000-0000-0000-0000-0000000000e1', 'eva', '1990-01-01', 'PT', 'PT-11', 'region'),
  ('00000000-0000-0000-0000-0000000000f1', null, '1990-01-01', 'ES', 'ES-VC', 'international'),
  ('00000000-0000-0000-0000-0000000000a9', 'gala', '1990-01-01', 'ES', 'ES-MD', 'country');
insert into public.user_cards (user_id, card_id, status) values
  ('00000000-0000-0000-0000-0000000000a1', 'm-c1', 'want'),
  ('00000000-0000-0000-0000-0000000000a1', 'm-c2', 'dupe'),
  ('00000000-0000-0000-0000-0000000000b1', 'm-c1', 'dupe'),
  ('00000000-0000-0000-0000-0000000000b1', 'm-c2', 'want'),
  ('00000000-0000-0000-0000-0000000000c1', 'm-c1', 'dupe'),
  ('00000000-0000-0000-0000-0000000000c1', 'm-c2', 'want'),
  ('00000000-0000-0000-0000-0000000000d1', 'm-c1', 'dupe'),
  ('00000000-0000-0000-0000-0000000000d1', 'm-c2', 'want'),
  ('00000000-0000-0000-0000-0000000000e1', 'm-c1', 'dupe'),
  ('00000000-0000-0000-0000-0000000000e1', 'm-c2', 'want'),
  ('00000000-0000-0000-0000-0000000000f1', 'm-c1', 'dupe'),
  ('00000000-0000-0000-0000-0000000000f1', 'm-c2', 'want'),
  ('00000000-0000-0000-0000-0000000000a9', 'm-c1', 'dupe');
insert into public.user_cards (user_id, card_id, status, deleted_at) values
  ('00000000-0000-0000-0000-0000000000a9', 'm-c2', 'want', now());

set local role anon;
select throws_ok($$select * from public.get_matches()$$, '42501', null, 'anon cannot list matches');

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);

select is(array(select username from public.get_matches()),
  array['bea', 'carla'], 'Mi país: same subdivision first, no foreigners, no users without @username');
select is((select kind from public.get_matches() where username = 'bea'), 'double', 'both ways = double');
select is((select they_give from public.get_matches() where username = 'bea'), array['m-c1'], 'what she gives me');
select is((select you_give from public.get_matches() where username = 'bea'), array['m-c2'], 'what I give her');
select is((select count(*)::int from public.get_matches() where username = 'gala'), 0,
  'one way = no match (deleted marks ignored)');

update public.profiles set match_scope = 'region';
select is((select array_agg(username order by proximity, username) from public.get_matches()),
  array['bea', 'carla', 'eva'], 'Mi región adds EU users whose own scope accepts it');
update public.profiles set match_scope = 'international';
select is((select count(*)::int from public.get_matches() where username = 'dani'), 1,
  'Internacional adds Mexico (both international)');
select is((select count(*)::int from public.get_matches() where username = 'eva'), 1,
  'region-scoped EU user still visible to an EU user');
update public.profiles set match_scope = 'zone';
select is(array(select username from public.get_matches()), array['bea'], 'Mi zona = same subdivision only');

-- Offers
select lives_ok($$update public.user_cards set offer = 'sale', price_cents = 500 where card_id = 'm-c2'$$,
  'spare offered for sale with a price');
select throws_ok($$update public.user_cards set offer = 'trade' where card_id = 'm-c2'$$, '23514', null,
  'no price on trade-only offers');
select throws_ok($$update public.user_cards set handover = 'in_person' where card_id = 'm-c2'$$, '23514', null,
  'in person needs in_person_ok');
select lives_ok($$update public.profiles set in_person_ok = true$$, 'adult turns in person on');
select lives_ok($$update public.user_cards set handover = 'both' where card_id = 'm-c2'$$, 'offers in person');
update public.profiles set in_person_ok = false;
select is((select handover::text from public.user_cards where card_id = 'm-c2'), 'ship',
  'turning in person off moves offers back to shipping');

-- Username blocklist
select throws_ok($$update public.profiles set username = 'admin_luna'$$, 'BK001', null, 'reserved prefix');
select throws_ok($$update public.profiles set username = 'luna.puta'$$, 'BK001', null, 'insult as a word');
select throws_ok($$update public.profiles set username = 'xfuckx'$$, 'BK001', null, 'unambiguous word anywhere');
select lives_ok($$update public.profiles set username = 'computadora'$$, 'innocent word containing one is fine');
select lives_ok($$update public.profiles set username = 'pedro_99'$$, 'pedro is not pedo');
select throws_ok($$select * from public.blocked_usernames$$, '42501', null, 'blocklist is not readable');

select * from finish();
rollback;
