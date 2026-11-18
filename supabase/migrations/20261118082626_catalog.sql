-- Catalog (text data only, no official images) + per-country config.
-- Clients read approved and hidden rows (hidden = tombstone so offline caches drop them);
-- pending rows are community proposals and stay private. No client writes.

create type public.catalog_status as enum ('pending', 'approved', 'hidden');
create type public.release_kind as enum ('album', 'single', 'sg', 'event', 'other');
create type public.card_type as enum ('album', 'pob', 'lucky_draw', 'event', 'season_greetings', 'other');

-- Colours are design-token names (src/theme/tokens.ts `era`), never free hex.
create domain public.era_color as text
  check (value in ('tomato', 'cobalt', 'mango', 'mint', 'bubblegum'));

create function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create table public.groups (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  name_ko text,
  monogram text not null check (char_length(monogram) between 1 and 4),
  color public.era_color not null,
  logo_url text,
  logo_enabled boolean not null default false,
  status public.catalog_status not null default 'pending',
  updated_at timestamptz not null default now()
);

create table public.members (
  id text primary key default gen_random_uuid()::text,
  group_id text not null references public.groups (id),
  name text not null,
  name_ko text,
  birth_year smallint,
  status public.catalog_status not null default 'pending',
  updated_at timestamptz not null default now()
);

create table public.releases (
  id text primary key default gen_random_uuid()::text,
  group_id text not null references public.groups (id),
  title text not null,
  kind public.release_kind not null,
  year smallint not null,
  era_color public.era_color not null,
  status public.catalog_status not null default 'pending',
  updated_at timestamptz not null default now()
);

create table public.versions (
  id text primary key default gen_random_uuid()::text,
  release_id text not null references public.releases (id),
  label text not null,
  updated_at timestamptz not null default now()
);

create table public.cards (
  id text primary key default gen_random_uuid()::text,
  group_id text not null references public.groups (id),
  member_id text not null references public.members (id),
  release_id text not null references public.releases (id),
  version_id text references public.versions (id),
  type public.card_type not null,
  store text,
  year smallint not null,
  is_special boolean not null default false,
  status public.catalog_status not null default 'pending',
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

create index on public.members (group_id);
create index on public.releases (group_id);
create index on public.versions (release_id);
create index on public.cards (group_id);
create index on public.cards (member_id);
create index on public.cards (release_id);
create index on public.cards (created_by);
-- delta pull: updated_at > last_sync
create index on public.groups (updated_at);
create index on public.members (updated_at);
create index on public.releases (updated_at);
create index on public.versions (updated_at);
create index on public.cards (updated_at);

create table public.country_config (
  country char(2) primary key check (country ~ '^[A-Z]{2}$'),
  launched boolean not null default false,
  min_age smallint not null default 14 check (min_age between 13 and 18),
  minor_limit smallint not null default 18,
  in_person_allowed boolean not null default true,
  quiet_hours_default text not null default '22:00-09:00'
    check (quiet_hours_default ~ '^\d{2}:\d{2}-\d{2}:\d{2}$'),
  updated_at timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['groups', 'members', 'releases', 'versions', 'cards', 'country_config'] loop
    execute format('create trigger set_updated_at before update on public.%I
                    for each row execute function public.set_updated_at()', t);
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

create policy "catalog readable" on public.groups for select to anon, authenticated
  using (status <> 'pending');
create policy "catalog readable" on public.members for select to anon, authenticated
  using (status <> 'pending');
create policy "catalog readable" on public.releases for select to anon, authenticated
  using (status <> 'pending');
create policy "catalog readable" on public.versions for select to anon, authenticated
  using (exists (select 1 from public.releases r where r.id = release_id and r.status <> 'pending'));
create policy "catalog readable" on public.cards for select to anon, authenticated
  using (status <> 'pending');
create policy "config readable" on public.country_config for select to anon, authenticated
  using (true);

-- Read-only for clients even if a future policy is added by mistake.
revoke insert, update, delete, truncate on
  public.groups, public.members, public.releases, public.versions, public.cards, public.country_config
  from anon, authenticated;

insert into public.country_config (country, launched, min_age) values ('ES', true, 14);
