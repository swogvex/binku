import { chatError, type Chat } from '@/data/chat';
import { chatTime, preview, sameDay, viewerSides } from '@/features/chat/ChatParts';

jest.mock('@/lib/supabase', () => ({}));

test('server refusals map to the copy that explains them', () => {
  expect(chatError({ code: 'BK016', message: 'phone' })).toBe('chat.err.phone');
  expect(chatError({ code: 'BK016', message: 'handle' })).toBe('chat.err.handle');
  // the reason "insult" (or anything unknown) never echoes the server text
  expect(chatError({ code: 'BK016', message: '<b>x</b>' })).toBe('chat.err.insult');
  expect(chatError({ code: 'BK010' })).toBe('chat.err.blocked');
  expect(chatError({ code: 'BK015' })).toBe('chat.err.structured');
  expect(chatError(new TypeError('Network request failed'))).toBe('chat.err.offline');
});

test('an offer is shown from the viewer: what I give and what I get', () => {
  const offer = { type: 'offer' as const, give: ['a'], get: ['b'] };
  expect(viewerSides(offer, true)).toEqual({ give: ['a'], get: ['b'] });
  expect(viewerSides(offer, false)).toEqual({ give: ['b'], get: ['a'] });
});

test('times: today shows the clock, yesterday a word, older a date', () => {
  const now = new Date();
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 12);
  expect(chatTime(now.toISOString())).toMatch(/\d{1,2}:\d{2}/);
  expect(chatTime(yesterday.toISOString())).toBe('yesterday');
  expect(sameDay(now.toISOString(), yesterday.toISOString())).toBe(false);
});

test('inbox preview says when the last message was mine', () => {
  const chat = { last_kind: 'text', last_body: 'hola', last_mine: true } as Chat;
  expect(preview(chat, [])).toBe('You: hola');
  expect(preview({ ...chat, last_mine: false }, [])).toBe('hola');
});
