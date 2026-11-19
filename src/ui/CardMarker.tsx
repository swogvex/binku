import { Pressable, View } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { t } from '@/i18n';
import { textOn } from '@/lib/contrast';
import { cardRadius, cardRatio, colors, era, fonts, type Era } from '@/theme/tokens';

import { Holo } from './Holo';
import { Txt } from './Txt';

export type CardFormat = 'album' | 'pob' | 'luckyDraw' | 'event' | 'seasonGreetings' | 'other';
export type CardState = { kind: 'have' } | { kind: 'want' } | { kind: 'dupe'; count: number };

type Props = {
  member: string;
  album: string;
  version: string;
  /** Shorter text for the card face; `version` stays in the accessibility label. */
  short?: string;
  format: CardFormat;
  eraColor: Era;
  state?: CardState;
  width?: number;
  /** Iridescent shine for special cards (lucky draw, POB, event, user-marked). */
  holo?: boolean;
  /** Finger rotation for the 3D view, forwarded to the holo shine. */
  holoRotate?: { x: SharedValue<number>; y: SharedValue<number> };
  /** Makes the whole card a button that keeps the card's accessibility label. */
  onPress?: () => void;
  /** Illustration only (hidden from screen readers): text keeps its size at any font scale. */
  decorative?: boolean;
};

function FormatMark({ format, color }: { format: CardFormat; color: string }) {
  const shape = {
    album: <Rect x={1} y={1} width={10} height={10} rx={1.5} fill={color} />,
    pob: <Path d="M6 0.5 11.5 6 6 11.5 0.5 6z" fill={color} />,
    luckyDraw: <Circle cx={6} cy={6} r={5.2} fill={color} />,
    event: <Path d="M6 1 11.5 11H0.5z" fill={color} />,
    // outlined variants of album/lucky draw: less common formats, same visual family
    seasonGreetings: (
      <Rect
        x={1.8}
        y={1.8}
        width={8.4}
        height={8.4}
        rx={1.2}
        fill="none"
        stroke={color}
        strokeWidth={1.6}
      />
    ),
    other: <Circle cx={6} cy={6} r={4.4} fill="none" stroke={color} strokeWidth={1.6} />,
  }[format];
  return (
    <Svg width={12} height={12} viewBox="0 0 12 12">
      {shape}
    </Svg>
  );
}

/**
 * Compact mark state: T (Tengo) filled, B (Busco) outlined = still missing, R×n (Repetida) filled
 * with the count. Sits in a corner so it never covers the face on a photocard. Decorative: the
 * card's accessibility label already says the state in words.
 */
export function StateBadge({
  state,
  on,
  small,
}: {
  state: CardState;
  on: string;
  small?: boolean;
}) {
  const fg = textOn(on);
  const filled = state.kind !== 'want';
  const label =
    state.kind === 'dupe'
      ? t('card.short.dupe', { count: state.count })
      : t(`card.short.${state.kind}`);
  const size = small ? 18 : 22;
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={{
        minWidth: size,
        height: size,
        paddingHorizontal: state.kind === 'dupe' ? 6 : 0,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        // Filled badges are ink on every era colour; a thin ring keeps them apart from dark eras.
        backgroundColor: filled ? colors.light.ink : 'transparent',
        borderWidth: 1.5,
        borderColor: filled ? colors.light.onInk : fg,
      }}
    >
      <Txt
        variant="label"
        size={small ? 12 : 13}
        color={filled ? colors.light.onInk : fg}
        allowFontScaling={false}
        style={{ fontFamily: fonts.text700, lineHeight: small ? 14 : 16 }}
      >
        {label}
      </Txt>
    </View>
  );
}

/** Placeholder card shown until the user scans their own photo. */
export function CardMarker({
  member,
  album,
  version,
  short,
  format,
  eraColor,
  state,
  width = 110,
  holo = false,
  onPress,
  holoRotate,
  decorative = false,
}: Props) {
  const bg = era[eraColor];
  const fg = textOn(bg);
  const stateLabel =
    state &&
    (state.kind === 'dupe' ? t('card.dupe', { count: state.count }) : t(`card.${state.kind}`));
  const a11y = [
    t('card.a11y', { member, album, version, format: t(`card.format.${format}`) }),
    stateLabel,
  ]
    .filter(Boolean)
    .join(', ');

  const Container = onPress ? Pressable : View;
  return (
    <Container
      accessible
      accessibilityRole={onPress ? 'button' : undefined}
      onPress={onPress}
      accessibilityLabel={a11y}
      style={{
        width,
        aspectRatio: cardRatio,
        borderRadius: cardRadius(width),
        backgroundColor: bg,
        padding: Math.round(width * 0.08),
        justifyContent: 'space-between',
        overflow: 'hidden',
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Txt
          variant="label"
          size={12}
          color={fg}
          numberOfLines={1}
          maxFontSizeMultiplier={1.3}
          allowFontScaling={!decorative}
          style={{ flexShrink: 1 }}
        >
          {short ?? version}
        </Txt>
        <FormatMark format={format} color={fg} />
      </View>
      {/* Name bottom-left, state badge bottom-right: the middle stays clear (that is where the
          face is on a real photocard). */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6 }}>
        <View style={{ flex: 1 }}>
          <Txt
            variant="display"
            size={22}
            color={fg}
            numberOfLines={1}
            maxFontSizeMultiplier={1.3}
            allowFontScaling={!decorative}
          >
            {member}
          </Txt>
          <Txt
            variant="body"
            size={12}
            color={fg}
            numberOfLines={1}
            maxFontSizeMultiplier={1.3}
            allowFontScaling={!decorative}
          >
            {album}
          </Txt>
        </View>
        {state ? <StateBadge state={state} on={bg} small={width < 90} /> : null}
      </View>
      {holo ? <Holo width={width} rotateX={holoRotate?.x} rotateY={holoRotate?.y} /> : null}
    </Container>
  );
}
