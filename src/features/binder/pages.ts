// Pure binder logic: which cards a binder holds, in what order, split into pages.
import type { CatalogCard, UserMark } from '@/data/catalog';
import { filterCards, emptyFilter, type Path } from '@/features/catalog/filter';

/** Cards matching the binder filter: saved order first, then new catalog cards at the end. */
export function binderCards(cards: CatalogCard[], filter: Path, order: string[]) {
  const matching = filterCards(cards, { ...emptyFilter, path: filter }, new Map());
  const byId = new Map(matching.map((c) => [c.id, c]));
  const saved = order.filter((id) => byId.has(id));
  const savedSet = new Set(saved);
  return [...saved.map((id) => byId.get(id)!), ...matching.filter((c) => !savedSet.has(c.id))];
}

export function toPages<T>(items: T[], perPage: number): T[][] {
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += perPage) pages.push(items.slice(i, i + perPage));
  return pages.length ? pages : [[]];
}

/** Swaps two pockets (drag and drop, or the accessibility move actions). */
export function swap<T>(items: T[], a: number, b: number): T[] {
  const next = [...items];
  [next[a], next[b]] = [next[b], next[a]];
  return next;
}

export const owned = (mark?: UserMark) => mark?.status === 'have' || mark?.status === 'dupe';
