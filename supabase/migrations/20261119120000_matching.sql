-- M5: card offers, regions, matching and a username blocklist (08-spec-matches-home,
-- 25-international, 06-content-model). Matches are computed on read for the signed-in user:
-- always fresh, nothing to keep in sync. Other users are only seen through get_matches(), which
-- returns @username, country and subdivision — never birth date or anything else.

-- Offers ---------------------------------------------------------------------------------------
create type public.offer_mode as enum ('trade', 'sale', 'both');
create type public.handover as enum ('ship', 'in_person', 'both');

alter table public.user_cards
  add column offer public.offer_mode,
  add column handover public.handover not null default 'ship',
  -- shown only on the card sheet of that offer; never listed, sorted, compared or aggregated
  add column price_cents integer check (price_cents between 0 and 100000000),
  add constraint price_only_for_sale check (price_cents is null or offer in ('sale', 'both'));

-- In-person handover only for adults who turned it on (check_profile keeps minors out of it).
create function public.check_user_card() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.handover <> 'ship' and not exists (
    select 1 from public.profiles p where p.id = new.user_id and p.in_person_ok
  ) then
    raise exception 'in-person handover not enabled' using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger check_user_card before insert or update on public.user_cards
  for each row execute function public.check_user_card();

grant insert (offer, handover, price_cents), update (offer, handover, price_cents)
  on public.user_cards to authenticated;

-- Matching reads by card and status.
create index user_cards_match on public.user_cards (card_id, status) where deleted_at is null;

-- Regions (the "Mi región" scope) --------------------------------------------------------------
create table public.regions (code text primary key, name text not null);
create table public.region_countries (
  country char(2) primary key check (country ~ '^[A-Z]{2}$'),
  region_code text not null references public.regions (code)
);
alter table public.regions enable row level security;
alter table public.region_countries enable row level security;
create policy "regions readable" on public.regions for select to anon, authenticated using (true);
create policy "region countries readable" on public.region_countries for select to anon, authenticated
  using (true);
revoke all on public.regions, public.region_countries from anon, authenticated;
grant select on public.regions, public.region_countries to anon, authenticated;

insert into public.regions (code, name) values
  ('EU', 'Unión Europea'), ('LATAM', 'Latinoamérica'), ('NA', 'Norteamérica'), ('OTHER', 'Otros');
insert into public.region_countries (country, region_code)
select c, 'EU' from unnest(array['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE',
  'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE']) c
union all
select c, 'LATAM' from unnest(array['AR', 'BO', 'CL', 'CO', 'CR', 'CU', 'DO', 'EC', 'SV', 'GT', 'HN',
  'MX', 'NI', 'PA', 'PY', 'PE', 'PR', 'UY', 'VE']) c
union all
select c, 'NA' from unnest(array['US', 'CA']) c;

-- Matches --------------------------------------------------------------------------------------
-- Double: they have spares I want AND I have spares they want. Single: one direction.
-- Both users' scopes must accept each other (someone on "Mi país" never appears abroad).
-- Ranking: same subdivision > same country > same region > rest, then doubles, then number of
-- cards. Never price. Reputation joins the ranking when trades exist (M6).
-- shortcut: blocked/suspended users are not excluded yet (those tables arrive with chat, M6).
create function public.get_matches()
returns table (
  user_id uuid,
  username text,
  country char(2),
  subdivision text,
  kind text,
  they_give text[],
  you_give text[],
  proximity int
)
language sql stable security definer set search_path = '' as $$
  with me as (
    select p.id, p.country, p.subdivision, p.match_scope,
      (select r.region_code from public.region_countries r where r.country = p.country) region
    from public.profiles p where p.id = (select auth.uid())
  ),
  mine as (
    select u.card_id, u.status from public.user_cards u
    where u.user_id = (select auth.uid()) and u.deleted_at is null and u.status in ('want', 'dupe')
  ),
  links as (
    select u.user_id, u.card_id, m.status = 'want' as to_me
    from mine m
    join public.user_cards u on u.card_id = m.card_id and u.deleted_at is null
      and u.status = case m.status when 'want' then 'dupe'::public.mark_status else 'want' end
    where u.user_id <> (select auth.uid())
  ),
  pairs as (
    select l.user_id,
      coalesce(array_agg(l.card_id order by l.card_id) filter (where l.to_me), '{}') they_give,
      coalesce(array_agg(l.card_id order by l.card_id) filter (where not l.to_me), '{}') you_give
    from links l group by l.user_id
  ),
  scored as (
    select pr.*, p.username, p.country, p.subdivision,
      case
        when p.subdivision = me.subdivision then 0
        when p.country = me.country then 1
        when rc.region_code = me.region then 2
        else 3
      end proximity,
      p.match_scope their_scope, me.match_scope my_scope
    from pairs pr
    cross join me
    join public.profiles p on p.id = pr.user_id and p.username is not null
    join public.country_config cc on cc.country = p.country and cc.launched
    left join public.region_countries rc on rc.country = p.country
  )
  select s.user_id, s.username, s.country, s.subdivision,
    case when cardinality(s.they_give) > 0 and cardinality(s.you_give) > 0 then 'double' else 'single' end,
    s.they_give, s.you_give, s.proximity
  from scored s
  where s.proximity <= case s.my_scope when 'zone' then 0 when 'country' then 1 when 'region' then 2 else 3 end
    and s.proximity <= case s.their_scope when 'zone' then 0 when 'country' then 1 when 'region' then 2 else 3 end
  order by s.proximity,
    (cardinality(s.they_give) > 0 and cardinality(s.you_give) > 0) desc,
    cardinality(s.they_give) + cardinality(s.you_give) desc,
    s.username
  limit 200
$$;
revoke all on function public.get_matches() from public, anon;
grant execute on function public.get_matches() to authenticated;

-- Username blocklist ---------------------------------------------------------------------------
-- token: a part of the name between dots, underscores and digits equals the word;
-- prefix: the name starts with it; contains: anywhere (only unambiguous words, to avoid
-- blocking innocent names). Words are owner content: edit here or later in the panel.
create table public.blocked_usernames (
  word text primary key check (word ~ '^[a-z]+$'),
  kind text not null check (kind in ('token', 'prefix', 'contains'))
);
alter table public.blocked_usernames enable row level security; -- no policies: server only
revoke all on public.blocked_usernames from anon, authenticated;

insert into public.blocked_usernames (word, kind) values
  -- reserved
  ('binku', 'prefix'), ('admin', 'prefix'), ('administrador', 'token'), ('mod', 'token'),
  ('moderador', 'token'), ('moderator', 'token'), ('soporte', 'token'), ('support', 'token'),
  ('staff', 'token'), ('oficial', 'token'), ('official', 'token'), ('root', 'token'),
  ('system', 'token'), ('sistema', 'token'), ('help', 'token'), ('ayuda', 'token'),
  ('security', 'token'), ('seguridad', 'token'), ('privacy', 'token'), ('privacidad', 'token'),
  ('team', 'token'), ('equipo', 'token'), ('null', 'token'), ('undefined', 'token'), ('api', 'token'),
  -- insults and sexual content, es/en
  ('puta', 'token'), ('puto', 'token'), ('putas', 'token'), ('mierda', 'token'), ('cabron', 'token'),
  ('cabrona', 'token'), ('zorra', 'token'), ('maricon', 'token'), ('polla', 'token'),
  ('follar', 'token'), ('joder', 'token'), ('idiota', 'token'), ('imbecil', 'token'),
  ('subnormal', 'token'), ('retrasado', 'token'), ('violador', 'token'), ('pedo', 'token'),
  ('nazi', 'token'), ('shit', 'token'), ('bitch', 'token'), ('cunt', 'token'), ('dick', 'token'),
  ('cock', 'token'), ('pussy', 'token'), ('whore', 'token'), ('slut', 'token'), ('fag', 'token'),
  ('retard', 'token'), ('rape', 'token'), ('rapist', 'token'), ('sex', 'token'), ('sexo', 'token'),
  ('xxx', 'token'), ('nude', 'token'), ('nudes', 'token'), ('desnudo', 'token'), ('desnuda', 'token'),
  ('porno', 'token'),
  ('fuck', 'contains'), ('nigger', 'contains'), ('nigga', 'contains'), ('faggot', 'contains'),
  ('pedofil', 'contains'), ('gilipollas', 'contains'), ('hitler', 'contains'),
  ('onlyfans', 'contains'), ('porn', 'contains');

create function public.username_blocked(u text) returns boolean
language sql stable set search_path = '' as $$
  select exists (
    select 1 from public.blocked_usernames b
    where (b.kind = 'token' and b.word = any (regexp_split_to_array(u, '[._0-9]+')))
       or (b.kind = 'prefix' and starts_with(u, b.word))
       or (b.kind = 'contains' and strpos(u, b.word) > 0)
  )
$$;

-- Same age rules as before, plus the blocklist when the username is set or changed.
create or replace function public.check_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  min_age int := coalesce((select c.min_age from public.country_config c where c.country = new.country), 14);
begin
  if new.birth_date > current_date - make_interval(years => min_age) then
    raise exception 'under minimum age' using errcode = 'check_violation';
  end if;
  if new.in_person_ok and public.is_minor(new) then
    raise exception 'in-person handovers are for adults only' using errcode = 'check_violation';
  end if;
  if new.username is not null
     and (tg_op = 'INSERT' or new.username is distinct from old.username)
     and public.username_blocked(new.username) then
    raise exception 'username not allowed' using errcode = 'BK001';
  end if;
  if not new.in_person_ok and tg_op = 'UPDATE' and old.in_person_ok then
    -- turning in-person off moves the offers back to shipping only
    update public.user_cards set handover = 'ship' where user_id = new.id and handover <> 'ship';
  end if;
  return new;
end $$;
