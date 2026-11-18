import { Pressable, View } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { t } from '@/i18n';
import { textOn } from '@/lib/contrast';
import { cardRadius, cardRatio, colors, era, type Era } from '@/theme/tokens';

import { Holo } from './Holo';
import { Txt } from './Txt';

export type CardFormat = 'album' | 'pob' | 'luckyDraw' | 'event' | 'seasonGreetings' | 'other';
export type CardState = { kind: 'have' } | { kind: 'want' } | { kind: 'dupe'; count: number };

type Props = {
  member: string;
  album: string;
  version: string;
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

/** Placeholder card shown until the user scans their own photo. */
export function CardMarker({
  member,
  album,
  version,
  format,
  eraColor,
  state,
  width = 110,
  holo = false,
  onPress,
  holoRotate,
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
        <Txt variant="label" size={12} color={fg} numberOfLines={1} style={{ flexShrink: 1 }}>
          {version}
        </Txt>
        <FormatMark format={format} color={fg} />
      </View>
      {stateLabel ? (
        <View
          style={{
            alignSelf: 'flex-start',
            paddingHorizontal: 6,
            paddingVertical: 2,
            borderRadius: 999,
            borderWidth: 1.5,
            borderColor: state?.kind === 'have' ? colors.light.ink : fg,
            backgroundColor: state?.kind === 'have' ? colors.light.ink : 'transparent',
          }}
        >
          <Txt
            variant="label"
            size={12}
            color={state?.kind === 'have' ? colors.light.onInk : fg}
            numberOfLines={1}
          >
            {stateLabel}
          </Txt>
        </View>
      ) : null}
      <View>
        <Txt variant="display" size={22} color={fg} numberOfLines={1} maxFontSizeMultiplier={1.3}>
          {member}
        </Txt>
        <Txt variant="body" size={12} color={fg} numberOfLines={1} maxFontSizeMultiplier={1.3}>
          {album}
        </Txt>
      </View>
      {holo ? <Holo width={width} rotateX={holoRotate?.x} rotateY={holoRotate?.y} /> : null}
    </Container>
  );
}
