// Match detail: who, where (subdivision only) and every card both ways. Proposing the trade
// needs chat (M6); their condition photos come with it.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { markerProps } from '@/features/catalog/cardView';
import { useCatalogData } from '@/features/catalog/useCatalog';
import { Avatar, MatchTags, placeName } from '@/features/matches/MatchParts';
import { useMatches } from '@/features/matches/useMatches';
import { t } from '@/i18n';
import { screenPadding } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { CardMarker } from '@/ui/CardMarker';
import { RoundButton } from '@/ui/RoundButton';
import { StateView } from '@/ui/StateView';
import { Txt } from '@/ui/Txt';

const CARD_W = 96;

function Cards({ title, ids }: { title: string; ids: string[] }) {
  const router = useRouter();
  const { cards, marks } = useCatalogData();
  if (!ids.length) return null;
  return (
    <View style={{ gap: 10 }}>
      <Txt variant="title" accessibilityRole="header">
        {title}
      </Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {ids.map((id) => {
          const card = cards.find((x) => x.id === id);
          return card ? (
            <CardMarker
              key={id}
              {...markerProps(card, marks.get(id))}
              width={CARD_W}
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
        <Txt
          variant="title"
          size={17}
          accessibilityRole="header"
          style={{ flex: 1, textAlign: Platform.OS === 'ios' ? 'center' : 'left' }}
        >
          {m ? t(`matches.${m.kind}`) : t('matches.title')}
        </Txt>
        {Platform.OS === 'ios' ? <View style={{ width: 44 }} /> : null}
      </View>
      {!m ? (
        res?.status === 'loading' ? null : (
          <StateView illustration="ups" title={t('matches.gone')} />
        )
      ) : (
        <>
          <View accessible style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Avatar username={m.username} size={56} />
            <View style={{ flex: 1, gap: 4 }}>
              <Txt variant="title" size={22}>
                @{m.username}
              </Txt>
              <Txt size={13} muted>
                {placeName(m)}
              </Txt>
              <MatchTags m={m} />
            </View>
          </View>
          <Cards title={t('matches.detailTheyGive', { username: m.username })} ids={m.they_give} />
          <Cards title={t('matches.detailYouGive')} ids={m.you_give} />
          <Txt size={13} muted>
            {t('matches.chatSoon')}
          </Txt>
        </>
      )}
    </ScrollView>
  );
}
