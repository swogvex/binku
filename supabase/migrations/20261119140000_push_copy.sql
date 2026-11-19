-- Push copy: a real title instead of repeating "Binku" under the app name, the Android
-- "matches" channel, and a body that invites to open the match. Never shows cards.
/** Expo push messages due now: doubles at once, singles as one digest after 18:00 local. */
create or replace function public.due_match_pushes()
returns table (user_id uuid, kind text, messages jsonb)
language sql stable security definer set search_path = '' as $$
  with ready as (
    select n.user_id, n.kind, p, count(*) over (partition by n.user_id, n.kind) total,
      n.other_id, (select o.username from public.profiles o where o.id = n.other_id) other,
      row_number() over (partition by n.user_id, n.kind order by n.created_at desc) rn
    from public.match_notices n
    join public.profiles p on p.id = n.user_id and p.notify_matches and p.deletion_requested_at is null
    where n.sent_at is null
  ),
  per_user as (
    select r.user_id, r.kind, r.total, r.other_id, r.other, r.p from ready r where r.rn = 1
  )
  select u.user_id, u.kind, jsonb_agg(jsonb_build_object(
      'to', d.token,
      'sound', 'default',
      'channelId', 'matches',
      'title', case
        when u.kind = 'double' and d.lang = 'en' then 'New double match'
        when u.kind = 'double' then 'Nueva coincidencia doble'
        when d.lang = 'en' then 'New matches'
        else 'Coincidencias nuevas'
      end,
      'body', case
        when u.kind = 'double' and d.lang = 'en' then 'With @' || u.other || '. Open it to see the trade.'
        when u.kind = 'double' then 'Con @' || u.other || '. Ábrela para ver el cambio.'
        when d.lang = 'en' then 'You have ' || u.total || ' new match' || case when u.total = 1 then '' else 'es' end
          || ' waiting.'
        else 'Tienes ' || u.total || ' coincidencia' || case when u.total = 1 then '' else 's' end
             || ' nueva' || case when u.total = 1 then '' else 's' end || ' esperando.'
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

