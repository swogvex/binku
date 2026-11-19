-- Chat: who can read and send, minors, filters, blocks, limits, reports and retention.
begin;
select plan(35);

insert into auth.users (id, email)
select ('00000000-0000-0000-0000-0000000001' || lpad(i::text, 2, '0'))::uuid, 'chat' || i || '@test.local'
from generate_series(1, 9) i;
-- 01 ana, 02 bea (adults) · 03 cris (15) · 04 eve (outsider) · 05–09 more adults for the daily limit
insert into public.profiles (id, username, birth_date, country, subdivision)
select ('00000000-0000-0000-0000-0000000001' || lpad(i::text, 2, '0'))::uuid,
  (array['ana', 'bea', 'cris', 'eve', 'u5', 'u6', 'u7', 'u8', 'u9'])[i],
  case when i = 3 then current_date - interval '15 years' else date '1990-01-01' end, 'ES', 'ES-VC'
from generate_series(1, 9) i;
insert into public.groups (id, name, monogram, color, status) values ('k-g', 'Test', 'T', 'cobalt', 'approved');
insert into public.members (id, group_id, name, status) values ('k-m', 'k-g', 'Uno', 'approved');
insert into public.releases (id, group_id, title, kind, year, era_color, status)
  values ('k-r', 'k-g', 'Era', 'album', 2025, 'mint', 'approved');
insert into public.cards (id, group_id, member_id, release_id, type, year, status)
select 'k-c' || i, 'k-g', 'k-m', 'k-r', 'album', 2025, 'approved' from generate_series(1, 2) i;
insert into public.moderation_terms (term, match) values ('puta', 'word'), ('hijoputa', 'contains');

-- Filters (as the server)
select is(public.chat_violation('Llámame al 612 34 56 78', false), 'phone', 'phone numbers with spaces');
select is(public.chat_violation('escríbeme a ana.k@gmail.com', false), 'email', 'emails');
select is(public.chat_violation('vivo en calle Mayor 5', false), 'address', 'street addresses');
select is(public.chat_violation('eres una puuuta', false), 'insult', 'insults, stretched letters');
select is(public.chat_violation('HIJ0PUTA', false), 'insult', 'insults, digit disguise, glued');
select is(public.chat_violation('mira binku.app', false), null, 'adults may share links');
select is(public.chat_violation('mira binku.app', true), 'link', 'no links with minors');
select is(public.chat_violation('sígueme en insta', true), 'handle', 'no social handles with minors');
select is(public.chat_violation('Tengo 2 del Season''s Greetings 2026, ¿te va?', true), null,
  'normal trade talk passes');

-- Anonymous and direct writes
set local role anon;
select throws_ok($$select public.send_message(null, '00000000-0000-0000-0000-000000000102', 'text', 'hola')$$,
  '42501', null, 'anon cannot send');
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000101","role":"authenticated"}', true);
select throws_ok($$insert into public.messages (conversation_id, sender_id, kind, body)
  values (gen_random_uuid(), '00000000-0000-0000-0000-000000000101', 'text', 'x')$$,
  '42501', null, 'no direct inserts');

-- ana → bea
select lives_ok($$select public.send_message(null, '00000000-0000-0000-0000-000000000102', 'text', ' Hola, ¿cambiamos? ')$$,
  'first message creates the conversation');
select is((select body from public.messages), 'Hola, ¿cambiamos?', 'text is trimmed');
select throws_ok($$select public.send_message(null, '00000000-0000-0000-0000-000000000102', 'text', 'Llámame al 612345678')$$,
  'BK016', 'phone', 'blocked message says why');
select lives_ok($$select public.send_message(null, '00000000-0000-0000-0000-000000000102', 'proposal', null, null,
  '{"type":"offer","give":["k-c1"],"get":["k-c2"],"extra":1}')$$, 'proposal to the same conversation');
select is((select proposal from public.messages where kind = 'proposal'),
  '{"type":"offer","give":["k-c1"],"get":["k-c2"]}'::jsonb, 'proposal stored without extra keys');
select throws_ok($$select public.send_message(null, '00000000-0000-0000-0000-000000000102', 'proposal', null, null,
  '{"type":"offer","give":["k-c1"]}')$$, '22023', null, 'incomplete proposal refused');
select is((select count(*)::int from public.conversations), 1, 'one conversation per pair');

-- adult ↔ minor
select throws_ok($$select public.send_message(null, '00000000-0000-0000-0000-000000000103', 'text', 'hola')$$,
  'BK015', null, 'adult to minor: no free text');
select lives_ok($$select public.send_message(null, '00000000-0000-0000-0000-000000000103', 'proposal', null, null,
  '{"type":"accept"}')$$, 'adult to minor: structured proposals');

-- bea reads, eve sees nothing
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000102","role":"authenticated"}', true);
select is((select unread from public.get_chats()), 2, 'bea has 2 unread');
select is((select structured from public.get_chats()), false, 'two adults: free text');
select lives_ok($$select public.mark_read((select id from public.conversations limit 1))$$, 'bea reads it');
select is((select unread from public.get_chats()), 0, 'nothing unread after reading');
select set_config('test.conv', (select id from public.conversations limit 1)::text, true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000104","role":"authenticated"}', true);
select is((select count(*)::int from public.messages), 0, 'outsiders read no messages');
select throws_ok(format('select public.send_message(%L, null, %L, %L)',
  current_setting('test.conv'), 'text', 'hola'),
  '42501', null, 'outsiders cannot post into a conversation');

-- Report and block
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000102","role":"authenticated"}', true);
select lives_ok(format('select public.report(%L, %L, %L)', 'message',
  (select min(id) from public.messages)::text, 'harassment'), 'bea reports a message');
select lives_ok($$insert into public.blocks (blocked_id) values ('00000000-0000-0000-0000-000000000101')$$,
  'bea blocks ana');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000101","role":"authenticated"}', true);
select throws_ok($$select public.send_message(null, '00000000-0000-0000-0000-000000000102', 'text', 'hola?')$$,
  'BK010', null, 'blocked: cannot write');
select is((select count(*)::int from public.blocks), 0, 'ana cannot see who blocked her');

-- New account: 5 new chats a day (ana has 2: bea, cris)
select lives_ok($$select public.send_message(null, ('00000000-0000-0000-0000-0000000001' || i)::uuid, 'text', 'hola')
  from (values ('05'), ('06'), ('07')) v(i)$$, 'three more new chats');
select throws_ok($$select public.send_message(null, '00000000-0000-0000-0000-000000000108', 'text', 'hola')$$,
  'BK012', null, 'sixth new chat in a day refused');

-- Server side: report kept context, retention
reset role;
select is((select jsonb_array_length(snapshot) from public.reports), 2, 'report keeps the surrounding messages');
update public.conversations set last_message_at = now() - interval '91 days';
select is(public.purge_old_chats(), 4, 'old chats purged, the reported one kept');
select is((select count(*)::int from public.conversations where held_at is not null), 1, 'held conversation stays');

select * from finish();
rollback;
