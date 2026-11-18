-- RLS and age rules for profiles, binders, binder slots and card marks.
-- Run: npx supabase test db (local, needs Docker) — CI runs it on every PR.
begin;
select plan(25);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'adult@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'minor@test.local');
insert into public.groups (id, name, monogram, color, status) values ('t-g', 'Test', 'T', 'cobalt', 'approved');
insert into public.members (id, group_id, name, status) values ('t-m', 't-g', 'Uno', 'approved');
insert into public.releases (id, group_id, title, kind, year, era_color, status)
  values ('t-r', 't-g', 'Era', 'album', 2025, 'mint', 'approved');
insert into public.cards (id, group_id, member_id, release_id, type, year, status)
  values ('t-c', 't-g', 't-m', 't-r', 'album', 2025, 'approved');

-- Signed-out visitors see nothing.
set local role anon;
select throws_ok($$select 1 from public.profiles$$, '42501', null, 'anon cannot read profiles');
select throws_ok($$select 1 from public.user_cards$$, '42501', null, 'anon cannot read marks');

-- User A (adult).
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

select lives_ok(
  $$insert into public.profiles (birth_date, country, subdivision) values (current_date - interval '30 years', 'ES', 'ES-VC')$$,
  'adult creates own profile');
select throws_ok(
  $$insert into public.profiles (id, birth_date, country) values ('00000000-0000-0000-0000-00000000000b', '1990-01-01', 'ES')$$,
  '42501', null, 'cannot create a profile for someone else');
select is((select public.is_minor(p) from public.profiles p), false, 'adult is not a minor');
select throws_ok($$update public.profiles set role = 'admin'$$, '42501', null, 'cannot make self admin');
select throws_ok($$update public.profiles set birth_date = '2015-01-01'$$, '42501', null, 'birth date is fixed');
select throws_ok($$update public.profiles set subdivision = 'MX-CMX'$$, '23514', null, 'subdivision must match country');
select lives_ok($$update public.profiles set username = 'luna', in_person_ok = true$$, 'adult may hand over in person');
select throws_ok($$update public.profiles set username = 'Luna!'$$, '23514', null, 'username format enforced');

select lives_ok(
  $$insert into public.binders (id, title, kind) values ('00000000-0000-0000-0000-0000000000b1', 'Mi binder', 'era')$$,
  'creates own binder');
select lives_ok(
  $$insert into public.binder_slots (binder_id, position, card_id) values ('00000000-0000-0000-0000-0000000000b1', 0, 't-c')$$,
  'fills a slot in own binder');
select lives_ok(
  $$select public.set_binder_slots('00000000-0000-0000-0000-0000000000b1', array['t-c', 't-c'])$$,
  'replaces the whole order of own binder');
select is((select array_agg(position order by position) from public.binder_slots), array[0, 1],
  'order saved as flat positions');
select lives_ok(
  $$insert into public.user_cards (card_id, status) values ('t-c', 'have')
    on conflict (user_id, card_id) do update set card_id = excluded.card_id, status = excluded.status$$,
  'upserts own mark');
select throws_ok(
  $$insert into public.user_cards (user_id, card_id, status) values ('00000000-0000-0000-0000-00000000000b', 't-c', 'want')$$,
  '42501', null, 'cannot write marks for someone else');

-- User B (15 years old).
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);

select throws_ok(
  $$insert into public.profiles (birth_date, country) values (current_date - interval '13 years', 'ES')$$,
  '23514', null, 'under minimum age never gets a profile');
select lives_ok(
  $$insert into public.profiles (birth_date, country) values (current_date - interval '15 years', 'ES')$$,
  'minor over minimum age creates a profile');
select is((select public.is_minor(p) from public.profiles p), true, 'minor is flagged');
select throws_ok($$update public.profiles set in_person_ok = true$$, '23514', null, 'no in-person handovers for minors');
select is((select count(*) from public.profiles), 1::bigint, 'sees only own profile');
select is((select count(*) from public.binders) + (select count(*) from public.binder_slots)
  + (select count(*) from public.user_cards), 0::bigint, 'sees no one else''s binders, slots or marks');
select throws_ok(
  $$insert into public.binder_slots (binder_id, position, card_id) values ('00000000-0000-0000-0000-0000000000b1', 1, 't-c')$$,
  '42501', null, 'cannot add slots to someone else''s binder');
select throws_ok(
  $$select public.set_binder_slots('00000000-0000-0000-0000-0000000000b1', array['t-c'])$$,
  '42501', null, 'cannot rewrite someone else''s binder order');

-- Account deletion cascades through binders and slots without errors.
reset role;
select lives_ok($$delete from auth.users where id = '00000000-0000-0000-0000-00000000000a'$$, 'deleting a user removes their data');

select * from finish();
rollback;
