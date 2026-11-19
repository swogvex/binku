// Full-screen card ("abrir la carta por completo"): only for cards in the user's own collection.
// Just the card on black, as large as the screen allows, still turnable, flippable and holo.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { owned } from '@/features/binder/pages';
import { Card3D } from '@/features/card/Card3D';
import { CardBack } from '@/features/card/CardBack';
import { markerProps } from '@/features/catalog/cardView';
import { useCatalogData } from '@/features/catalog/useCatalog';
import { t } from '@/i18n';
import { cardRatio, colors } from '@/theme/tokens';
import { CardMarker } from '@/ui/CardMarker';
import { RoundButton } from '@/ui/RoundButton';
import { ScanFrame } from '@/ui/ScanFrame';
import { Txt } from '@/ui/Txt';

export default function CardViewer() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { cards, marks, photos } = useCatalogData();
  const card = cards.find((x) => x.id === id);
  const mark = card ? marks.get(card.id) : undefined;
  const photo = card ? photos.get(card.id)?.scan?.uri : undefined;

  // Largest card that fits beside the close button and the hint (room for the 3D turn).
  const cardW = Math.floor(
    Math.min(width - 48, (height - insets.top - insets.bottom - 180) * cardRatio),
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.dark.bg }}>
      <StatusBar style="light" />
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingHorizontal: 16,
          alignItems: 'flex-end',
        }}
      >
        <RoundButton icon="close" label={t('viewer.close')} onPress={() => router.back()} />
      </View>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        {/* Only the owner's collection opens full screen (a deep link to another card shows nothing). */}
        {card && owned(mark) ? (
          <Card3D
            width={cardW}
            label={`${card.memberName}, ${card.releaseTitle}, ${markerProps(card).version}`}
            front={(rotate) =>
              photo ? (
                <ScanFrame
                  source={{ uri: photo }}
                  member={card.memberName}
                  holo={card.isSpecial}
                  width={cardW}
                />
              ) : (
                <CardMarker
                  {...markerProps(card, mark)}
                  holo={card.isSpecial}
                  holoRotate={rotate}
                  width={cardW}
                />
              )
            }
            back={
              <CardBack
                width={cardW}
                color={card.groupColor}
                monogram={card.groupMonogram}
                groupName={card.groupName}
              />
            }
          />
        ) : null}
      </View>
      <Txt
        size={13}
        color={colors.dark.muted}
        style={{ textAlign: 'center', paddingHorizontal: 24, paddingBottom: insets.bottom + 20 }}
      >
        {t('cardSheet.turnHint')}
      </Txt>
    </View>
  );
}
