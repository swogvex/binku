-- Acceptance (08-spec-matches-home): matching for 5,000 users × 300 cards stays cheap.
-- Builds the data inside the transaction (rolled back) and times one user's get_matches().
begin;
select plan(1);

insert into public.groups (id, name, monogram, color, status) values ('p-g', 'Perf', 'P', 'cobalt', 'approved');
insert into public.members (id, group_id, name, status) values ('p-m', 'p-g', 'Uno', 'approved');
insert into public.releases (id, group_id, title, kind, year, era_color, status)
  values ('p-r', 'p-g', 'Era', 'album', 2025, 'mint', 'approved');
insert into public.cards (id, group_id, member_id, release_id, type, year, status)
select 'p-c' || i, 'p-g', 'p-m', 'p-r', 'album', 2025, 'approved' from generate_series(1, 1000) i;

insert into auth.users (id, email)
select ('00000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid, 'p' || i || '@test.local'
from generate_series(1, 5000) i;
insert into public.profiles (id, username, birth_date, country, subdivision)
select ('00000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid, 'p' || i, '1990-01-01', 'ES',
  (array['ES-V', 'ES-M', 'ES-B', 'ES-SE'])[1 + i % 4]
from generate_series(1, 5000) i;
-- 300 cards each (a window of the 1,000), a third Busco, a third Repetida, a third Tengo.
insert into public.user_cards (user_id, card_id, status)
select ('00000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid,
  'p-c' || (1 + (i * 37 + k) % 1000),
  (array['want', 'dupe', 'have'])[1 + (i + k) % 3]::public.mark_status
from generate_series(1, 5000) i, generate_series(1, 300) k;
analyze public.user_cards;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;

create temp table t (ms numeric) on commit drop;
do $$
declare started timestamptz := clock_timestamp(); n int;
begin
  select count(*) into n from public.get_matches();
  insert into t values (extract(epoch from clock_timestamp() - started) * 1000);
  raise notice 'get_matches: % rows in % ms', n, (select ms from t);
end $$;

-- Generous bound for a shared CI runner; the free tier (Nano) should land in the same order.
select cmp_ok((select ms from t), '<', 3000::numeric, 'one user''s matches in under 3 s');

select * from finish();
rollback;
