// Maps catalog rows to CardMarker props (shared by catalog grid, card sheet and binder).
import type { CatalogCard, UserMark } from '@/data/catalog';
import type { CardType } from '@/data/catalogFile';
import { t } from '@/i18n';
import type { CardFormat, CardState } from '@/ui/CardMarker';

const formats: Record<CardType, CardFormat> = {
  album: 'album',
  pob: 'pob',
  lucky_draw: 'luckyDraw',
  event: 'event',
  season_greetings: 'seasonGreetings',
  other: 'other',
};

export function markerProps(card: CatalogCard, mark?: UserMark) {
  const state: CardState | undefined = !mark
    ? undefined
    : mark.status === 'dupe'
      ? { kind: 'dupe', count: mark.qty }
      : { kind: mark.status };
  return {
    member: card.memberName,
    album: card.releaseTitle,
    version: card.versionLabel ?? t(`catalog.type.${card.type}`),
    // what fits on the card face ("SG", "LD"): fans' own shorthand; screen readers get `version`
    short: card.versionLabel ?? t(`catalog.typeShort.${card.type}`),
    format: formats[card.type],
    eraColor: card.eraColor,
    state,
  };
}
