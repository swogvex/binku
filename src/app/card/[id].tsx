// Card detail ("Ficha de carta"): mark Tengo / Busco / Repetida, see the catalog data.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { UserMark } from '@/data/catalog';
import { getDb } from '@/data/db';
import { setMark } from '@/data/userCards';
import { Card3D } from '@/features/card/Card3D';
import { CardBack } from '@/features/card/CardBack';
import { markerProps } from '@/features/catalog/cardView';
import { useCatalogData } from '@/features/catalog/useCatalog';
import { t } from '@/i18n';
import { haptics } from '@/lib/haptics';
import { fonts, radius, screenPadding } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { CardMarker } from '@/ui/CardMarker';
import { Icon, type IconName } from '@/ui/icons/Icon';
import { StateView } from '@/ui/StateView';
import { Txt } from '@/ui/Txt';

// Larger than the canvas (150) so the 3D turn reads well.
const CARD_W = 180;
const STATUSES: UserMark['status'][] = ['have', 'want', 'dupe'];

function RoundButton(props: { icon: IconName; label: string; onPress: () => void }) {
  const c = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.label}
      onPress={props.onPress}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: c.surface,
        borderWidth: 1,
        borderColor: c.line,
        opacity: pressed ? 0.7 : 1,
      })}
      hitSlop={4}
    >
      <Icon name={props.icon} size={20} />
    </Pressable>
  );
}

function Row({ label, value, hangul }: { label: string; value: string; hangul?: boolean }) {
  const c = useTheme();
  return (
    <View
      accessible
      style={{
        flexDirection: 'row',
        gap: 8,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: c.line,
      }}
    >
      <Txt muted size={13} style={{ width: 96 }}>
        {label}
      </Txt>
      <Txt variant="label" size={15} style={[{ flex: 1 }, hangul && { fontFamily: fonts.hangul }]}>
        {value}
      </Txt>
    </View>
  );
}

export default function CardScreen() {
  const c = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { cards, marks } = useCatalogData();
  const card = cards.find((x) => x.id === id);
  const mark = card ? marks.get(card.id) : undefined;

  const header = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <RoundButton icon="chevronLeft" label={t('cardSheet.back')} onPress={() => router.back()} />
      {/* iOS centres the title; Android top app bars align it left */}
      <Txt
        variant="title"
        size={17}
        accessibilityRole="header"
        style={{ flex: 1, textAlign: Platform.OS === 'ios' ? 'center' : 'left' }}
      >
        {t('cardSheet.title')}
      </Txt>
      {Platform.OS === 'ios' ? <View style={{ width: 44 }} /> : null}
    </View>
  );

  const update = (next: UserMark | null) => {
    haptics.selection();
    setMark(getDb(), card!.id, next);
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={{
        paddingTop: insets.top + 8,
        paddingBottom: insets.bottom + 32,
        paddingHorizontal: screenPadding,
        gap: 16,
      }}
    >
      {header}
      {!card ? (
        <StateView illustration="ups" title={t('cardSheet.notFound')} />
      ) : (
        <>
          <View style={{ alignItems: 'center', paddingVertical: 6 }}>
            <Card3D
              width={CARD_W}
              label={`${card.memberName}, ${card.releaseTitle}, ${markerProps(card).version}`}
              front={(rotate) => (
                <CardMarker
                  {...markerProps(card, mark)}
                  holo={card.isSpecial}
                  holoRotate={rotate}
                  width={CARD_W}
                />
              )}
              back={
                <CardBack
                  width={CARD_W}
                  color={card.groupColor}
                  monogram={card.groupMonogram}
                  groupName={card.groupName}
                />
              }
            />
          </View>

          <View
            accessibilityRole="radiogroup"
            accessibilityLabel={t('cardSheet.markA11y')}
            style={{
              flexDirection: 'row',
              gap: 4,
              padding: 4,
              borderRadius: radius.control,
              backgroundColor: c.surface2,
            }}
          >
            {STATUSES.map((status) => {
              const selected = mark?.status === status;
              return (
                <Pressable
                  key={status}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  // Tapping the selected option again clears the mark.
                  onPress={() => update(selected ? null : { status, qty: mark?.qty ?? 1 })}
                  style={{
                    flex: 1,
                    minHeight: 44,
                    borderRadius: 10,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: selected ? c.ink : 'transparent',
                  }}
                >
                  <Txt variant="title" size={15} color={selected ? c.onInk : c.ink}>
                    {status === 'dupe' ? t('cardSheet.dupe') : t(`card.${status}`)}
                  </Txt>
                </Pressable>
              );
            })}
          </View>

          {mark?.status === 'dupe' ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                padding: 12,
                borderRadius: radius.control,
                backgroundColor: c.surface,
                borderWidth: 1,
                borderColor: c.line,
              }}
            >
              <Txt variant="title" size={15} style={{ flex: 1 }}>
                {t('cardSheet.dupeQty')}
              </Txt>
              <RoundButton
                icon="minus"
                label={t('cardSheet.less')}
                onPress={() => mark.qty > 1 && update({ ...mark, qty: mark.qty - 1 })}
              />
              <Txt
                variant="title"
                size={17}
                accessibilityLiveRegion="polite"
                style={{ minWidth: 24, textAlign: 'center' }}
              >
                {mark.qty}
              </Txt>
              <RoundButton
                icon="plus"
                label={t('cardSheet.more')}
                onPress={() => update({ ...mark, qty: mark.qty + 1 })}
              />
            </View>
          ) : null}

          <View>
            <Row label={t('cardSheet.group')} value={card.groupName} />
            <Row label={t('cardSheet.album')} value={`${card.releaseTitle} · ${card.year}`} />
            {card.versionLabel ? (
              <Row label={t('cardSheet.version')} value={card.versionLabel} />
            ) : null}
            <Row label={t('cardSheet.type')} value={t(`catalog.type.${card.type}`)} />
            {card.store ? <Row label={t('cardSheet.store')} value={card.store} /> : null}
            {card.memberNameKo ? (
              <Row label={t('cardSheet.korean')} value={card.memberNameKo} hangul />
            ) : null}
          </View>
        </>
      )}
    </ScrollView>
  );
}
