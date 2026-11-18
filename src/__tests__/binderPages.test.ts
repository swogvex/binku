import type { CatalogCard } from '@/data/catalog';
import { binderCards, swap, toPages } from '@/features/binder/pages';

const card = (id: string, groupId = 'g1', memberId = 'm1'): CatalogCard => ({
  id,
  groupId,
  groupName: groupId,
  groupMonogram: 'G',
  groupColor: 'mint',
  memberId,
  memberName: memberId,
  memberNameKo: null,
  releaseId: 'r1',
  releaseTitle: 'R',
  versionId: null,
  versionLabel: null,
  type: 'album',
  store: null,
  year: 2025,
  isSpecial: false,
  eraColor: 'mint',
});

describe('binder pages', () => {
  const cards = [card('a'), card('b', 'g1', 'm2'), card('c'), card('x', 'g2')];

  it('keeps the saved order, drops gone cards and appends new ones', () => {
    const ids = binderCards(cards, { group: 'g1' }, ['c', 'gone', 'a']).map((c) => c.id);
    expect(ids).toEqual(['c', 'a', 'b']);
    expect(binderCards(cards, { group: 'g1', member: 'm2' }, []).map((c) => c.id)).toEqual(['b']);
  });

  it('splits into pages and always has at least one page', () => {
    expect(toPages([1, 2, 3, 4, 5], 4)).toEqual([[1, 2, 3, 4], [5]]);
    expect(toPages([], 9)).toEqual([[]]);
  });

  it('swaps two pockets', () => {
    expect(swap(['a', 'b', 'c'], 0, 2)).toEqual(['c', 'b', 'a']);
  });
});
