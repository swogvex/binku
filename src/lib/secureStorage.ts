// Supabase session storage in Keychain / Keystore. A session JSON can pass SecureStore's
// ~2 KB per-value limit, so values are split into chunks plus a count key.
import * as SecureStore from 'expo-secure-store';

// 600 chars ≤ 1,800 bytes even if every char takes 3 bytes in UTF-8.
const CHUNK = 600;

const count = async (key: string) => Number(await SecureStore.getItemAsync(`${key}.n`)) || 0;
const range = (n: number) => Array.from({ length: n }, (_, i) => i);

export const secureStorage = {
  async getItem(key: string) {
    const n = await count(key);
    if (!n) return null;
    const parts = await Promise.all(range(n).map((i) => SecureStore.getItemAsync(`${key}.${i}`)));
    return parts.includes(null) ? null : parts.join('');
  },
  async setItem(key: string, value: string) {
    const parts = range(Math.ceil(value.length / CHUNK)).map((i) =>
      value.slice(i * CHUNK, (i + 1) * CHUNK),
    );
    await Promise.all(parts.map((p, i) => SecureStore.setItemAsync(`${key}.${i}`, p)));
    // Count last: a half-written value is never read as complete.
    await SecureStore.setItemAsync(`${key}.n`, String(parts.length));
  },
  async removeItem(key: string) {
    const n = await count(key);
    await SecureStore.deleteItemAsync(`${key}.n`);
    await Promise.all(range(n).map((i) => SecureStore.deleteItemAsync(`${key}.${i}`)));
  },
};
