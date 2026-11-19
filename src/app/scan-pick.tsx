// "¿Qué carta es?" sheet for the scan review: the open binder's cards (all cards if there is no
// binder), searchable.
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';

import { useBinder } from '@/features/binder/useBinder';
import { markerProps } from '@/features/catalog/cardView';
import { fold } from '@/features/catalog/filter';
import { setPickedCard } from '@/features/scan/scan';
import { t } from '@/i18n';
import { screenPadding } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { CardMarker } from '@/ui/CardMarker';
import { Icon } from '@/ui/icons/Icon';
import { SearchField } from '@/ui/SearchField';
import { Txt } from '@/ui/Txt';

export default function ScanPick() {
  const c = useTheme();
  const router = useRouter();
  const { items, cards, photos } = useBinder();
  const [query, setQuery] = useState('');
  const pool = items.length ? items : cards;
  const q = fold(query.trim());
  const results = q
    ? pool.filter((x) =>
        fold(`${x.memberName} ${x.groupName} ${x.releaseTitle} ${x.versionLabel ?? ''}`).includes(
          q,
        ),
      )
    : pool;

  return (
    <View style={{ flex: 1, backgroundColor: c.surface, paddingTop: 28, gap: 12 }}>
      <View style={{ paddingHorizontal: screenPadding, gap: 12 }}>
        <Txt variant="display" size={28} accessibilityRole="header">
          {t('scan.review.which')}
        </Txt>
        <SearchField
          value={query}
          onChangeText={setQuery}
          placeholder={t('scan.pick.search')}
          accessibilityLabel={t('scan.pick.search')}
        />
      </View>
      <FlatList
        data={results}
        keyExtractor={(x) => x.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: screenPadding, paddingBottom: 32 }}
        ListEmptyComponent={
          <Txt muted style={{ paddingVertical: 24, textAlign: 'center' }}>
            {t('scan.pick.empty')}
          </Txt>
        }
        renderItem={({ item }) => {
          const p = markerProps(item);
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${item.memberName}, ${item.releaseTitle}, ${p.version}`}
              onPress={() => {
                setPickedCard(item.id);
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
              {photos.get(item.id)?.scan ? <Icon name="camera" size={18} color={c.muted} /> : null}
              <Icon name="chevronRight" size={18} color={c.muted} />
            </Pressable>
          );
        }}
      />
    </View>
  );
}
