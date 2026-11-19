-- Only mutual matches: each person has a spare the other wants. One-way ("single") matches are
-- dropped; with many users they flood the list with people who want nothing from you.
-- `kind` stays in the result (always 'double') so the function signature does not change.
create or replace function public.match_list(p_user uuid)
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
      array_agg(l.card_id order by l.card_id) filter (where l.to_me) they_give,
      array_agg(l.card_id order by l.card_id) filter (where not l.to_me) you_give
    from links l group by l.user_id
    having bool_or(l.to_me) and bool_or(not l.to_me)
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
  select s.user_id, s.username, s.country, s.subdivision, 'double',
    s.they_give, s.you_give, s.proximity
  from scored s
  where s.proximity <= case s.my_scope when 'zone' then 0 when 'country' then 1 when 'region' then 2 else 3 end
    and s.proximity <= case s.their_scope when 'zone' then 0 when 'country' then 1 when 'region' then 2 else 3 end
  order by s.proximity,
    cardinality(s.they_give) + cardinality(s.you_give) desc,
    s.username
  limit 200
$$;
revoke all on function public.match_list(uuid) from public, anon, authenticated;

-- Pending single-match digests would announce matches that no longer exist.
delete from public.match_notices where kind = 'single' and sent_at is null;
