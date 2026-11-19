import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { CatalogCard } from '@/data/catalog';
import type { CardType } from '@/data/catalogFile';
import { owned } from '@/features/binder/pages';
import { markerProps } from '@/features/catalog/cardView';
import { crumbs, keepThrough, nextLevel } from '@/features/catalog/filter';
import { setFilter, useFilteredCards } from '@/features/catalog/useCatalog';
import { t } from '@/i18n';
import { era, screenPadding } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { CardMarker } from '@/ui/CardMarker';
import { Chip } from '@/ui/Chip';
import { useDockScrollHandler, useDockSpace } from '@/ui/dockVisibility';
import { SearchField } from '@/ui/SearchField';
import { Icon } from '@/ui/icons/Icon';
import { StateView } from '@/ui/StateView';
import { StatusBarScrim } from '@/ui/StatusBarScrim';
import { Txt } from '@/ui/Txt';

const AnimatedFlashList = Animated.createAnimatedComponent(FlashList<CatalogCard>);

const TYPES: (CardType | null)[] = [
  null,
  'album',
  'pob',
  'lucky_draw',
  'event',
  'season_greetings',
];
const GAP = 10;

function ChipRow({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      // bleed to the screen edges so chips scroll under the padding
      style={{ marginHorizontal: -screenPadding }}
      contentContainerStyle={{ paddingHorizontal: screenPadding, gap: 8, paddingVertical: 6 }}
    >
      {children}
    </ScrollView>
  );
}

function Header() {
  const c = useTheme();
  const router = useRouter();
  const { cards, filter, results, marks } = useFilteredCards();
  const next = nextLevel(cards, filter);
  const have = results.filter((x) => owned(marks.get(x.id))).length;
  // A group chip carries the group's colour, so the row reads like the shelf of a shop.
  const groupColor = (id: string) => {
    const card = next?.level === 'group' ? cards.find((x) => x.groupId === id) : undefined;
    return card ? era[card.groupColor] : undefined;
  };
  const typeCount = (type: CardType | null) =>
    type ? cards.filter((x) => x.type === type).length : cards.length;
  const trail = crumbs(cards, filter.path);
  const activeFilters = Number(!!filter.state);

  return (
    <View style={{ gap: 14, paddingBottom: 14 }}>
      <View style={{ gap: 2 }}>
        <Txt variant="display" size={40} accessibilityRole="header">
          {t('dock.catalog')}
        </Txt>
        <Txt size={13} muted accessibilityLiveRegion="polite">
          {t('catalog.summary', { count: results.length, have })}
        </Txt>
      </View>

      <SearchField
        value={filter.query}
        onChangeText={(query) => setFilter({ query })}
        placeholder={t('catalog.search')}
        accessibilityLabel={t('catalog.searchA11y')}
      />

      <View style={{ gap: 4 }}>
        <ChipRow>
          {next?.options.map((o) => (
            <Chip
              key={o.id}
              label={o.name}
              dot={groupColor(o.id)}
              onPress={() => setFilter({ path: { ...filter.path, [next.level]: o.id } })}
            />
          ))}
          <Chip
            label={
              activeFilters
                ? t('catalog.filtersActive', { count: activeFilters })
                : t('catalog.filters')
            }
            selected={activeFilters > 0}
            onPress={() => router.push('/catalog-filters')}
          />
        </ChipRow>

        {trail.length > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 2 }}>
            {[{ level: 'group' as const, name: t('catalog.root') }, ...trail].map((cr, i) => {
              const last = i === trail.length;
              return (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center' }}>
                  {i > 0 ? <Icon name="chevronRight" size={14} color={c.muted} /> : null}
                  <Pressable
                    disabled={last}
                    accessibilityRole="button"
                    accessibilityLabel={t('catalog.crumbA11y', { name: cr.name })}
                    hitSlop={10}
                    onPress={() =>
                      setFilter({ path: i === 0 ? {} : keepThrough(filter.path, cr.level) })
                    }
                    style={{ paddingVertical: 4, paddingHorizontal: 2 }}
                  >
                    <Txt variant={last ? 'title' : 'label'} size={13} muted={!last}>
                      {cr.name}
                    </Txt>
                  </Pressable>
                </View>
              );
            })}
          </View>
        ) : null}
      </View>

      <ChipRow>
        {TYPES.map((type) => (
          <Chip
            key={type ?? 'all'}
            label={`${t(`catalog.type.${type ?? 'all'}`)} · ${typeCount(type)}`}
            selected={filter.type === type}
            onPress={() => setFilter({ type })}
          />
        ))}
      </ChipRow>
    </View>
  );
}

export default function Catalog() {
  const c = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const onScroll = useDockScrollHandler();
  const bottom = useDockSpace();
  const { results, marks } = useFilteredCards();
  const cardW = Math.floor((width - screenPadding * 2 - GAP * 2) / 3);

  return (
    <>
      <AnimatedFlashList
        data={results}
        numColumns={3}
        keyExtractor={(card) => card.id}
        extraData={marks}
        // On by default in FlashList v2: it would jump to the previously visible cards when a
        // filter is removed. The catalog should stay where the user is (usually the top).
        maintainVisibleContentPosition={{ disabled: true }}
        onScroll={onScroll}
        scrollEventThrottle={16}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1, backgroundColor: c.bg }}
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingBottom: bottom,
          paddingHorizontal: screenPadding - GAP / 2,
        }}
        ListHeaderComponent={
          <View style={{ paddingHorizontal: GAP / 2 }}>
            <Header />
          </View>
        }
        ListEmptyComponent={
          <StateView
            illustration="pocket"
            title={t('states.noResults.title')}
            body={t('states.noResults.body')}
          />
        }
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: GAP / 2, paddingBottom: GAP, alignItems: 'center' }}>
            <CardMarker
              {...markerProps(item, marks.get(item.id))}
              width={cardW}
              onPress={() => router.push({ pathname: '/card/[id]', params: { id: item.id } })}
            />
          </View>
        )}
      />
      <StatusBarScrim />
    </>
  );
}
