// Card detail ("Ficha de carta"): mark Tengo / Busco / Repetida, see the catalog data.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { UserMark } from '@/data/catalog';
import { getDb } from '@/data/db';
import { removePhoto, type Photo, type PhotoKind } from '@/data/photos';
import { setMark } from '@/data/userCards';
import { Card3D } from '@/features/card/Card3D';
import { CardBack } from '@/features/card/CardBack';
import { OfferSection } from '@/features/card/OfferSection';
import { owned } from '@/features/binder/pages';
import { markerProps } from '@/features/catalog/cardView';
import { useCatalogData } from '@/features/catalog/useCatalog';
import { useLinkedUser } from '@/features/auth/useLinked';
import { openScan } from '@/features/scan/scan';
import { t } from '@/i18n';
import { haptics } from '@/lib/haptics';
import { cardRadius, cardRatio, fonts, radius, screenPadding } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { CardMarker } from '@/ui/CardMarker';
import { Button } from '@/ui/Button';
import { Icon } from '@/ui/icons/Icon';
import { RoundButton } from '@/ui/RoundButton';
import { ScanFrame } from '@/ui/ScanFrame';
import { StateView } from '@/ui/StateView';
import { Txt } from '@/ui/Txt';

// Larger than the canvas (150) so the 3D turn reads well.
const CARD_W = 180;
const STATUSES: UserMark['status'][] = ['have', 'want', 'dupe'];

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

const CONDITION_W = 96;

/** A condition photo slot (front / back): add, retake or remove. */
function ConditionSlot({
  label,
  optional,
  photo,
  onAdd,
  onRemove,
}: {
  label: string;
  optional?: boolean;
  photo?: Photo;
  onAdd: () => void;
  onRemove: () => void;
}) {
  const c = useTheme();
  const onPress = () =>
    photo
      ? Alert.alert(label, undefined, [
          { text: t('photo.redo'), onPress: onAdd },
          { text: t('photo.remove'), style: 'destructive', onPress: onRemove },
          { text: t('photo.cancel'), style: 'cancel' },
        ])
      : onAdd();
  return (
    <View style={{ alignItems: 'center', gap: 6 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={photo ? label : t('photo.add', { side: label.toLowerCase() })}
        onPress={onPress}
      >
        {photo?.uri ? (
          <ScanFrame source={{ uri: photo.uri }} member={label} width={CONDITION_W} />
        ) : (
          <View
            style={{
              width: CONDITION_W,
              aspectRatio: cardRatio,
              borderRadius: cardRadius(CONDITION_W),
              borderWidth: 1.5,
              borderStyle: 'dashed',
              borderColor: c.muted,
              backgroundColor: c.surface2,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="plus" size={24} />
          </View>
        )}
      </Pressable>
      <Txt variant="label" importantForAccessibility="no">
        {label}
      </Txt>
      {optional ? (
        <Txt size={12} muted importantForAccessibility="no">
          {t('photo.optional')}
        </Txt>
      ) : null}
    </View>
  );
}

export default function CardScreen() {
  const c = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { cards, marks, photos } = useCatalogData();
  const card = cards.find((x) => x.id === id);
  const mark = card ? marks.get(card.id) : undefined;
  const cardPhotos = card ? photos.get(card.id) : undefined;
  const scan = cardPhotos?.scan;
  const linked = !!useLinkedUser();

  const shoot = (source: 'camera' | 'gallery', kind: PhotoKind) =>
    openScan(router, source, { cardId: card!.id, kind });
  // Android alerts fit three buttons: camera, gallery, cancel.
  const chooseSource = (kind: PhotoKind) =>
    Alert.alert(t('photo.from'), undefined, [
      { text: t('photo.scan'), onPress: () => shoot('camera', kind) },
      { text: t('photo.gallery'), onPress: () => shoot('gallery', kind) },
      { text: t('photo.cancel'), style: 'cancel' },
    ]);
  const confirmRemove = () =>
    Alert.alert(t('photo.removeTitle'), t('photo.removeBody'), [
      { text: t('photo.cancel'), style: 'cancel' },
      {
        text: t('photo.remove'),
        style: 'destructive',
        onPress: () => removePhoto(getDb(), card!.id, 'scan'),
      },
    ]);

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
      {card && owned(mark) ? (
        // Full screen is for your own collection only.
        <RoundButton
          icon="expand"
          label={t('viewer.open')}
          onPress={() => router.push({ pathname: '/card-viewer', params: { id: card.id } })}
        />
      ) : Platform.OS === 'ios' ? (
        <View style={{ width: 44 }} />
      ) : null}
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
              front={(rotate) =>
                scan?.uri ? (
                  <ScanFrame
                    source={{ uri: scan.uri }}
                    member={card.memberName}
                    state={markerProps(card, mark).state}
                    holo={card.isSpecial}
                    width={CARD_W}
                  />
                ) : (
                  <CardMarker
                    {...markerProps(card, mark)}
                    holo={card.isSpecial}
                    holoRotate={rotate}
                    width={CARD_W}
                  />
                )
              }
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

          <View style={{ gap: 10 }}>
            <Txt variant="title" accessibilityRole="header">
              {t('photo.title')}
            </Txt>
            {scan ? (
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Button
                  label={t('photo.change')}
                  icon="camera"
                  variant="ghost"
                  style={{ flex: 1 }}
                  onPress={() => chooseSource('scan')}
                />
                <Button
                  label={t('photo.remove')}
                  variant="danger"
                  style={{ flex: 1 }}
                  onPress={confirmRemove}
                />
              </View>
            ) : (
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Button
                  label={t('photo.scan')}
                  icon="scan"
                  variant="accent"
                  style={{ flex: 1 }}
                  onPress={() => shoot('camera', 'scan')}
                />
                <Button
                  label={t('photo.gallery')}
                  icon="image"
                  variant="ghost"
                  style={{ flex: 1 }}
                  onPress={() => shoot('gallery', 'scan')}
                />
              </View>
            )}
            {scan?.state === 'quota' ? (
              <Txt size={13} muted>
                {t('photo.quota')}
              </Txt>
            ) : scan && !linked ? (
              <Txt size={13} muted>
                {t('photo.noAccount')}
              </Txt>
            ) : null}
          </View>

          {mark?.status === 'dupe' ? (
            <View style={{ gap: 10 }}>
              <Txt variant="title" accessibilityRole="header">
                {t('photo.conditionTitle')}
              </Txt>
              <Txt size={13} muted>
                {t('photo.conditionBody')}
              </Txt>
              <View style={{ flexDirection: 'row', gap: 18 }}>
                <ConditionSlot
                  label={t('photo.front')}
                  photo={cardPhotos?.condition_front}
                  // Condition photos are what other collectors see: camera only, so they show
                  // the real card in hand (no gallery images).
                  onAdd={() => shoot('camera', 'condition_front')}
                  onRemove={() => removePhoto(getDb(), card.id, 'condition_front')}
                />
                <ConditionSlot
                  label={t('photo.back')}
                  optional
                  photo={cardPhotos?.condition_back}
                  onAdd={() => shoot('camera', 'condition_back')}
                  onRemove={() => removePhoto(getDb(), card.id, 'condition_back')}
                />
              </View>
            </View>
          ) : null}

          {mark?.status === 'dupe' ? (
            <OfferSection
              mark={mark}
              hasConditionPhoto={!!cardPhotos?.condition_front}
              onChange={update}
            />
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
