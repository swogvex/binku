import type { CatalogCard, UserMark } from '@/data/catalog';
import {
  crumbs,
  emptyFilter,
  filterCards,
  keepThrough,
  nextLevel,
  type Filter,
} from '@/features/catalog/filter';

const card = (id: string, o: Partial<CatalogCard>): CatalogCard => ({
  id,
  groupId: 'g1',
  groupName: 'Nova',
  groupMonogram: 'G',
  groupColor: 'mint',
  memberId: 'm1',
  memberName: 'Ari',
  memberNameKo: null,
  releaseId: 'r1',
  releaseTitle: 'Paper Moon',
  versionId: 'v1',
  versionLabel: 'Ver. A',
  type: 'album',
  store: null,
  year: 2025,
  isSpecial: false,
  eraColor: 'mint',
  ...o,
});

const cards = [
  card('a', {}),
  card('b', { memberId: 'm2', memberName: 'Bo', versionId: 'v2', versionLabel: 'Ver. B' }),
  card('c', { type: 'pob', versionId: null, versionLabel: null, store: 'Tienda Ñu' }),
  card('d', { groupId: 'g2', groupName: 'Lúmen', memberId: 'm9', memberName: 'Io' }),
];
const none = new Map<string, UserMark>();
const f = (o: Partial<Filter>): Filter => ({ ...emptyFilter, ...o });
const ids = (list: CatalogCard[]) => list.map((c) => c.id);

describe('catalog filter', () => {
  it('searches across fields, ignoring case and accents, all words must match', () => {
    expect(ids(filterCards(cards, f({ query: 'lumen' }), none))).toEqual(['d']);
    expect(ids(filterCards(cards, f({ query: 'nu tienda' }), none))).toEqual(['c']);
    expect(ids(filterCards(cards, f({ query: 'ari moon' }), none))).toEqual(['a', 'c']);
  });

  it('filters by path, type and own state', () => {
    expect(ids(filterCards(cards, f({ path: { group: 'g1', member: 'm2' } }), none))).toEqual([
      'b',
    ]);
    expect(ids(filterCards(cards, f({ type: 'pob' }), none))).toEqual(['c']);
    const marks = new Map<string, UserMark>([
      ['a', { status: 'have', qty: 1 }],
      ['b', { status: 'dupe', qty: 2 }],
      ['c', { status: 'want', qty: 1 }],
    ]);
    expect(ids(filterCards(cards, f({ state: 'have' }), marks))).toEqual(['a', 'b']);
    expect(ids(filterCards(cards, f({ state: 'dupe' }), marks))).toEqual(['b']);
    expect(ids(filterCards(cards, f({ state: 'missing' }), marks))).toEqual(['c', 'd']);
  });

  it('drills down group → member → album → version and stops when no versions', () => {
    expect(nextLevel(cards, f({}))?.options.map((o) => o.name)).toEqual(['Nova', 'Lúmen']);
    expect(nextLevel(cards, f({ path: { group: 'g1' } }))?.level).toBe('member');
    const path = { group: 'g1', member: 'm1', release: 'r1' };
    expect(nextLevel(cards, f({ path }))?.options).toEqual([{ id: 'v1', name: 'Ver. A' }]);
    expect(nextLevel(cards, f({ path: { ...path, version: 'v1' } }))).toBeNull();
  });

  it('builds breadcrumbs and goes back to a level', () => {
    const path = { group: 'g1', member: 'm2', release: 'r1' };
    expect(crumbs(cards, path).map((c) => c.name)).toEqual(['Nova', 'Bo', 'Paper Moon']);
    expect(keepThrough(path, 'member')).toEqual({ group: 'g1', member: 'm2' });
  });
});
