import type { SQLiteDatabase } from 'expo-sqlite';

import catalogJson from '@/content/catalog/catalog.json';
import geo from '@/content/geo/subdivisions.json';
import { flattenCatalog, type CatalogFile } from '@/data/catalogFile';
import { pullCatalog } from '@/data/catalogSync';

const tiny = (cards: CatalogFile['groups'][0]['releases'][0]['cards']): CatalogFile => ({
  groups: [
    {
      id: 'g',
      name: 'G',
      monogram: 'G',
      color: 'mint',
      members: [{ id: 'ana', name: 'Ana' }],
      releases: [
        {
          id: 'r1',
          title: 'R',
          kind: 'album',
          year: 2025,
          era_color: 'mango',
          versions: [{ id: 'a', label: 'Ver. A' }],
          cards,
        },
      ],
    },
  ],
});

describe('catalog file', () => {
  it('the owner catalog file is valid', () => {
    const rows = flattenCatalog(catalogJson as CatalogFile);
    expect(rows.cards.length).toBeGreaterThan(0);
  });

  it('derives readable stable ids', () => {
    const rows = flattenCatalog(
      tiny([
        { member: 'ana', version: 'a', type: 'album' },
        { member: 'ana', type: 'pob', store: 'Tienda Ñu' },
      ]),
    );
    expect(rows.cards.map((c) => c.id)).toEqual(['g-r1-a-ana-album', 'g-r1-ana-pob-tienda-nu']);
    expect(rows.cards[0]).toMatchObject({
      member_id: 'g-ana',
      version_id: 'g-r1-a',
      is_special: false,
    });
    expect(rows.cards[1].is_special).toBe(true);
  });

  it('rejects unknown references and duplicates', () => {
    expect(() => flattenCatalog(tiny([{ member: 'bo', type: 'album' }]))).toThrow('unknown member');
    expect(() => flattenCatalog(tiny([{ member: 'ana', version: 'z', type: 'album' }]))).toThrow(
      'unknown version',
    );
    const dup = { member: 'ana', type: 'lucky_draw' } as const;
    expect(() => flattenCatalog(tiny([dup, dup]))).toThrow('Duplicate');
  });
});

describe('geo subdivisions', () => {
  it('has unique ISO 3166-2 codes per country', () => {
    for (const [country, { subdivisions }] of Object.entries(geo)) {
      const codes = subdivisions.map((s) => s.code);
      expect(new Set(codes).size).toBe(codes.length);
      for (const s of subdivisions) {
        expect(s.code.startsWith(`${country}-`)).toBe(true);
        expect(s.name.trim()).not.toBe('');
      }
    }
    expect(geo.ES.subdivisions).toHaveLength(52);
  });
});

describe('pullCatalog', () => {
  function fakeDb() {
    const kv = new Map<string, string>();
    const upserts: string[] = [];
    const deletes: string[] = [];
    const db = {
      getFirstSync: (_sql: string, key: string) =>
        kv.has(key) ? { value: kv.get(key) } : undefined,
      runSync: (sql: string, a: string, b?: string) => {
        if (sql.startsWith('insert or replace into kv')) kv.set(a, b!);
        else deletes.push(a);
      },
      prepareSync: (sql: string) => ({
        executeSync: (values: unknown[]) => upserts.push(`${sql.split(' ')[4]}:${values[0]}`),
        finalizeSync: () => {},
      }),
      withTransactionSync: (fn: () => void) => fn(),
    };
    return { db: db as unknown as SQLiteDatabase, kv, upserts, deletes };
  }

  it('applies changes, deletes tombstones, pages on equal timestamps and moves the cursor', async () => {
    const { db, kv, upserts, deletes } = fakeDb();
    const t = '2026-11-18T10:00:00+00:00';
    const cards = [
      ...Array.from({ length: 1000 }, (_, i) => ({
        id: `c${i}`,
        status: 'approved',
        updated_at: t,
      })),
      { id: 'gone', status: 'hidden', updated_at: t },
    ];
    const calls: string[] = [];
    const n = await pullCatalog(db, async (table, since, offset) => {
      calls.push(`${table}@${offset}`);
      return table === 'cards' ? cards.slice(offset, offset + 1000) : [];
    });

    expect(n).toBe(1001);
    expect(calls).toContain('cards@1000');
    expect(upserts.filter((u) => u.startsWith('cards:'))).toHaveLength(1000);
    expect(deletes).toEqual(['gone']);
    expect(kv.get('sync:cards')).toBe(t);
    expect(kv.get('sync:groups')).toBe('1970-01-01T00:00:00Z');
  });
});
