// Pieces shared by Home, the matches list and the match detail.
import { useRouter } from 'expo-router';
import { View } from 'react-native';

import geo from '@/content/geo/subdivisions.json';
import type { CatalogCard } from '@/data/catalog';
import { markerProps } from '@/features/catalog/cardView';
import { t, type TKey } from '@/i18n';
import { textOn } from '@/lib/contrast';
import { cardRatio, era, fonts } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { CardMarker } from '@/ui/CardMarker';
import { Icon } from '@/ui/icons/Icon';
import { Txt } from '@/ui/Txt';

import type { Match } from './useMatches';

type Geo = Record<string, { subdivisions: { code: string; name: string }[] }>;
// Hermes has no Intl.DisplayNames: names come from the dictionary (launch countries).
const NAMED = ['ES', 'MX', 'AR', 'CO', 'CL', 'PE'];

/** "Valencia" at home, "Ciudad de México · México" abroad. Never a city or anything finer. */
export function placeName(m: Pick<Match, 'country' | 'subdivision' | 'proximity'>) {
  const sub = (geo as Geo)[m.country]?.subdivisions.find((s) => s.code === m.subdivision)?.name;
  if (m.proximity <= 1) return sub ?? '';
  const country = NAMED.includes(m.country)
    ? t(`onboarding.place.countries.${m.country}` as TKey)
    : m.country;
  return sub ? `${sub} · ${country}` : country;
}

const AVATAR_COLORS = Object.values(era);
export function Avatar({ username, size = 40 }: { username: string; size?: number }) {
  // Same letter + colour for the same person everywhere; no photos of people.
  const bg =
    AVATAR_COLORS[[...username].reduce((n, ch) => n + ch.charCodeAt(0), 0) % AVATAR_COLORS.length];
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Txt
        allowFontScaling={false}
        style={{ fontFamily: fonts.display800, fontSize: size / 2, color: textOn(bg) }}
      >
        {username[0]!.toUpperCase()}
      </Txt>
    </View>
  );
}

/** Tag "Doble" / "Simple" (+ "Envío internacional" across borders). */
export function MatchTags({ m }: { m: Match }) {
  const c = useTheme();
  const tags = [t(`matches.${m.kind}`), ...(m.proximity === 3 ? [t('matches.international')] : [])];
  return (
    <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
      {tags.map((label, i) => (
        <View
          key={label}
          style={{
            paddingHorizontal: 8,
            paddingVertical: 2,
            borderRadius: 999,
            backgroundColor: i === 0 && m.kind === 'double' ? c.ink : c.surface2,
          }}
        >
          <Txt size={12} variant="label" color={i === 0 && m.kind === 'double' ? c.onInk : c.ink}>
            {label}
          </Txt>
        </View>
      ))}
    </View>
  );
}

/** One side of the swap: label + first card + "+N" for the rest. */
type SideProps = {
  label: string;
  ids: string[];
  cards: CatalogCard[];
  width: number;
  tappable: boolean;
};
function Side({ label, ids, cards, width, tappable }: SideProps) {
  const router = useRouter();
  const first = cards.find((x) => x.id === ids[0]);
  return (
    <View style={{ gap: 4, alignItems: 'flex-start' }}>
      <Txt size={12} muted>
        {ids.length > 1 ? t('matches.more', { label, n: ids.length - 1 }) : label}
      </Txt>
      {first ? (
        <CardMarker
          {...markerProps(first)}
          width={width}
          onPress={
            tappable
              ? () => router.push({ pathname: '/card/[id]', params: { id: first.id } })
              : undefined
          }
          decorative={!tappable}
        />
      ) : (
        <View style={{ width, height: width / cardRatio }} />
      )}
    </View>
  );
}

/** "Te da" ⇄ "Le das" (a single match shows only the side that exists). */
export function SwapRow({
  m,
  cards,
  width = 74,
  tappable = true,
}: {
  m: Match;
  cards: CatalogCard[];
  width?: number;
  /** false inside a row that is itself a button */
  tappable?: boolean;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      {m.they_give.length ? (
        <Side
          label={t('matches.theyGive')}
          ids={m.they_give}
          cards={cards}
          width={width}
          tappable={tappable}
        />
      ) : null}
      {m.they_give.length && m.you_give.length ? (
        <View style={{ flex: 1, alignItems: 'center' }} importantForAccessibility="no">
          <Icon name="swap" size={28} />
        </View>
      ) : null}
      {m.you_give.length ? (
        <Side
          label={t('matches.youGive')}
          ids={m.you_give}
          cards={cards}
          width={width}
          tappable={tappable}
        />
      ) : null}
    </View>
  );
}
