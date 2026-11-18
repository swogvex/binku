// Turns the owner-edited catalog file (nested, short local ids) into flat table rows.
// Shared by the app (first-launch offline snapshot) and scripts/catalog-seed.ts (Supabase seed),
// so both derive the same ids. No imports: Node runs this file directly.

type EraName = 'tomato' | 'cobalt' | 'mango' | 'mint' | 'bubblegum';
type ReleaseKind = 'album' | 'single' | 'sg' | 'event' | 'other';
export type CardType = 'album' | 'pob' | 'lucky_draw' | 'event' | 'season_greetings' | 'other';

export type CatalogFile = {
  groups: {
    id: string;
    name: string;
    name_ko?: string;
    monogram: string;
    color: EraName;
    members: { id: string; name: string; name_ko?: string; birth_year?: number }[];
    releases: {
      id: string;
      title: string;
      kind: ReleaseKind;
      year: number;
      era_color: EraName;
      versions?: { id: string; label: string }[];
      cards: {
        /** Optional override when two cards would get the same derived id. */
        id?: string;
        member: string;
        version?: string;
        type: CardType;
        store?: string;
        special?: boolean;
      }[];
    }[];
  }[];
};

export type GroupRow = {
  id: string;
  name: string;
  name_ko: string | null;
  monogram: string;
  color: EraName;
  status: 'approved';
};
export type MemberRow = {
  id: string;
  group_id: string;
  name: string;
  name_ko: string | null;
  birth_year: number | null;
  status: 'approved';
};
export type ReleaseRow = {
  id: string;
  group_id: string;
  title: string;
  kind: ReleaseKind;
  year: number;
  era_color: EraName;
  status: 'approved';
};
export type VersionRow = { id: string; release_id: string; label: string };
export type CardRow = {
  id: string;
  group_id: string;
  member_id: string;
  release_id: string;
  version_id: string | null;
  type: CardType;
  store: string | null;
  year: number;
  is_special: boolean;
  status: 'approved';
};
export type CatalogRows = {
  groups: GroupRow[];
  members: MemberRow[];
  releases: ReleaseRow[];
  versions: VersionRow[];
  cards: CardRow[];
};

const ERAS = ['tomato', 'cobalt', 'mango', 'mint', 'bubblegum'];
const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export function flattenCatalog(file: CatalogFile): CatalogRows {
  const out: CatalogRows = { groups: [], members: [], releases: [], versions: [], cards: [] };
  const seen = new Set<string>();
  const add = <T extends { id: string }>(list: T[], row: T) => {
    if (seen.has(row.id)) throw new Error(`Duplicate catalog id "${row.id}"`);
    seen.add(row.id);
    list.push(row);
  };
  const where = (...p: string[]) => p.join(' › ');

  for (const g of file.groups) {
    if (!ERAS.includes(g.color)) throw new Error(`${where(g.id)}: unknown color "${g.color}"`);
    add(out.groups, {
      id: g.id,
      name: g.name,
      name_ko: g.name_ko ?? null,
      monogram: g.monogram,
      color: g.color,
      status: 'approved',
    });
    const members = new Map<string, string>();
    for (const m of g.members) {
      const id = `${g.id}-${m.id}`;
      members.set(m.id, id);
      add(out.members, {
        id,
        group_id: g.id,
        name: m.name,
        name_ko: m.name_ko ?? null,
        birth_year: m.birth_year ?? null,
        status: 'approved',
      });
    }
    for (const r of g.releases) {
      const releaseId = `${g.id}-${r.id}`;
      if (!ERAS.includes(r.era_color))
        throw new Error(`${where(g.id, r.id)}: unknown era_color "${r.era_color}"`);
      add(out.releases, {
        id: releaseId,
        group_id: g.id,
        title: r.title,
        kind: r.kind,
        year: r.year,
        era_color: r.era_color,
        status: 'approved',
      });
      const versions = new Map<string, string>();
      for (const v of r.versions ?? []) {
        const id = `${releaseId}-${v.id}`;
        versions.set(v.id, id);
        add(out.versions, { id, release_id: releaseId, label: v.label });
      }
      for (const c of r.cards) {
        const memberId = members.get(c.member);
        if (!memberId) throw new Error(`${where(g.id, r.id)}: unknown member "${c.member}"`);
        const versionId = c.version === undefined ? null : versions.get(c.version);
        if (versionId === undefined)
          throw new Error(`${where(g.id, r.id)}: unknown version "${c.version}"`);
        const derived = [releaseId, c.version, c.member, c.type, c.store]
          .filter(Boolean)
          .map((p) => slug(p!))
          .join('-');
        add(out.cards, {
          id: c.id ? `${releaseId}-${c.id}` : derived,
          group_id: g.id,
          member_id: memberId,
          release_id: releaseId,
          version_id: versionId,
          type: c.type,
          store: c.store ?? null,
          year: r.year,
          is_special: c.special ?? c.type !== 'album',
          status: 'approved',
        });
      }
    }
  }
  return out;
}
