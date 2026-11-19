-- Chat, inbox and safety (08-spec-chat-messages, 12-moderation-safety). One conversation per pair
-- of users. Users only read; every write goes through security-definer functions that apply the
-- rules: blocks, minors (adult ↔ minor = structured proposals only), filters for personal data and
-- insults, anti-spam limits. Chats are purged 90 days after the last message unless reported.
-- Error codes BK010–BK017 are mapped to messages in the app (src/data/chat.ts).

-- Settings ------------------------------------------------------------------------------------
alter table public.profiles
  add column dm_matches_only boolean not null default false,
  add column notify_messages boolean not null default true;
grant insert (dm_matches_only, notify_messages), update (dm_matches_only, notify_messages)
  on public.profiles to authenticated;

-- Blocks --------------------------------------------------------------------------------------
create table public.blocks (
  blocker_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  blocked_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index on public.blocks (blocked_id);
alter table public.blocks enable row level security;
create policy "own blocks" on public.blocks for all to authenticated
  using (blocker_id = (select auth.uid())) with check (blocker_id = (select auth.uid()));
revoke all on public.blocks from anon, authenticated;
grant select, delete on public.blocks to authenticated;
grant insert (blocked_id) on public.blocks to authenticated;

create function public.blocked_between(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a))
$$;

-- Conversations and messages ------------------------------------------------------------------
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references auth.users (id) on delete cascade,
  user_b uuid not null references auth.users (id) on delete cascade,
  origin text not null check (origin in ('match', 'offer', 'profile')),
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  a_read_at timestamptz,
  b_read_at timestamptz,
  a_muted boolean not null default false,
  b_muted boolean not null default false,
  held_at timestamptz, -- reported: kept past the 90-day purge until the report is resolved
  check (user_a < user_b),
  unique (user_a, user_b)
);
create index on public.conversations (user_b);
create index on public.conversations (created_by, created_at);
create index on public.conversations (last_message_at) where held_at is null;

create table public.messages (
  id bigint generated always as identity primary key,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid references auth.users (id) on delete set null,
  kind text not null check (kind in ('text', 'card', 'proposal')),
  body text check (char_length(body) between 1 and 500),
  card_id text references public.cards (id),
  proposal jsonb,
  created_at timestamptz not null default now(),
  check ((kind = 'text') = (body is not null)),
  check ((kind = 'card') = (card_id is not null)),
  check ((kind = 'proposal') = (proposal is not null))
);
create index on public.messages (conversation_id, id);
create index on public.messages (sender_id, created_at);

alter table public.conversations enable row level security;
alter table public.messages enable row level security;
create policy "members read" on public.conversations for select to authenticated
  using ((select auth.uid()) in (user_a, user_b));
create policy "members read" on public.messages for select to authenticated
  using (exists (select 1 from public.conversations c
    where c.id = conversation_id and (select auth.uid()) in (c.user_a, c.user_b)));
revoke all on public.conversations, public.messages from anon, authenticated;
grant select on public.conversations, public.messages to authenticated;

-- Live updates while a conversation is open (Realtime applies the read policy above).
alter publication supabase_realtime add table public.messages;

-- Filters -------------------------------------------------------------------------------------
-- Word lists live here, not in the repo (14-security.md); the owner edits them in the SQL editor.
create table public.moderation_terms (
  term text primary key check (char_length(term) between 2 and 60),
  match text not null default 'word' check (match in ('word', 'contains')),
  minors_only boolean not null default false
);
alter table public.moderation_terms enable row level security; -- server only
revoke all on public.moderation_terms from anon, authenticated;

/** Lowercase, no accents, common digit disguises undone, repeated letters collapsed. */
create function public.chat_norm(t text) returns text
language sql immutable set search_path = '' as $$
  select regexp_replace(
    translate(lower(t), 'áàäâéèëêíìïîóòöôúùüûñç013457@$', 'aaaaeeeeiiiioooouuuuncoieastas'),
    '(.)\1+', '\1', 'g')
$$;

/** Why a text may not be sent, or null. strict = a minor is in the conversation. */
create function public.chat_violation(p_text text, p_strict boolean) returns text
language plpgsql stable security definer set search_path = '' as $$
declare
  t text := lower(p_text);
  n text := ' ' || regexp_replace(public.chat_norm(p_text), '[^a-z]+', ' ', 'g') || ' ';
begin
  -- shortcut: numbers written in words ("seis uno dos…") get through; add if abused.
  if regexp_replace(t, '[\s().+-]', '', 'g') ~ '\d{9,}' then return 'phone'; end if;
  if t ~ '[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}' then return 'email'; end if;
  if t ~ '(^|[^a-z])(calle|c/|avda\.?|avenida|plaza|paseo|portal|piso|street|avenue|road)\s+[^0-9\n]{0,40}\d{1,4}'
    then return 'address'; end if;
  if p_strict then
    if t ~ '(https?://|www\.|[a-z0-9-]+\.(com|es|net|org|io|me|ly|gg|app|link|co|tv)([^a-z]|$))'
      then return 'link'; end if;
    if t ~ '(^|\s)@[a-z0-9_.]{2,}'
      or n ~ ' (instagram|insta|ig|tiktok|snapchat|snap|telegram|whatsap|wasap|wsp|discord|twiter|kakao|wechat|onlyfans|line id) '
      then return 'handle'; end if;
  end if;
  if exists (
    select 1 from public.moderation_terms m
    where (p_strict or not m.minors_only)
      and case m.match
        when 'word' then strpos(n, ' ' || public.chat_norm(m.term) || ' ') > 0
        else strpos(replace(n, ' ', ''), public.chat_norm(m.term)) > 0
      end)
  then return 'insult'; end if;
  return null;
end $$;

-- Push for new messages -----------------------------------------------------------------------
-- One row per recipient and conversation: several messages in a row become one push.
create table public.message_notices (
  user_id uuid not null references auth.users (id) on delete cascade,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  pending_since timestamptz,
  last_sent_at timestamptz,
  primary key (user_id, conversation_id)
);
create index on public.message_notices (user_id) where pending_since is not null;
alter table public.message_notices enable row level security; -- server only
revoke all on public.message_notices from anon, authenticated;

/** Sends pending message pushes (one user, or everyone from the cron job). Never the text. */
create function public.send_message_pushes(p_user uuid default null) returns int
language plpgsql security definer set search_path = '' as $$
declare r record; sent int := 0;
begin
  for r in
    select n.user_id, n.conversation_id, jsonb_agg(jsonb_build_object(
        'to', d.token,
        'sound', 'default',
        'channelId', 'messages',
        'title', case when d.lang = 'en' then 'New message from @' || o.username
                      else 'Nuevo mensaje de @' || o.username end,
        'body', case when d.lang = 'en' then 'Tap to read it.' else 'Toca para leerlo.' end,
        'data', jsonb_build_object('url', '/chat/' || n.conversation_id)
      )) messages
    from public.message_notices n
    join public.profiles p on p.id = n.user_id and p.notify_messages and p.deletion_requested_at is null
    join public.conversations c on c.id = n.conversation_id
    join public.profiles o on o.id = case when c.user_a = n.user_id then c.user_b else c.user_a end
    join public.devices d on d.user_id = n.user_id
    where n.pending_since is not null
      and (p_user is null or n.user_id = p_user)
      and (n.last_sent_at is null or n.last_sent_at < now() - interval '2 minutes')
      and not public.in_quiet_hours(p, d.timezone)
    group by n.user_id, n.conversation_id, o.username
  loop
    -- shortcut: fire-and-forget like match pushes (no receipts).
    perform net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      body := r.messages,
      headers := jsonb_build_object('Content-Type', 'application/json'));
    update public.message_notices set last_sent_at = now(), pending_since = null
      where user_id = r.user_id and conversation_id = r.conversation_id;
    sent := sent + 1;
  end loop;
  return sent;
end $$;

-- Sending -------------------------------------------------------------------------------------
create function public.chat_peer(c public.conversations, me uuid) returns uuid
language sql immutable set search_path = '' as $$
  select case when c.user_a = me then c.user_b else c.user_a end
$$;

/**
 * Sends a message to a conversation, or to a user (p_to) on first contact: the conversation is
 * created then, so opening a chat and leaving does not count against the daily limit.
 * proposal: {"type":"offer","give":[card ids],"get":[card ids]} or {"type":"accept"|"tracked"|"shipped"|"received"}.
 */
create function public.send_message(
  p_conversation uuid, p_to uuid, p_kind text,
  p_body text default null, p_card text default null, p_proposal jsonb default null,
  p_origin text default 'match'
) returns public.messages
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  conv public.conversations;
  me_p public.profiles;
  other_p public.profiles;
  other uuid;
  why text;
  msg public.messages;
  ptype text := p_proposal ->> 'type';
begin
  select * into me_p from public.profiles where id = me;
  if me is null or me_p.username is null or me_p.deletion_requested_at is not null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  if p_conversation is not null then
    select * into conv from public.conversations where id = p_conversation and me in (user_a, user_b);
    if conv.id is null then raise exception 'no such conversation' using errcode = '42501'; end if;
    other := public.chat_peer(conv, me);
  else
    other := p_to;
    select * into conv from public.conversations
      where user_a = least(me, other) and user_b = greatest(me, other);
  end if;

  select * into other_p from public.profiles where id = other;
  if other_p.id is null or other = me or other_p.username is null or other_p.deletion_requested_at is not null then
    raise exception 'user unavailable' using errcode = 'BK011';
  end if;
  if public.blocked_between(me, other) then
    raise exception 'blocked' using errcode = 'BK010';
  end if;

  -- First contact: who may be contacted, and how many new chats a day.
  if conv.id is null then
    if p_origin not in ('match', 'offer', 'profile') then
      raise exception 'bad origin' using errcode = '22023';
    end if;
    if other_p.dm_matches_only
      and not exists (select 1 from public.match_list(other) m where m.user_id = me) then
      raise exception 'only matches' using errcode = 'BK011';
    end if;
    if not me_p.trusted and (select count(*) from public.conversations
        where created_by = me and created_at > now() - interval '1 day')
      >= case when me_p.created_at > now() - interval '7 days' then 5 else 20 end then
      raise exception 'too many new chats' using errcode = 'BK012';
    end if;
  end if;

  -- Flood control: 20 a minute in one chat, 300 an hour overall.
  if (select count(*) from public.messages m where m.sender_id = me and m.conversation_id = conv.id
        and m.created_at > now() - interval '1 minute') >= 20
    or (select count(*) from public.messages m where m.sender_id = me
        and m.created_at > now() - interval '1 hour') >= 300 then
    raise exception 'slow down' using errcode = 'BK014';
  end if;

  if p_kind = 'text' then
    -- Adult ↔ minor: structured proposals and cards only.
    if public.is_minor(me_p) <> public.is_minor(other_p) then
      raise exception 'structured only' using errcode = 'BK015';
    end if;
    p_body := btrim(p_body);
    if p_body is null or char_length(p_body) not between 1 and 500 then
      raise exception 'bad text' using errcode = '22023';
    end if;
    why := public.chat_violation(p_body, public.is_minor(me_p) or public.is_minor(other_p));
    if why is not null then
      raise exception '%', why using errcode = 'BK016';
    end if;
  elsif p_kind = 'card' then
    if not exists (select 1 from public.cards where id = p_card and status = 'approved') then
      raise exception 'bad card' using errcode = '22023';
    end if;
  elsif p_kind = 'proposal' then
    if ptype = 'offer' then
      if coalesce(jsonb_typeof(p_proposal -> 'give'), '') <> 'array'
        or coalesce(jsonb_typeof(p_proposal -> 'get'), '') <> 'array' then
        raise exception 'bad proposal' using errcode = '22023';
      end if;
      if jsonb_array_length(p_proposal -> 'give') not between 1 and 10
        or jsonb_array_length(p_proposal -> 'get') not between 1 and 10
        or exists (
          select 1 from jsonb_array_elements_text((p_proposal -> 'give') || (p_proposal -> 'get')) x
          where not exists (select 1 from public.cards c where c.id = x and c.status = 'approved')) then
        raise exception 'bad proposal' using errcode = '22023';
      end if;
      p_proposal := jsonb_build_object('type', 'offer', 'give', p_proposal -> 'give', 'get', p_proposal -> 'get');
    elsif ptype in ('accept', 'tracked', 'shipped', 'received') then
      p_proposal := jsonb_build_object('type', ptype);
    else
      raise exception 'bad proposal' using errcode = '22023';
    end if;
  else
    raise exception 'bad kind' using errcode = '22023';
  end if;

  if conv.id is null then
    insert into public.conversations (user_a, user_b, origin, created_by)
    values (least(me, other), greatest(me, other), p_origin, me)
    returning * into conv;
  end if;

  insert into public.messages (conversation_id, sender_id, kind, body, card_id, proposal)
  values (conv.id, me, p_kind,
    case when p_kind = 'text' then p_body end,
    case when p_kind = 'card' then p_card end,
    case when p_kind = 'proposal' then p_proposal end)
  returning * into msg;

  update public.conversations set last_message_at = msg.created_at,
    a_read_at = case when user_a = me then msg.created_at else a_read_at end,
    b_read_at = case when user_b = me then msg.created_at else b_read_at end
  where id = conv.id
  returning * into conv;

  if not (case when conv.user_a = other then conv.a_muted else conv.b_muted end) then
    insert into public.message_notices (user_id, conversation_id, pending_since)
    values (other, conv.id, now())
    on conflict (user_id, conversation_id)
      do update set pending_since = coalesce(public.message_notices.pending_since, now());
    perform public.send_message_pushes(other);
  end if;
  return msg;
end $$;

-- Reading -------------------------------------------------------------------------------------
/** Inbox rows (p_conversation = one row) or, with p_other only, the header for a first contact. */
create function public.get_chats(p_conversation uuid default null, p_other uuid default null)
returns table (
  id uuid, other_id uuid, other_username text, other_country char(2), other_subdivision text,
  last_message_at timestamptz, last_kind text, last_body text, last_card text, last_proposal jsonb,
  last_mine boolean, unread int, other_read_at timestamptz, muted boolean, blocked boolean,
  structured boolean, strict boolean
)
language sql stable security definer set search_path = '' as $$
  with me as (select p from public.profiles p where p.id = (select auth.uid())),
  convs as (
    select c.id, c.last_message_at,
      case when c.user_a = (select auth.uid()) then c.user_b else c.user_a end other_id,
      case when c.user_a = (select auth.uid()) then c.a_read_at else c.b_read_at end my_read,
      case when c.user_a = (select auth.uid()) then c.b_read_at else c.a_read_at end their_read,
      case when c.user_a = (select auth.uid()) then c.a_muted else c.b_muted end muted
    from public.conversations c
    where (select auth.uid()) in (c.user_a, c.user_b)
      and (p_conversation is null or c.id = p_conversation)
      and (p_other is null or c.user_a = least((select auth.uid()), p_other) and c.user_b = greatest((select auth.uid()), p_other))
    union all
    -- first contact: no conversation yet
    select null, null, p_other, null, null, false
    where p_other is not null and p_other <> (select auth.uid()) and not exists (
      select 1 from public.conversations c
      where c.user_a = least((select auth.uid()), p_other) and c.user_b = greatest((select auth.uid()), p_other))
  )
  select c.id, o.id, o.username, o.country, o.subdivision, c.last_message_at,
    l.kind, l.body, l.card_id, l.proposal, l.sender_id = (select auth.uid()),
    (select count(*)::int from public.messages m where m.conversation_id = c.id
      and m.sender_id is distinct from (select auth.uid()) and m.created_at > coalesce(c.my_read, '-infinity')),
    c.their_read, c.muted,
    exists (select 1 from public.blocks b where b.blocker_id = (select auth.uid()) and b.blocked_id = o.id),
    public.is_minor(me.p) <> public.is_minor(o),
    public.is_minor(me.p) or public.is_minor(o)
  from convs c
  cross join me
  join public.profiles o on o.id = c.other_id and o.username is not null
  left join lateral (
    select m.* from public.messages m where m.conversation_id = c.id order by m.id desc limit 1
  ) l on true
  where c.id is null or l.id is not null
  order by c.last_message_at desc nulls first
  limit 200
$$;

create function public.mark_read(p_conversation uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.conversations set
    a_read_at = case when user_a = (select auth.uid()) then now() else a_read_at end,
    b_read_at = case when user_b = (select auth.uid()) then now() else b_read_at end
  where id = p_conversation and (select auth.uid()) in (user_a, user_b);
  update public.message_notices set pending_since = null
  where user_id = (select auth.uid()) and conversation_id = p_conversation;
end $$;

create function public.set_muted(p_conversation uuid, p_muted boolean) returns void
language sql security definer set search_path = '' as $$
  update public.conversations set
    a_muted = case when user_a = (select auth.uid()) then p_muted else a_muted end,
    b_muted = case when user_b = (select auth.uid()) then p_muted else b_muted end
  where id = p_conversation and (select auth.uid()) in (user_a, user_b)
$$;

-- Reports -------------------------------------------------------------------------------------
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references auth.users (id) on delete set null,
  target_type text not null check (target_type in ('message', 'conversation', 'profile', 'offer', 'photo')),
  target_id text not null,
  target_user uuid references auth.users (id) on delete set null,
  reason text not null check (reason in
    ('scam', 'fake', 'harassment', 'sexual', 'personal_data', 'spam', 'in_person', 'other')),
  details text check (char_length(details) <= 500),
  involves_minor boolean not null,
  snapshot jsonb, -- only the reported context: the moderator never browses chats
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (reporter_id, target_type, target_id)
);
create index on public.reports (status, involves_minor desc, created_at);
alter table public.reports enable row level security; -- server only (moderation panel in M7)
revoke all on public.reports from anon, authenticated;

/** Report a message, a whole conversation or a user. Reported conversations are held. */
create function public.report(p_target_type text, p_target_id text, p_reason text, p_details text default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  conv public.conversations;
  target uuid;
  snap jsonb;
  msg_id bigint;
begin
  if me is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if (select count(*) from public.reports where reporter_id = me and created_at > now() - interval '1 day') >= 10 then
    raise exception 'too many reports' using errcode = 'BK017';
  end if;

  if p_target_type in ('message', 'conversation') then
    if p_target_type = 'message' then
      msg_id := p_target_id::bigint;
      select c.* into conv from public.conversations c
        join public.messages m on m.conversation_id = c.id and m.id = msg_id;
    else
      select * into conv from public.conversations where id = p_target_id::uuid;
    end if;
    if conv.id is null or me not in (conv.user_a, conv.user_b) then
      raise exception 'no such conversation' using errcode = '42501';
    end if;
    target := public.chat_peer(conv, me);
    -- the reported message with up to 20 around it, or the last 40 of the conversation
    select jsonb_agg(jsonb_build_object('id', m.id, 'from', (select username from public.profiles where id = m.sender_id),
        'kind', m.kind, 'body', m.body, 'card', m.card_id, 'proposal', m.proposal, 'at', m.created_at) order by m.id)
      into snap
      from (select * from public.messages m where m.conversation_id = conv.id
            order by case when msg_id is null then -m.id else abs(m.id - msg_id) end
            limit case when msg_id is null then 40 else 21 end) m;
    update public.conversations set held_at = coalesce(held_at, now()) where id = conv.id;
  elsif p_target_type = 'profile' then
    target := p_target_id::uuid;
    select jsonb_build_object('username', username, 'country', country, 'subdivision', subdivision)
      into snap from public.profiles where id = target;
    if snap is null then raise exception 'no such user' using errcode = 'BK011'; end if;
  else
    raise exception 'not reportable yet' using errcode = '22023';
  end if;

  insert into public.reports (reporter_id, target_type, target_id, target_user, reason, details, involves_minor, snapshot)
  values (me, p_target_type, p_target_id, target, p_reason, nullif(btrim(p_details), ''),
    exists (select 1 from public.profiles p where p.id in (me, target) and public.is_minor(p)), snap)
  on conflict (reporter_id, target_type, target_id) do nothing;
end $$;

-- Retention -----------------------------------------------------------------------------------
create function public.purge_old_chats() returns int
language sql security definer set search_path = '' as $$
  with gone as (
    delete from public.conversations
    where last_message_at < now() - interval '90 days' and held_at is null
    returning 1
  )
  select count(*)::int from gone
$$;

revoke all on function public.blocked_between(uuid, uuid), public.chat_norm(text),
  public.chat_violation(text, boolean), public.send_message_pushes(uuid),
  public.chat_peer(public.conversations, uuid), public.purge_old_chats()
  from public, anon, authenticated;
revoke all on function public.send_message(uuid, uuid, text, text, text, jsonb, text),
  public.get_chats(uuid, uuid), public.mark_read(uuid), public.set_muted(uuid, boolean),
  public.report(text, text, text, text)
  from public, anon;
grant execute on function public.send_message(uuid, uuid, text, text, text, jsonb, text),
  public.get_chats(uuid, uuid), public.mark_read(uuid), public.set_muted(uuid, boolean),
  public.report(text, text, text, text)
  to authenticated;

select cron.schedule('message-pushes', '*/5 * * * *', 'select public.send_message_pushes()');
select cron.schedule('purge-chats', '41 3 * * *', 'select public.purge_old_chats()');

-- Matching: never match people who blocked each other ----------------------------------------
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
    where not exists (select 1 from public.blocks b
      where (b.blocker_id = p_user and b.blocked_id = pr.user_id)
         or (b.blocker_id = pr.user_id and b.blocked_id = p_user))
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

-- Match push copy: every match is mutual now, so no "doble" and no daily digest ----------------
create or replace function public.due_match_pushes()
returns table (user_id uuid, kind text, messages jsonb)
language sql stable security definer set search_path = '' as $$
  with ready as (
    select n.user_id, n.kind, p, n.other_id,
      (select o.username from public.profiles o where o.id = n.other_id) other,
      row_number() over (partition by n.user_id order by n.created_at desc) rn
    from public.match_notices n
    join public.profiles p on p.id = n.user_id and p.notify_matches and p.deletion_requested_at is null
    where n.sent_at is null and n.kind = 'double'
  )
  select u.user_id, u.kind, jsonb_agg(jsonb_build_object(
      'to', d.token,
      'sound', 'default',
      'channelId', 'matches',
      'title', case when d.lang = 'en' then 'New match' else 'Nueva coincidencia' end,
      'body', case when d.lang = 'en' then 'With @' || u.other || '. Open it to see the trade.'
                   else 'Con @' || u.other || '. Ábrela para ver el cambio.' end,
      'data', jsonb_build_object('url', '/match/' || u.other_id)
    ))
  from ready u
  join public.devices d on d.user_id = u.user_id
  where u.rn = 1 and not public.in_quiet_hours(u.p, d.timezone)
  group by u.user_id, u.kind
$$;
revoke all on function public.due_match_pushes() from public, anon, authenticated;
