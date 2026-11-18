-- Photos: who can read/remove, upload rules (retry, replace, quota, rate, cap), purge, takedown,
-- and the Google name/avatar strip.
begin;
select plan(23);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000e1', 'snap@test.local'),
  ('00000000-0000-0000-0000-0000000000e2', 'other@test.local');
insert into public.profiles (id, birth_date, country) values
  ('00000000-0000-0000-0000-0000000000e1', '1990-01-01', 'ES'),
  ('00000000-0000-0000-0000-0000000000e2', '1990-01-01', 'ES');
insert into public.groups (id, name, monogram, color, status) values ('p-g', 'Test', 'T', 'cobalt', 'approved');
insert into public.members (id, group_id, name, status) values ('p-m', 'p-g', 'Uno', 'approved');
insert into public.releases (id, group_id, title, kind, year, era_color, status)
  values ('p-r', 'p-g', 'Album', 'album', 2024, 'cobalt', 'approved');
insert into public.cards (id, group_id, member_id, release_id, type, year, status)
  select 'p-c' || i, 'p-g', 'p-m', 'p-r', 'album', 2024, 'approved' from generate_series(1, 3) i;

-- Uploads (service role path)
select is(public.begin_photo_upload('00000000-0000-0000-0000-0000000000e1',
  '00000000-0000-0000-0000-00000000f001', 'p-c1', 'scan', 40000), 'ok', 'first upload is accepted');
select is(public.begin_photo_upload('00000000-0000-0000-0000-0000000000e1',
  '00000000-0000-0000-0000-00000000f001', 'p-c1', 'scan', 41000), 'ok', 'a retry with the same id is ok');
select is((select count(*)::int from public.photos), 1, 'a retry does not add a row');
select is(public.begin_photo_upload('00000000-0000-0000-0000-0000000000e2',
  '00000000-0000-0000-0000-00000000f001', 'p-c1', 'scan', 40000), 'conflict', 'another user cannot reuse an id');
select is(public.begin_photo_upload('00000000-0000-0000-0000-0000000000e1',
  '00000000-0000-0000-0000-00000000f002', 'p-c1', 'scan', 40000), 'ok', 'a new scan of the same card');
select is((select removed_reason from public.photos where id = '00000000-0000-0000-0000-00000000f001'),
  'replaced', 'the new scan replaces the old one');
select throws_ok($$select public.begin_photo_upload('00000000-0000-0000-0000-0000000000e1',
  '00000000-0000-0000-0000-00000000f003', 'p-c2', 'scan', 400000)$$, '23514', null, 'files over 300 KB are refused');

-- Quota: 1,000 cards with photo (fake 999 more cards' worth of rows for user e2)
insert into public.cards (id, group_id, member_id, release_id, type, year, status)
  select 'q-c' || i, 'p-g', 'p-m', 'p-r', 'album', 2024, 'approved' from generate_series(1, 1001) i;
insert into public.photos (id, user_id, card_id, kind, r2_key, bytes, created_at)
  select gen_random_uuid(), '00000000-0000-0000-0000-0000000000e2', 'q-c' || i, 'scan', 'k' || i, 1000,
    now() - interval '2 hours' from generate_series(1, 1000) i;
select is(public.begin_photo_upload('00000000-0000-0000-0000-0000000000e2',
  gen_random_uuid(), 'q-c1001', 'scan', 1000), 'quota', 'card 1,001 is over the quota');
select is(public.begin_photo_upload('00000000-0000-0000-0000-0000000000e2',
  gen_random_uuid(), 'q-c1', 'condition_front', 1000), 'ok', 'a card that already has a photo still fits');

-- Rate limit: 120 new photos per hour
update public.photos set created_at = now() where user_id = '00000000-0000-0000-0000-0000000000e2';
select is(public.begin_photo_upload('00000000-0000-0000-0000-0000000000e2',
  gen_random_uuid(), 'q-c2', 'condition_back', 1000), 'rate', 'too many uploads in an hour');
update public.photos set created_at = now() - interval '2 hours' where user_id = '00000000-0000-0000-0000-0000000000e2';

-- Global cap (90 % of 10 GB)
update public.photos set bytes = 300000 where user_id = '00000000-0000-0000-0000-0000000000e2';
insert into public.photos (id, user_id, card_id, kind, r2_key, bytes, created_at)
  select gen_random_uuid(), null, 'p-c3', 'scan', 'cap' || i, 300000, now() - interval '40 days'
  from generate_series(1, 29000) i;
select is(public.begin_photo_upload('00000000-0000-0000-0000-0000000000e1',
  gen_random_uuid(), 'p-c3', 'scan', 1000), 'paused', 'uploads pause at 90 % of the free storage');
delete from public.photos where r2_key like 'cap%';
select is(public.begin_photo_upload('00000000-0000-0000-0000-0000000000e1',
  '00000000-0000-0000-0000-00000000f004', 'p-c2', 'scan', 30000), 'ok', 'uploads resume below the cap');

-- Client access
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}', true);
select is((select count(*)::int from public.photos), 3, 'users see only their own photos');
select throws_ok($$select public.begin_photo_upload('00000000-0000-0000-0000-0000000000e1',
  gen_random_uuid(), 'p-c2', 'scan', 1000)$$, '42501', null, 'clients cannot register uploads');
select throws_ok($$insert into public.photos (id, card_id, kind, r2_key, bytes)
  values (gen_random_uuid(), 'p-c2', 'scan', 'x', 1)$$, '42501', null, 'clients cannot insert photos');
update public.photos set removed_at = now() where id = '00000000-0000-0000-0000-00000000f002';
select is((select removed_reason from public.photos where id = '00000000-0000-0000-0000-00000000f002'),
  'user', 'users can remove their photo');
select throws_ok($$update public.photos set r2_key = 'evil'$$, '42501', null, 'users cannot change anything else');
select throws_ok($$select public.takedown_photo('00000000-0000-0000-0000-00000000f002', gen_random_uuid())$$,
  '42501', null, 'only admins act on takedowns');
reset role;

-- Takedown requests (anyone)
set local role anon;
select lives_ok($$select public.request_takedown('rights@test.local', 'https://binku.app/x', 'This is my own photo')$$,
  'anyone can send a takedown request');
select throws_ok($$select * from public.takedown_requests$$, '42501', null, 'requests are private');
reset role;

-- Account purge → photos queued for R2 deletion, rows gone after the purge
delete from auth.users where id = '00000000-0000-0000-0000-0000000000e1';
select is((select array_agg(distinct removed_reason) from public.photos where user_id is null and card_id like 'p-c%'),
  array['account', 'replaced', 'user'], 'a purged account''s photos are queued (reasons kept)');
select public.mark_photos_purged(array(select id from public.photos_to_purge(5000)));
select is((select count(*)::int from public.photos where user_id is null), 0, 'purged rows of deleted accounts are gone');

-- Google name/avatar never stored
insert into auth.users (id, email, raw_user_meta_data) values ('00000000-0000-0000-0000-0000000000e3',
  'g@test.local', '{"name":"Jane Roe","picture":"https://x/y.png","email":"g@test.local","email_verified":true}');
select is((select raw_user_meta_data from auth.users where id = '00000000-0000-0000-0000-0000000000e3'),
  '{"email":"g@test.local","email_verified":true}'::jsonb, 'Google name and avatar are dropped');

select * from finish();
rollback;
