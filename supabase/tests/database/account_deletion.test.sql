-- Account deletion: request, cancel, 14-day purge and who may run it.
begin;
select plan(8);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000d1', 'leaving@test.local'),
  ('00000000-0000-0000-0000-0000000000d2', 'staying@test.local');
insert into public.profiles (id, birth_date, country) values
  ('00000000-0000-0000-0000-0000000000d1', '1990-01-01', 'ES'),
  ('00000000-0000-0000-0000-0000000000d2', '1990-01-01', 'ES');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);

select is((select public.request_account_deletion()::date), (now() + interval '14 days')::date,
  'returns the deletion date, 14 days ahead');
select isnt((select deletion_requested_at from public.profiles), null, 'request is recorded');
select throws_ok($$update public.profiles set deletion_requested_at = '2000-01-01'$$, '42501', null,
  'cannot backdate the request');
select lives_ok($$select public.cancel_account_deletion()$$, 'cancels by signing in again');
select is((select deletion_requested_at from public.profiles), null, 'request cleared');
select throws_ok($$select public.purge_deleted_accounts()$$, '42501', null, 'users cannot run the purge');

reset role;
update public.profiles set deletion_requested_at = now() - interval '15 days'
  where id = '00000000-0000-0000-0000-0000000000d1';
update public.profiles set deletion_requested_at = now() - interval '13 days'
  where id = '00000000-0000-0000-0000-0000000000d2';
select is(public.purge_deleted_accounts(), 1, 'purges only requests older than 14 days');
select is((select array_agg(email order by email) from auth.users where email like '%@test.local'),
  array['staying@test.local']::varchar[], 'the 13-day request is kept');

select * from finish();
rollback;
