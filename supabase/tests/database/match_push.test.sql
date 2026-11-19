-- Devices, quiet hours and the match-notice queue behind push notifications.
begin;
select plan(14);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a2', 'a2@test.local'),
  ('00000000-0000-0000-0000-0000000000b2', 'b2@test.local'),
  ('00000000-0000-0000-0000-0000000000c2', 'c2@test.local');
insert into public.groups (id, name, monogram, color, status) values ('n-g', 'Test', 'T', 'cobalt', 'approved');
insert into public.members (id, group_id, name, status) values ('n-m', 'n-g', 'Uno', 'approved');
insert into public.releases (id, group_id, title, kind, year, era_color, status)
  values ('n-r', 'n-g', 'Era', 'album', 2025, 'mint', 'approved');
insert into public.cards (id, group_id, member_id, release_id, type, year, status)
select 'n-c' || i, 'n-g', 'n-m', 'n-r', 'album', 2025, 'approved' from generate_series(1, 2) i;
insert into public.profiles (id, username, birth_date, country, subdivision, notify_matches) values
  ('00000000-0000-0000-0000-0000000000a2', 'alba', '1990-01-01', 'ES', 'ES-V', true),
  ('00000000-0000-0000-0000-0000000000b2', 'bea', '1990-01-01', 'ES', 'ES-V', true),
  ('00000000-0000-0000-0000-0000000000c2', 'cris', current_date - interval '15 years', 'ES', 'ES-V', true);
insert into public.user_cards (user_id, card_id, status) values
  ('00000000-0000-0000-0000-0000000000a2', 'n-c1', 'want'),
  ('00000000-0000-0000-0000-0000000000a2', 'n-c2', 'dupe'),
  ('00000000-0000-0000-0000-0000000000b2', 'n-c1', 'dupe'),
  ('00000000-0000-0000-0000-0000000000b2', 'n-c2', 'want');

-- Quiet hours
select is(public.in_quiet_hours(p, 'Europe/Madrid', '2026-01-15 23:30+01'), false, 'adults: off by default')
  from public.profiles p where username = 'alba';
select is(public.in_quiet_hours(p, 'Europe/Madrid', '2026-01-15 23:30+01'), true, 'minors: country default at night')
  from public.profiles p where username = 'cris';
select is(public.in_quiet_hours(p, 'Europe/Madrid', '2026-01-15 12:00+01'), false, 'minors: daytime is fine')
  from public.profiles p where username = 'cris';
update public.profiles set quiet_hours = '13:00-14:00' where username = 'alba';
select is(public.in_quiet_hours(p, 'Europe/Madrid', '2026-01-15 13:30+01'), true, 'own window respected')
  from public.profiles p where username = 'alba';
update public.profiles set quiet_hours = null where username = 'alba';

-- Devices
set local role anon;
select throws_ok($$select public.register_device('ExponentPushToken[x]', 'android', 'es', 'Europe/Madrid')$$,
  '42501', null, 'anon cannot register a device');
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
select lives_ok($$select public.register_device('ExponentPushToken[shared]', 'android', 'es', 'Europe/Madrid')$$,
  'bea registers her phone');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
select throws_ok($$select public.register_device('not a token', 'android', 'es', 'Europe/Madrid')$$,
  '23514', null, 'only Expo push tokens');
select lives_ok($$select public.register_device('ExponentPushToken[shared]', 'android', 'en', 'Mars/Base')$$,
  'alba signs in on the same phone');
select is((select count(*)::int from public.devices), 1, 'the token moved to alba (bea no longer sees it)');
select throws_ok($$select public.queue_match_notices()$$, '42501', null, 'users cannot run the queue');
select throws_ok($$select * from public.match_notices$$, '42501', null, 'notices are not readable');

-- Queue and messages (as the cron job)
reset role;
select set_config('request.jwt.claims', '', true);
select is(public.queue_match_notices(), 2, 'one double, announced to both people');
select is(public.queue_match_notices(), 0, 'nothing new on the next run');
select is(
  (select messages -> 0 ->> 'body' from public.due_match_pushes() where user_id = '00000000-0000-0000-0000-0000000000a2'),
  'New double match with @bea', 'alba gets an instant push in her phone''s language');

select * from finish();
rollback;
