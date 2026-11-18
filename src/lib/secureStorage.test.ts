import { secureStorage } from './secureStorage';

jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    store,
    getItemAsync: async (k: string) => store.get(k) ?? null,
    setItemAsync: async (k: string, v: string) => void store.set(k, v),
    deleteItemAsync: async (k: string) => void store.delete(k),
  };
});

const { store } = jest.requireMock('expo-secure-store') as { store: Map<string, string> };

test('round-trips a value larger than one chunk and removes every chunk', async () => {
  const session = JSON.stringify({ token: 'x'.repeat(2500), user: { email: 'ñandú@test.es' } });
  await secureStorage.setItem('sb-auth', session);
  expect(store.size).toBeGreaterThan(2);
  for (const v of store.values()) expect(v.length).toBeLessThanOrEqual(600);
  expect(await secureStorage.getItem('sb-auth')).toBe(session);

  await secureStorage.removeItem('sb-auth');
  expect(store.size).toBe(0);
  expect(await secureStorage.getItem('sb-auth')).toBeNull();
});
