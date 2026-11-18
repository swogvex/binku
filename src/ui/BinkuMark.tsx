import { View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

import { useTheme } from '@/theme/useTheme';

import { Txt } from './Txt';

// Binku symbol (assets/brand/binku-symbol.svg): a 3×3 binder page with one filled pocket.
const pockets = [
  [23, 17],
  [43, 17],
  [63, 17],
  [23, 41],
  [43, 41],
  [23, 65],
  [43, 65],
  [63, 65],
];

/** Symbol + wordmark; `wordmark={false}` for the symbol alone (large brand art). */
export function BinkuMark({ size = 28, wordmark = true }: { size?: number; wordmark?: boolean }) {
  const c = useTheme();
  return (
    <View
      accessible
      accessibilityLabel="Binku"
      style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
    >
      <Svg width={size} height={size} viewBox="0 0 100 100">
        {pockets.map(([x, y]) => (
          <Rect
            key={`${x}-${y}`}
            x={x}
            y={y}
            width={14}
            height={19}
            rx={2.5}
            fill="none"
            stroke={c.ink}
            strokeWidth={2.4}
          />
        ))}
        <Rect x={62} y={40} width={16} height={21} rx={3} fill={c.ink} />
      </Svg>
      {wordmark ? (
        <Txt variant="display" size={22} importantForAccessibility="no">
          Binku
        </Txt>
      ) : null}
    </View>
  );
}
