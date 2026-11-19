-- Match notifications (08-spec-matches-home, 11-notifications-deeplinks): a new double match →
-- instant push; new single matches → one daily digest. Quiet hours delay pushes, never drop
-- them. Everything runs in the database: pg_cron every 5 minutes, pg_net posts to the Expo push
-- service (no server of our own, no paid service). Lock-screen text never shows cards.

-- Settings ------------------------------------------------------------------------------------
-- quiet_hours: 'HH:MM-HH:MM', 'off', or null = default (minors: their country's default; adults: off).
alter table public.profiles
  add column notify_matches boolean not null default false,
  add column quiet_hours text check (quiet_hours = 'off' or quiet_hours ~ '^\d{2}:\d{2}-\d{2}:\d{2}$');
grant insert (notify_matches, quiet_hours), update (notify_matches, quiet_hours)
  on public.profiles to authenticated;

-- One row per phone. The token moves with whoever signs in on that phone (register_device).
create table public.devices (
  token text primary key check (token ~ '^Expo(nent)?PushToken\[[^\]]{1,200}\]$'),
  user_id uuid not null references auth.users (id) on delete cascade,
  platform text not null check (platform in ('ios', 'android')),
  lang text not null default 'es' check (lang in ('es', 'en')),
  timezone text not null default 'Europe/Madrid' check (char_length(timezone) <= 64),
  updated_at timestamptz not null default now()
);
create index on public.devices (user_id);
alter table public.devices enable row level security;
create policy "own devices" on public.devices for select to authenticated
  using (user_id = (select auth.uid()));
revoke all on public.devices from anon, authenticated;
grant select on public.devices to authenticated;

create function public.register_device(p_token text, p_platform text, p_lang text, p_timezone text)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  -- an unknown zone would break the quiet-hours maths: fall back to Madrid
  if not exists (select 1 from pg_timezone_names where name = p_timezone) then
    p_timezone := 'Europe/Madrid';
  end if;
  insert into public.devices (token, user_id, platform, lang, timezone)
  values (p_token, (select auth.uid()), p_platform, p_lang, p_timezone)
  on conflict (token) do update set user_id = excluded.user_id, platform = excluded.platform,
    lang = excluded.lang, timezone = excluded.timezone, updated_at = now();
end $$;

create function public.unregister_device(p_token text) returns void
language sql security definer set search_path = '' as $$
  delete from public.devices where token = p_token and user_id = (select auth.uid())
$$;
revoke all on function public.register_device(text, text, text, text), public.unregister_device(text)
  from public, anon;
grant execute on function public.register_device(text, text, text, text), public.unregister_device(text)
  to authenticated;

-- Matching for any user (get_matches is this for the caller) --------------------------------
create function public.match_list(p_user uuid)
returns table (
  user_id uuid, username text, country char(2), subdivision text, kind text,
  they_give text[], you_give text[], proximity int
)
language sql stable security definer set search_path = '' as $$
  with me as (
    select p.id, p.country, p.subdivision, p.match_scope,
      (select r.region_code from public.region_countries r where r.country = p.country) region
    from public.profiles p where p.id = p_user
  ),
  mine as (
    select u.card_id, u.status from public.user_cards u
    where u.user_id = p_user and u.deleted_at is null and u.status in ('want', 'dupe')
  ),
  links as (
    select u.user_id, u.card_id, m.status = 'want' as to_me
    from mine m
    join public.user_cards u on u.card_id = m.card_id and u.deleted_at is null
      and u.status = case m.status when 'want' then 'dupe'::public.mark_status else 'want' end
    where u.user_id <> p_user
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
revoke all on function public.match_list(uuid) from public, anon, authenticated;

create or replace function public.get_matches()
returns table (
  user_id uuid, username text, country char(2), subdivision text, kind text,
  they_give text[], you_give text[], proximity int
)
language sql stable security definer set search_path = '' as $$
  select * from public.match_list((select auth.uid()))
$$;

-- Notices -------------------------------------------------------------------------------------
-- What each person has been told about (one row per pair and kind, so a match is announced once;
-- a single that later becomes double is announced again as double).
create table public.match_notices (
  user_id uuid not null references auth.users (id) on delete cascade,
  other_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('double', 'single')),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  primary key (user_id, other_id, kind)
);
create index on public.match_notices (user_id) where sent_at is null;
alter table public.match_notices enable row level security; -- server only
revoke all on public.match_notices from anon, authenticated;

create table public.job_state (key text primary key, value timestamptz not null);
alter table public.job_state enable row level security;
revoke all on public.job_state from anon, authenticated;

/** Is it quiet time for this user right now? */
create function public.in_quiet_hours(p public.profiles, tz text, at timestamptz default now())
returns boolean
language sql stable set search_path = '' as $$
  with w as (
    select coalesce(p.quiet_hours,
      case when public.is_minor(p)
        then (select c.quiet_hours_default from public.country_config c where c.country = p.country)
      end, 'off') q
  ), b as (
    select split_part(q, '-', 1)::time s, split_part(q, '-', 2)::time e, (at at time zone tz)::time t
    from w where q <> 'off'
  )
  select coalesce((select case when s <= e then t >= s and t < e else t >= s or t < e end from b), false)
$$;

/** Queue notices for matches touched since the last run (only changed users can create new pairs). */
create function public.queue_match_notices() returns int
language plpgsql security definer set search_path = '' as $$
declare
  since timestamptz := coalesce((select value from public.job_state where key = 'match_notices'),
                                now() - interval '10 minutes');
  started timestamptz := now();
  n int;
begin
  with changed as (
    select distinct u.user_id from public.user_cards u
    where u.updated_at > since and u.deleted_at is null and u.status in ('want', 'dupe')
  ),
  found as (
    select c.user_id a, m.user_id b, m.kind from changed c, lateral public.match_list(c.user_id) m
  ),
  both_ways as (
    select a user_id, b other_id, kind from found union select b, a, kind from found
  ),
  ins as (
    insert into public.match_notices (user_id, other_id, kind)
    select w.user_id, w.other_id, w.kind from both_ways w
    join public.profiles p on p.id = w.user_id and p.notify_matches
    on conflict do nothing
    returning 1
  )
  select count(*) into n from ins;
  insert into public.job_state values ('match_notices', started)
    on conflict (key) do update set value = excluded.value;
  return n;
end $$;

/** Expo push messages due now: doubles at once, singles as one digest after 18:00 local. */
create function public.due_match_pushes()
returns table (user_id uuid, kind text, messages jsonb)
language sql stable security definer set search_path = '' as $$
  with ready as (
    select n.user_id, n.kind, p, count(*) over (partition by n.user_id, n.kind) total,
      n.other_id, (select o.username from public.profiles o where o.id = n.other_id) other,
      row_number() over (partition by n.user_id, n.kind order by n.created_at desc) rn
    from public.match_notices n
    join public.profiles p on p.id = n.user_id and p.notify_matches
    where n.sent_at is null
  ),
  per_user as (
    select r.user_id, r.kind, r.total, r.other_id, r.other, r.p from ready r where r.rn = 1
  )
  select u.user_id, u.kind, jsonb_agg(jsonb_build_object(
      'to', d.token,
      'sound', 'default',
      'title', 'Binku',
      'body', case
        when u.kind = 'double' and d.lang = 'en' then 'New double match with @' || u.other
        when u.kind = 'double' then 'Nueva coincidencia doble con @' || u.other
        when d.lang = 'en' then 'You have ' || u.total || ' new match' || case when u.total = 1 then '' else 'es' end
        else 'Tienes ' || u.total || ' coincidencia' || case when u.total = 1 then '' else 's' end
             || ' nueva' || case when u.total = 1 then '' else 's' end
      end,
      'data', jsonb_build_object('url', case when u.kind = 'double' then '/match/' || u.other_id else '/matches' end)
    ))
  from per_user u
  join public.devices d on d.user_id = u.user_id
  where not public.in_quiet_hours(u.p, d.timezone)
    and (u.kind = 'double' or (
      (now() at time zone d.timezone)::time >= time '18:00'
      -- one digest a day
      and not exists (
        select 1 from public.match_notices x
        where x.user_id = u.user_id and x.kind = 'single'
          and x.sent_at >= (date_trunc('day', now() at time zone d.timezone) at time zone d.timezone))))
  group by u.user_id, u.kind
$$;

/** The 5-minute job: queue, send, mark as sent. */
create function public.send_match_pushes() returns int
language plpgsql security definer set search_path = '' as $$
declare r record; sent int := 0;
begin
  perform public.queue_match_notices();
  for r in select * from public.due_match_pushes() loop
    -- shortcut: fire-and-forget (no receipts); dead tokens stay until the user signs out or
    -- re-registers. Read Expo receipts if pushes start failing at scale.
    perform net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      body := r.messages,
      headers := jsonb_build_object('Content-Type', 'application/json'));
    update public.match_notices set sent_at = now()
      where user_id = r.user_id and kind = r.kind and sent_at is null;
    sent := sent + 1;
  end loop;
  return sent;
end $$;
revoke all on function public.in_quiet_hours(public.profiles, text, timestamptz),
  public.queue_match_notices(), public.due_match_pushes(), public.send_match_pushes()
  from public, anon, authenticated;

select cron.schedule('match-pushes', '*/5 * * * *', 'select public.send_match_pushes()');
