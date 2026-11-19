// Coincidencias (08-spec-matches-home): filter chips, rows ranked by proximity and cards, never
// by price. The scope chips are the user's saved setting (Mi país by default).
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, FlatList, Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCatalogData } from '@/features/catalog/useCatalog';
import { Avatar, MatchTags, placeName, SwapRow } from '@/features/matches/MatchParts';
import { setMatchScope, useMatchScope, type Scope } from '@/features/matches/scope';
import { refreshMatches, useMatches } from '@/features/matches/useMatches';
import { t } from '@/i18n';
import { radius, screenPadding } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { Chip } from '@/ui/Chip';
import { RoundButton } from '@/ui/RoundButton';
import { StateView } from '@/ui/StateView';
import { Txt } from '@/ui/Txt';

const SCOPES: Scope[] = ['zone', 'country', 'region', 'international'];

export default function MatchesScreen() {
  const c = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { cards } = useCatalogData();
  const res = useMatches();
  const scope = useMatchScope();
  const [doublesOnly, setDoublesOnly] = useState(false);
  const rows = (res?.matches ?? []).filter((m) => !doublesOnly || m.kind === 'double');

  const pickScope = (s: Scope) => {
    const apply = () =>
      setMatchScope(s).then(refreshMatches, () => Alert.alert(t('matches.offline')));
    if (s === 'international' && scope !== 'international')
      Alert.alert(t('matches.intlTitle'), t('matches.intlBody'), [
        { text: t('photo.cancel'), style: 'cancel' },
        { text: t('matches.intlOk'), onPress: apply },
      ]);
    else apply();
  };

  const header = (
    <View style={{ gap: 14, paddingBottom: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <RoundButton icon="chevronLeft" label={t('cardSheet.back')} onPress={() => router.back()} />
        <Txt
          variant="title"
          size={17}
          accessibilityRole="header"
          style={{ flex: 1, textAlign: Platform.OS === 'ios' ? 'center' : 'left' }}
        >
          {t('matches.title')}
        </Txt>
        {Platform.OS === 'ios' ? <View style={{ width: 44 }} /> : null}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Chip
          label={t('matches.all')}
          selected={!doublesOnly}
          onPress={() => setDoublesOnly(false)}
        />
        <Chip
          label={t('matches.doubles')}
          selected={doublesOnly}
          onPress={() => setDoublesOnly(true)}
        />
      </View>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={t('matches.scope')}
        style={{ gap: 8 }}
      >
        <Txt variant="label" size={13} muted>
          {t('matches.scope')}
        </Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {SCOPES.map((s) => (
            <Chip
              key={s}
              label={t(`matches.scopes.${s}`)}
              selected={scope === s}
              onPress={() => pickScope(s)}
            />
          ))}
        </View>
      </View>
      <Txt size={13} muted>
        {t('matches.note')}
      </Txt>
      {res?.status === 'error' ? (
        <Txt size={13} color={c.accentText}>
          {t('matches.offline')}
        </Txt>
      ) : null}
    </View>
  );

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={{
        paddingTop: insets.top + 8,
        paddingBottom: insets.bottom + 24,
        paddingHorizontal: screenPadding,
        gap: 12,
      }}
      data={rows}
      keyExtractor={(m) => m.user_id}
      ListHeaderComponent={header}
      ListEmptyComponent={
        res === null ? (
          <StateView illustration="pocket" title={t('matches.needAccount')} />
        ) : res.status === 'ready' ? (
          <StateView illustration="pocket" title={t('home.none')} body={t('home.noneBody')} />
        ) : undefined
      }
      renderItem={({ item: m }) => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`@${m.username}, ${t(`matches.${m.kind}`)}, ${placeName(m)}`}
          onPress={() => router.push({ pathname: '/match/[id]', params: { id: m.user_id } })}
          style={({ pressed }) => ({
            gap: 10,
            padding: 14,
            borderRadius: radius.card,
            backgroundColor: c.surface,
            borderWidth: 1,
            borderColor: c.line,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Avatar username={m.username} />
            <View style={{ flex: 1, gap: 2 }}>
              <Txt variant="title" size={15}>
                @{m.username}
              </Txt>
              <Txt size={12} muted>
                {placeName(m)}
              </Txt>
            </View>
            <MatchTags m={m} />
          </View>
          <SwapRow m={m} cards={cards} width={56} tappable={false} />
        </Pressable>
      )}
    />
  );
}
