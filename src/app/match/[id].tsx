// Match detail: who, where (subdivision only) and every card both ways. Proposing the trade
// needs chat (M6); their condition photos come with it.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { markerProps } from '@/features/catalog/cardView';
import { useCatalogData } from '@/features/catalog/useCatalog';
import { Avatar, MatchTags, placeName } from '@/features/matches/MatchParts';
import { useMatches } from '@/features/matches/useMatches';
import { t } from '@/i18n';
import { radius, screenPadding } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { CardMarker } from '@/ui/CardMarker';
import { Icon } from '@/ui/icons/Icon';
import { RoundButton } from '@/ui/RoundButton';
import { StateView } from '@/ui/StateView';
import { Txt } from '@/ui/Txt';

const COLS = 3;
const GAP = 10;

function Cards({ title, ids }: { title: string; ids: string[] }) {
  const c = useTheme();
  const router = useRouter();
  const { cards, marks } = useCatalogData();
  // Explicit sizes: aspectRatio children mis-measure inside flexWrap rows on Android.
  const width = Math.floor(
    (useWindowDimensions().width - screenPadding * 2 - GAP * (COLS - 1)) / COLS,
  );
  if (!ids.length) return null;
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Txt variant="title" size={17} accessibilityRole="header" style={{ flexShrink: 1 }}>
          {title}
        </Txt>
        <View style={{ paddingHorizontal: 8, borderRadius: 999, backgroundColor: c.surface2 }}>
          <Txt size={13} variant="label">
            {ids.length}
          </Txt>
        </View>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GAP }}>
        {ids.map((id) => {
          const card = cards.find((x) => x.id === id);
          return card ? (
            <CardMarker
              key={id}
              {...markerProps(card, marks.get(id))}
              width={width}
              onPress={() => router.push({ pathname: '/card/[id]', params: { id } })}
            />
          ) : null;
        })}
      </View>
    </View>
  );
}

export default function MatchScreen() {
  const c = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const res = useMatches();
  const m = res?.matches.find((x) => x.user_id === id);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={{
        paddingTop: insets.top + 8,
        paddingBottom: insets.bottom + 32,
        paddingHorizontal: screenPadding,
        gap: 18,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <RoundButton icon="chevronLeft" label={t('cardSheet.back')} onPress={() => router.back()} />
      </View>
      {!m ? (
        res?.status === 'loading' ? null : (
          <StateView illustration="ups" title={t('matches.gone')} />
        )
      ) : (
        <>
          <View accessible style={{ alignItems: 'center', gap: 8, paddingTop: 4 }}>
            <Avatar username={m.username} size={72} />
            <Txt variant="title" size={28} style={{ textAlign: 'center' }}>
              @{m.username}
            </Txt>
            <Txt size={13} muted>
              {placeName(m)}
            </Txt>
            <MatchTags m={m} />
          </View>
          <Cards title={t('matches.detailTheyGive', { username: m.username })} ids={m.they_give} />
          <Cards title={t('matches.detailYouGive')} ids={m.you_give} />
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              padding: 14,
              borderRadius: radius.card,
              borderWidth: 1.5,
              borderStyle: 'dashed',
              borderColor: c.line,
            }}
          >
            <Icon name="sparkle" size={20} color={c.accentText} />
            <Txt size={13} muted style={{ flex: 1 }}>
              {t('matches.chatSoon')}
            </Txt>
          </View>
        </>
      )}
    </ScrollView>
  );
}
