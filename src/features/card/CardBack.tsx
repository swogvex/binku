// Back of a catalog card: group colour, a pattern of tiny binder pockets, the group monogram and
// the Binku mark. Never an official logo (logos stay off until rights are cleared).
import { View } from 'react-native';
import Svg, { Defs, Pattern, Rect } from 'react-native-svg';

import { textOn } from '@/lib/contrast';
import { cardRadius, cardRatio, era, type Era } from '@/theme/tokens';
import { Txt } from '@/ui/Txt';

type Props = { width: number; color: Era; monogram: string; groupName: string };

export function CardBack({ width, color, monogram, groupName }: Props) {
  const bg = era[color];
  const fg = textOn(bg);
  const badge = Math.round(width * 0.42);
  return (
    <View
      style={{
        width,
        aspectRatio: cardRatio,
        borderRadius: cardRadius(width),
        backgroundColor: bg,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Svg style={{ position: 'absolute' }} width="100%" height="100%">
        <Defs>
          <Pattern id="pockets" width={14} height={18} patternUnits="userSpaceOnUse">
            <Rect
              x={2}
              y={2}
              width={10}
              height={14}
              rx={2}
              fill="none"
              stroke={fg}
              strokeOpacity={0.18}
              strokeWidth={1.2}
            />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#pockets)" />
      </Svg>
      <View
        style={{
          width: badge,
          height: badge,
          borderRadius: badge / 2,
          borderWidth: 3,
          borderColor: fg,
          backgroundColor: bg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Txt variant="display" size={28} color={fg} maxFontSizeMultiplier={1.2}>
          {monogram}
        </Txt>
      </View>
      <Txt
        variant="label"
        size={12}
        color={fg}
        numberOfLines={1}
        style={{ marginTop: 8, maxWidth: '80%' }}
      >
        {groupName}
      </Txt>
      <Txt
        variant="display"
        size={13}
        color={fg}
        style={{ position: 'absolute', bottom: Math.round(width * 0.06), opacity: 0.8 }}
      >
        Binku
      </Txt>
    </View>
  );
}
