-- Accounts: profile, binders, binder slots and card marks. Each user reads and writes only
-- their own rows; matches (M5) and public profiles/binders (M8) will get their own read paths,
-- never exposing birth_date. Binders and marks are soft-deleted (deleted_at) so the
-- incremental pull (updated_at > last_sync) also carries deletions to other devices.

create type public.match_scope as enum ('zone', 'country', 'region', 'international');
create type public.user_role as enum ('user', 'admin');
create type public.binder_kind as enum ('group', 'member', 'era', 'custom');
create type public.mark_status as enum ('have', 'want', 'dupe');

create table public.profiles (
  id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  -- null until the user picks it right after the first sign-in
  username text unique check (username ~ '^[a-z0-9_.]{3,20}$'),
  birth_date date not null,
  country char(2) not null check (country ~ '^[A-Z]{2}$'),
  subdivision text check (subdivision ~ '^[A-Z]{2}-[A-Z0-9]{1,3}$' and left(subdivision, 2) = country),
  match_scope public.match_scope not null default 'country',
  in_person_ok boolean not null default false,
  currency char(3) not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  role public.user_role not null default 'user',
  trusted boolean not null default false,
  badges text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Computed on read (PostgREST: select=*,is_minor) so it flips on the 18th birthday by itself.
create function public.is_minor(p public.profiles) returns boolean
language sql stable set search_path = '' as $$
  select current_date < p.birth_date + make_interval(years => coalesce(
    (select c.minor_limit from public.country_config c where c.country = p.country), 18))
$$;

-- Server-side age gate: the app checks too, but a modified client must not get past it.
create function public.check_profile() returns trigger
language plpgsql set search_path = '' as $$
declare
  min_age int := coalesce((select c.min_age from public.country_config c where c.country = new.country), 14);
begin
  if new.birth_date > current_date - make_interval(years => min_age) then
    raise exception 'under minimum age' using errcode = 'check_violation';
  end if;
  if new.in_person_ok and public.is_minor(new) then
    raise exception 'in-person handovers are for adults only' using errcode = 'check_violation';
  end if;
  return new;
end $$;

create table public.binders (
  id uuid primary key, -- generated on the device so offline writes keep their id
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  kind public.binder_kind not null,
  filter jsonb,
  layout text not null default '3x3' check (layout in ('3x3', '2x2')),
  is_public boolean not null default false,
  sort integer not null default 0,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.binder_slots (
  binder_id uuid not null references public.binders (id) on delete cascade,
  page integer not null default 0 check (page >= 0),
  position integer not null check (position >= 0),
  card_id text not null references public.cards (id),
  primary key (binder_id, page, position)
);

create table public.user_cards (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  card_id text not null references public.cards (id),
  status public.mark_status not null,
  qty smallint not null default 1 check (qty between 1 and 999),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, card_id)
);

create index on public.binders (user_id, updated_at);
create index on public.binder_slots (card_id);
create index on public.user_cards (user_id, updated_at);
create index on public.user_cards (card_id);

-- Slots have no updated_at: any slot change bumps its binder, and the pull refetches its slots.
-- shortcut: row-level bump (one update per slot row); switch to a statement trigger if big reorders get slow.
create function public.touch_binder() returns trigger
language plpgsql set search_path = '' as $$
begin
  update public.binders set updated_at = now() where id = coalesce(new.binder_id, old.binder_id);
  return null;
end $$;

create trigger check_profile before insert or update on public.profiles
  for each row execute function public.check_profile();
create trigger set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.binders
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.user_cards
  for each row execute function public.set_updated_at();
create trigger touch_binder after insert or update or delete on public.binder_slots
  for each row execute function public.touch_binder();

alter table public.profiles enable row level security;
alter table public.binders enable row level security;
alter table public.binder_slots enable row level security;
alter table public.user_cards enable row level security;

create policy "own profile" on public.profiles for all to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy "own binders" on public.binders for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own slots" on public.binder_slots for all to authenticated
  using (exists (select 1 from public.binders b where b.id = binder_id and b.user_id = (select auth.uid())))
  with check (exists (select 1 from public.binders b where b.id = binder_id and b.user_id = (select auth.uid())));
create policy "own marks" on public.user_cards for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Column grants: role/trusted/badges are admin-only, birth_date is fixed after sign-up (a minor
-- cannot become an adult by editing it), owners never change, is_public waits for sharing (M8).
-- Deletes are soft (deleted_at), except slots; account deletion cascades from auth.users.
revoke all on public.profiles, public.binders, public.binder_slots, public.user_cards from anon, authenticated;
grant select on public.profiles, public.binders, public.binder_slots, public.user_cards to authenticated;
grant insert (id, username, birth_date, country, subdivision, match_scope, in_person_ok, currency),
  update (username, country, subdivision, match_scope, in_person_ok, currency)
  on public.profiles to authenticated;
-- Keys are updatable too: PostgREST upserts (outbox) put every sent column in DO UPDATE SET;
-- RLS still pins rows to their owner.
grant insert (id, title, kind, filter, layout, sort, deleted_at),
  update (id, title, kind, filter, layout, sort, deleted_at)
  on public.binders to authenticated;
grant insert, update, delete on public.binder_slots to authenticated;
grant insert (card_id, status, qty, deleted_at), update (card_id, status, qty, deleted_at)
  on public.user_cards to authenticated;
