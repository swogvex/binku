// Pieces shared by Home, the matches list and the match detail.
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
        // own line height: the body default is shorter than this glyph and clips its top
        style={{
          fontFamily: fonts.display800,
          fontSize: size / 2,
          lineHeight: size * 0.62,
          includeFontPadding: false,
          color: textOn(bg),
        }}
      >
        {username[0]!.toUpperCase()}
      </Txt>
    </View>
  );
}

/** "Envío internacional" across borders (every match is mutual, so no Doble/Simple tag). */
export function MatchTags({ m }: { m: Match }) {
  const c = useTheme();
  if (m.proximity !== 3) return null;
  return (
    <View
      style={{
        paddingHorizontal: 10,
        paddingVertical: 2,
        borderRadius: 999,
        borderWidth: 1.5,
        borderColor: c.line,
      }}
    >
      <Txt size={12} variant="label">
        {t('matches.international')}
      </Txt>
    </View>
  );
}

const PEEK = 6; // how far each card behind peeks out of the stack

/**
 * A small stack: the first card in front, up to two more peeking out behind it, "+N" for the
 * rest. Same footprint for one card or ten, so both sides of a swap stay symmetric.
 * Illustration only.
 */
function Fan({
  ids,
  cards,
  width,
  tilt,
}: {
  ids: string[];
  cards: CatalogCard[];
  width: number;
  /** the two sides lean towards each other */
  tilt: number;
}) {
  const c = useTheme();
  const shown = ids
    .slice(0, 3)
    .map((id) => cards.find((x) => x.id === id))
    .filter((x): x is CatalogCard => !!x);
  const height = width / cardRatio;
  const lean = Math.sign(tilt) || 1;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: width + PEEK * 4, height: height + 10 }}
    >
      {/* drawn back to front */}
      {shown
        .map((card, i) => ({ card, i }))
        .reverse()
        .map(({ card, i }) => (
          <View
            key={card.id}
            style={{
              position: 'absolute',
              top: 5,
              left: PEEK * 2 + lean * i * PEEK,
              transform: [{ rotate: `${tilt + lean * i * 6}deg` }],
              opacity: i ? 0.9 : 1,
            }}
          >
            <CardMarker {...markerProps(card)} width={width} decorative />
          </View>
        ))}
      {ids.length > 1 ? (
        <View
          style={{
            position: 'absolute',
            right: 0,
            bottom: 0,
            minWidth: 28,
            height: 28,
            paddingHorizontal: 6,
            borderRadius: 14,
            backgroundColor: c.ink,
            borderWidth: 2,
            borderColor: c.surface,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Txt size={12} variant="label" color={c.onInk} allowFontScaling={false}>
            {`×${ids.length}`}
          </Txt>
        </View>
      ) : null}
    </View>
  );
}

function Side({
  label,
  ids,
  cards,
  width,
  tilt,
}: {
  label: string;
  ids: string[];
  cards: CatalogCard[];
  width: number;
  tilt: number;
}) {
  return (
    <View style={{ gap: 8, alignItems: 'center' }}>
      <Txt size={12} variant="label" muted>
        {`${label} · ${ids.length}`}
      </Txt>
      <Fan ids={ids} cards={cards} width={width} tilt={tilt} />
    </View>
  );
}

/** "Te da" ⇄ "Le das": every match is mutual, so both sides always have cards. */
export function SwapRow({
  m,
  cards,
  width = 80,
}: {
  m: Match;
  cards: CatalogCard[];
  width?: number;
}) {
  const c = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={`${t('matches.theyGive')}: ${m.they_give.length}. ${t('matches.youGive')}: ${m.you_give.length}.`}
      // Centred and close together: the two cards read as one swap, not two far corners.
      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14 }}
    >
      <Side
        label={t('matches.theyGive')}
        ids={m.they_give}
        cards={cards}
        width={width}
        tilt={4}
      />
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: c.surface2,
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: 26,
        }}
      >
        <Icon name="swap" size={22} />
      </View>
      <Side
        label={t('matches.youGive')}
        ids={m.you_give}
        cards={cards}
        width={width}
        tilt={-4}
      />
    </View>
  );
}
