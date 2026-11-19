// "Añadir al chat" sheet: propose the match's trade (when there is one) or attach a card. Your
// own cards come first; searching looks through the whole catalog.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';

import { owned } from '@/features/binder/pages';
import { markerProps } from '@/features/catalog/cardView';
import { fold } from '@/features/catalog/filter';
import { useCatalogData } from '@/features/catalog/useCatalog';
import { setPicked } from '@/features/chat/attach';
import { SwapPair } from '@/features/chat/ChatParts';
import { findMatch } from '@/features/matches/useMatches';
import { t } from '@/i18n';
import { radius, screenPadding } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { CardMarker } from '@/ui/CardMarker';
import { Icon } from '@/ui/icons/Icon';
import { SearchField } from '@/ui/SearchField';
import { Txt } from '@/ui/Txt';

export default function ChatAttach() {
  const c = useTheme();
  const router = useRouter();
  const { other } = useLocalSearchParams<{ other: string }>();
  const { cards, marks } = useCatalogData();
  const [query, setQuery] = useState('');
  const match = findMatch(other);
  const q = fold(query.trim());
  const results = q
    ? cards.filter((x) =>
        fold(`${x.memberName} ${x.groupName} ${x.releaseTitle} ${x.versionLabel ?? ''}`).includes(
          q,
        ),
      )
    : cards.filter((x) => owned(marks.get(x.id)));

  const header = (
    <View style={{ gap: 14, paddingBottom: 8 }}>
      <Txt variant="display" size={28} accessibilityRole="header">
        {t('chat.attachTitle')}
      </Txt>
      {match ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${t('chat.proposeMatch')}. ${t('chat.proposeMatchBody')}`}
          onPress={() => {
            setPicked({ offer: { type: 'offer', give: match.you_give, get: match.they_give } });
            router.back();
          }}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 14,
            padding: 14,
            borderRadius: radius.card,
            borderWidth: 1.5,
            borderColor: c.ink,
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <SwapPair give={match.you_give} get={match.they_give} cards={cards} width={34} />
          <View style={{ flex: 1, gap: 2 }}>
            <Txt variant="title" size={17}>
              {t('chat.proposeMatch')}
            </Txt>
            <Txt size={13} muted>
              {t('chat.proposeMatchBody')}
            </Txt>
          </View>
          <Icon name="chevronRight" size={18} color={c.muted} />
        </Pressable>
      ) : null}
      <Txt variant="label" size={13} muted>
        {t('chat.attachCard')}
      </Txt>
      <SearchField
        value={query}
        onChangeText={setQuery}
        placeholder={t('scan.pick.search')}
        accessibilityLabel={t('scan.pick.search')}
      />
    </View>
  );

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: c.surface }}
      contentContainerStyle={{ padding: screenPadding, paddingTop: 28, paddingBottom: 32 }}
      data={results}
      keyExtractor={(x) => x.id}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={header}
      ListEmptyComponent={
        <Txt muted style={{ paddingVertical: 24, textAlign: 'center' }}>
          {t('scan.pick.empty')}
        </Txt>
      }
      renderItem={({ item }) => {
        const p = markerProps(item, marks.get(item.id));
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${item.memberName}, ${item.releaseTitle}, ${p.version}`}
            onPress={() => {
              setPicked({ card: item.id });
              router.back();
            }}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              paddingVertical: 10,
              borderBottomWidth: 1,
              borderBottomColor: c.line,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <CardMarker {...p} width={44} decorative />
            <View style={{ flex: 1, gap: 2 }}>
              <Txt variant="title" size={15} numberOfLines={1}>
                {item.memberName}
              </Txt>
              <Txt size={13} muted numberOfLines={1}>
                {`${item.releaseTitle} · ${p.version}`}
              </Txt>
            </View>
            <Icon name="plus" size={18} color={c.muted} />
          </Pressable>
        );
      }}
    />
  );
}
