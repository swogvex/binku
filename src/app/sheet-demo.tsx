// Dev-only: shows the native sheet presentation from `sheetOptions`.
import { Redirect, router } from 'expo-router';
import { View } from 'react-native';

import { screenPadding } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { Button } from '@/ui/Button';
import { CardMarker } from '@/ui/CardMarker';
import { Txt } from '@/ui/Txt';

export default function SheetDemo() {
  const c = useTheme();
  if (!__DEV__) return <Redirect href="/" />;
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: c.surface,
        padding: screenPadding,
        paddingTop: 28,
        gap: 14,
      }}
    >
      <View style={{ flexDirection: 'row', gap: 14 }}>
        <CardMarker
          member="Jiwan"
          album="Paper Moon"
          version="Ver. A"
          format="album"
          eraColor="tomato"
          width={90}
        />
        <View style={{ flex: 1, gap: 4 }}>
          <Txt variant="display" size={28} accessibilityRole="header">
            Jiwan
          </Txt>
          <Txt muted>NEVIRA · Paper Moon</Txt>
        </View>
      </View>
      <Button label="Cerrar" onPress={() => router.back()} />
    </View>
  );
}
