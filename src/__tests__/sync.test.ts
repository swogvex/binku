import { isPermanent } from '@/data/outbox';
import { isUuid, uuid } from '@/lib/uuid';

test('only data rejections are dropped; everything else is retried', () => {
  expect(isPermanent('23505')).toBe(true); // unique violation
  expect(isPermanent('23514')).toBe(true); // check violation
  expect(isPermanent('22P02')).toBe(true); // bad value
  expect(isPermanent('42501')).toBe(true); // RLS
  expect(isPermanent('42P01')).toBe(false); // table missing (bad deploy): keep the data
  expect(isPermanent('42883')).toBe(false); // function missing
  expect(isPermanent('PGRST301')).toBe(false); // expired token
  expect(isPermanent('')).toBe(false); // offline
  expect(isPermanent(undefined)).toBe(false);
});

test('ids are valid v4 uuids the server accepts', () => {
  const ids = Array.from({ length: 200 }, uuid);
  expect(ids.every(isUuid)).toBe(true);
  expect(ids.every((id) => id[14] === '4' && '89ab'.includes(id[19]))).toBe(true);
  expect(new Set(ids).size).toBe(ids.length);
  expect(isUuid('b-lq3k2-abc123')).toBe(false);
});
