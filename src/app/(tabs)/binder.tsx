import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';

import { saveOrder } from '@/data/binders';
import type { CatalogCard } from '@/data/catalog';
import { getDb } from '@/data/db';
import { DragPocket } from '@/features/binder/DragPocket';
import { owned, swap, toPages } from '@/features/binder/pages';
import { dismissHint, selectBinder, useBinder } from '@/features/binder/useBinder';
import { markerProps } from '@/features/catalog/cardView';
import { t } from '@/i18n';
import { haptics } from '@/lib/haptics';
import { era, radius, screenPadding } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { CardMarker } from '@/ui/CardMarker';
import { Chip } from '@/ui/Chip';
import { Pocket } from '@/ui/Pocket';
import { ScanFrame } from '@/ui/ScanFrame';
import { StateView } from '@/ui/StateView';
import { Tag } from '@/ui/Tag';
import { TabScreen } from '@/ui/TabScreen';
import { Txt } from '@/ui/Txt';

const GAP = 10;
const PAGE_PAD = 12;

function MoreIcon({ color }: { color: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 4 }}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: color }} />
      ))}
    </View>
  );
}

function Dots({ count, current }: { count: number; current: number }) {
  const c = useTheme();
  if (count < 2) return null;
  // Too many dots stop being readable: big binders show "3 / 20" instead.
  if (count > 10)
    return (
      <Txt variant="label" muted style={{ textAlign: 'center' }}>
        {`${current + 1} / ${count}`}
      </Txt>
    );
  return (
    <View
      accessible
      accessibilityLabel={t('binder.page', { page: current + 1, pages: count })}
      style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 }}
    >
      {Array.from({ length: count }, (_, i) => (
        <View
          key={i}
          style={{
            width: i === current ? 18 : 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: i === current ? c.ink : c.muted,
            opacity: i === current ? 1 : 0.5,
          }}
        />
      ))}
    </View>
  );
}

export default function BinderScreen() {
  const c = useTheme();
  const router = useRouter();
  const { width, fontScale } = useWindowDimensions();
  const db = getDb();
  const { marks, photos, binders, binder, items, hint } = useBinder();
  // Card just saved from the scanner: show its page and a "¡Nueva!" tag for a moment.
  const { new: newId } = useLocalSearchParams<{ new?: string }>();
  const pager = useRef<FlatList<CatalogCard[]>>(null);
  // Large text gets 2×2 pages automatically so names stay readable.
  const layout = fontScale >= 1.3 ? '2x2' : (binder?.layout ?? '3x3');
  // The page index belongs to one binder and layout: switching either starts at page 1
  // (the pager is remounted with the same key, so its scroll offset resets too).
  const pagerKey = `${binder?.id}-${layout}`;
  const [pageState, setPageState] = useState({ key: '', page: 0 });
  const page = pageState.key === pagerKey ? pageState.page : 0;
  const setPage = (p: number) => setPageState({ key: pagerKey, page: p });
  const cols = layout === '2x2' ? 2 : 3;
  const perPage = cols * cols;
  const pages = toPages(items, perPage);
  // Inner page width: screen − padding − page padding − 1 px border on each side.
  const inner = width - screenPadding * 2 - PAGE_PAD * 2 - 2;
  const pocketW = Math.floor((inner - GAP * (cols - 1)) / cols);
  const pocketH = Math.round(pocketW / (55 / 85));
  const ownedCount = items.filter((card) => owned(marks.get(card.id))).length;
  const barColor = era[items[0]?.eraColor ?? 'tomato'];
  const newIndex = newId ? items.findIndex((x) => x.id === newId) : -1;
  const near = (pageIndex: number) => Math.abs(pageIndex - page) <= 1;

  // Jump to the new card's page once (state adjusted during render, not in an effect).
  const [shownNew, setShownNew] = useState<string>();
  if (newId && newIndex >= 0 && shownNew !== newId) {
    setShownNew(newId);
    setPageState({ key: pagerKey, page: Math.floor(newIndex / perPage) });
  }

  useEffect(() => {
    if (newIndex < 0) return;
    const target = Math.floor(newIndex / perPage);
    pager.current?.scrollToOffset({ offset: target * width, animated: false });
    const timer = setTimeout(() => router.setParams({ new: undefined }), 4000);
    return () => clearTimeout(timer);
  }, [newIndex, perPage, pagerKey, width, router]);

  const onSwap = (pageIndex: number) => (from: number, to: number) => {
    const base = pageIndex * perPage;
    haptics.cardPlaced();
    saveOrder(
      db,
      binder!.id,
      swap(
        items.map((x) => x.id),
        base + from,
        base + to,
      ),
    );
  };

  const pocketLabel = (card: CatalogCard) => {
    const mark = marks.get(card.id);
    const p = markerProps(card, mark);
    return t('binder.pocketA11y', {
      member: p.member,
      album: p.album,
      version: p.version,
      state:
        mark?.status === 'dupe'
          ? t('card.dupe', { count: mark.qty })
          : owned(mark)
            ? t('card.have')
            : t('pocket.missing'),
    });
  };

  return (
    <TabScreen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flex: 1, marginLeft: -screenPadding }}
          contentContainerStyle={{ paddingLeft: screenPadding, gap: 8, paddingVertical: 6 }}
        >
          {binders.map((b) => (
            <Chip
              key={b.id}
              label={b.title}
              selected={b.id === binder?.id}
              onPress={() => selectBinder(b.id)}
            />
          ))}
          <Chip label={t('binder.new')} onPress={() => router.push('/binder-new')} />
        </ScrollView>
        {binder ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('binder.more')}
            onPress={() => router.push({ pathname: '/binder-options', params: { id: binder.id } })}
            style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
            hitSlop={4}
          >
            <MoreIcon color={c.ink} />
          </Pressable>
        ) : null}
      </View>

      {!binder ? (
        <StateView
          illustration="pocket"
          title={t('binder.empty.title')}
          body={t('binder.empty.body')}
          actions={[{ label: t('binder.empty.action'), onPress: () => router.push('/binder-new') }]}
        />
      ) : (
        <>
          <Txt variant="display" size={40} accessibilityRole="header" numberOfLines={3}>
            {binder.title}
          </Txt>

          {hint ? (
            <View
              accessibilityLiveRegion="polite"
              style={{
                padding: 14,
                gap: 8,
                borderRadius: radius.card,
                backgroundColor: c.surface2,
              }}
            >
              <Txt variant="label" size={13} muted>
                {t('onboarding.ready.time', { seconds: hint })}
              </Txt>
              <Txt>{t('onboarding.ready.body')}</Txt>
              <Pressable
                accessibilityRole="button"
                onPress={dismissHint}
                hitSlop={8}
                style={{ alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' }}
              >
                <Txt variant="title" size={15} color={c.accentText}>
                  {t('onboarding.ready.dismiss')}
                </Txt>
              </Pressable>
            </View>
          ) : null}

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View
              accessible
              accessibilityRole="progressbar"
              accessibilityLabel={t('binder.progress', { owned: ownedCount, total: items.length })}
              accessibilityValue={{ min: 0, max: items.length, now: ownedCount }}
              style={{
                flex: 1,
                height: 8,
                borderRadius: 8,
                backgroundColor: c.surface2,
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  width: `${items.length ? (ownedCount / items.length) * 100 : 0}%`,
                  height: '100%',
                  backgroundColor: barColor,
                }}
              />
            </View>
            <Txt variant="title" size={15} importantForAccessibility="no">
              {ownedCount}/{items.length}
            </Txt>
          </View>

          <FlatList
            horizontal
            pagingEnabled
            data={pages}
            keyExtractor={(_, i) => String(i)}
            showsHorizontalScrollIndicator={false}
            style={{ marginHorizontal: -screenPadding }}
            key={pagerKey}
            ref={pager}
            getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
            // The page changes as soon as the swipe passes halfway (dots and holo follow at once).
            onScroll={(e) => {
              const p = Math.round(e.nativeEvent.contentOffset.x / width);
              if (p !== page) setPage(p);
            }}
            scrollEventThrottle={32}
            initialNumToRender={1}
            windowSize={3}
            renderItem={({ item: pageCards, index: pageIndex }) => (
              <View style={{ width, paddingHorizontal: screenPadding }}>
                <View
                  style={{
                    padding: PAGE_PAD,
                    borderRadius: radius.card + 4,
                    backgroundColor: c.surface,
                    borderWidth: 1,
                    borderColor: c.line,
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    gap: GAP,
                    // Fixed height: partial last pages keep the same size (no layout jump).
                    minHeight: PAGE_PAD * 2 + cols * pocketH + (cols - 1) * GAP,
                  }}
                >
                  {pageCards.map((card, i) => {
                    const mark = marks.get(card.id);
                    const photo = photos.get(card.id)?.scan?.thumb;
                    return (
                      <DragPocket
                        key={card.id}
                        index={i}
                        count={pageCards.length}
                        cols={cols}
                        stepX={pocketW + GAP}
                        stepY={pocketH + GAP}
                        label={pocketLabel(card)}
                        onOpen={() =>
                          router.push({ pathname: '/card/[id]', params: { id: card.id } })
                        }
                        onSwap={onSwap(pageIndex)}
                      >
                        <View>
                          {photo ? (
                            <ScanFrame
                              source={{ uri: photo }}
                              member={card.memberName}
                              state={markerProps(card, mark).state}
                              holo={card.isSpecial && near(pageIndex)}
                              width={pocketW}
                            />
                          ) : owned(mark) ? (
                            <CardMarker
                              {...markerProps(card, mark)}
                              // Holo on the visible page and its neighbours, so a page swiped
                              // into view already shines (all share one sensor).
                              holo={card.isSpecial && near(pageIndex)}
                              width={pocketW}
                            />
                          ) : (
                            <Pocket
                              member={card.memberName}
                              detail={markerProps(card).version}
                              width={pocketW}
                            />
                          )}
                          {card.id === newId ? (
                            <View
                              accessibilityLiveRegion="polite"
                              style={{ position: 'absolute', top: -8, left: -6 }}
                            >
                              <Tag label={t('scan.new')} tone="strong" />
                            </View>
                          ) : null}
                        </View>
                      </DragPocket>
                    );
                  })}
                </View>
              </View>
            )}
          />
          <Dots count={pages.length} current={page} />
        </>
      )}
    </TabScreen>
  );
}
