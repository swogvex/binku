// Pure catalog filtering: search, drill-down path (group → member → album → version), type, state.
import type { CatalogCard, UserMark } from '@/data/catalog';
import type { CardType } from '@/data/catalogFile';

export type Level = 'group' | 'member' | 'release' | 'version';
export type Path = Partial<Record<Level, string>>;
export type OwnState = 'missing' | 'have' | 'dupe';

export type Filter = {
  query: string;
  path: Path;
  type: CardType | null;
  state: OwnState | null;
};

export const emptyFilter: Filter = { query: '', path: {}, type: null, state: null };

export const LEVELS: Level[] = ['group', 'member', 'release', 'version'];

const idOf: Record<Level, (c: CatalogCard) => string | null> = {
  group: (c) => c.groupId,
  member: (c) => c.memberId,
  release: (c) => c.releaseId,
  version: (c) => c.versionId,
};
const nameOf: Record<Level, (c: CatalogCard) => string | null> = {
  group: (c) => c.groupName,
  member: (c) => c.memberName,
  release: (c) => c.releaseTitle,
  version: (c) => c.versionLabel,
};

/** Lowercase, accents removed: "Álbum" matches "album". */
export const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

function haystack(c: CatalogCard) {
  return fold(
    [c.groupName, c.memberName, c.memberNameKo, c.releaseTitle, c.versionLabel, c.store]
      .filter(Boolean)
      .join(' '),
  );
}

function matchesState(mark: UserMark | undefined, state: OwnState) {
  if (state === 'missing') return !mark || mark.status === 'want';
  if (state === 'have') return mark?.status === 'have' || mark?.status === 'dupe';
  return mark?.status === 'dupe';
}

/** Cards matching everything except `type` and `state` (used for the chip options). */
function inPath(cards: CatalogCard[], f: Filter) {
  const words = fold(f.query).split(/\s+/).filter(Boolean);
  return cards.filter((c) => {
    for (const l of LEVELS) if (f.path[l] && idOf[l](c) !== f.path[l]) return false;
    if (!words.length) return true;
    const h = haystack(c);
    return words.every((w) => h.includes(w));
  });
}

export function filterCards(cards: CatalogCard[], f: Filter, marks: Map<string, UserMark>) {
  return inPath(cards, f).filter(
    (c) => (!f.type || c.type === f.type) && (!f.state || matchesState(marks.get(c.id), f.state)),
  );
}

/** Next drill-down level and its options, or null when the path is complete. */
export function nextLevel(cards: CatalogCard[], f: Filter) {
  const level = LEVELS.find((l) => !f.path[l]);
  if (!level) return null;
  const options = new Map<string, string>();
  for (const c of inPath(cards, f)) {
    const id = idOf[level](c);
    if (id && !options.has(id)) options.set(id, nameOf[level](c)!);
  }
  // Albums without versions (POB, season's greetings…) end the drill-down early.
  if (!options.size) return null;
  return { level, options: [...options].map(([id, name]) => ({ id, name })) };
}

/** Breadcrumb names for the selected path. */
export function crumbs(cards: CatalogCard[], path: Path) {
  return LEVELS.filter((l) => path[l]).map((level) => {
    const card = cards.find((c) => idOf[level](c) === path[level]);
    return { level, name: card ? nameOf[level](card)! : '' };
  });
}

/** Keeps the path down to `level` (inclusive): tapping a breadcrumb goes back to it. */
export function keepThrough(path: Path, level: Level): Path {
  const out: Path = {};
  for (const l of LEVELS) {
    if (path[l]) out[l] = path[l];
    if (l === level) break;
  }
  return out;
}
