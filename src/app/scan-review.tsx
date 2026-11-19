// Review after scanning (canvas flujo-escaneo step 4): crop preview, rotate, retake, which card
// it is (suggested from the open binder), save → pocket filled with "¡Nueva!".
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { CatalogCard } from '@/data/catalog';
import { getDb } from '@/data/db';
import { savePhoto, type PhotoKind } from '@/data/photos';
import { owned } from '@/features/binder/pages';
import { useBinder } from '@/features/binder/useBinder';
import { markerProps } from '@/features/catalog/cardView';
import { capture, setPickedCard, usePickedCard, type Source } from '@/features/scan/scan';
import { t } from '@/i18n';
import { haptics } from '@/lib/haptics';
import { cardRadius, cardRatio, radius, screenPadding } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { Button } from '@/ui/Button';
import { CardMarker } from '@/ui/CardMarker';
import { Icon, type IconName } from '@/ui/icons/Icon';
import { RoundButton } from '@/ui/RoundButton';
import { Tag } from '@/ui/Tag';
import { Txt } from '@/ui/Txt';

const PREVIEW_W = 200;

/** The photo as it will be saved: centre-cropped to 55:85 and rotated. */
function Preview({ uri, rotation }: { uri: string; rotation: number }) {
  const c = useTheme();
  const h = Math.round(PREVIEW_W / cardRatio);
  const sideways = rotation % 180 !== 0;
  // A sideways image is laid out with swapped sides, then turned to fill the card frame.
  const w = sideways ? h : PREVIEW_W;
  const ih = sideways ? PREVIEW_W : h;
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={t('scan.review.preview')}
      style={{
        width: PREVIEW_W,
        height: h,
        borderRadius: cardRadius(PREVIEW_W),
        borderWidth: 3,
        borderColor: c.ink,
        overflow: 'hidden',
        backgroundColor: c.surface2,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Image
        source={{ uri }}
        contentFit="cover"
        style={{ width: w, height: ih, transform: [{ rotate: `${rotation}deg` }] }}
      />
    </View>
  );
}

function Action({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const c = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        minHeight: 44,
        paddingHorizontal: 16,
        borderRadius: radius.chip,
        backgroundColor: c.surface,
        borderWidth: 1,
        borderColor: c.line,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Icon name={icon} size={18} />
      <Txt variant="label">{label}</Txt>
    </Pressable>
  );
}

/** First card of the open binder still missing, else the first without a photo. */
function suggest(items: CatalogCard[], ctx: ReturnType<typeof useBinder>) {
  return (
    items.find((x) => !owned(ctx.marks.get(x.id)) && !ctx.photos.get(x.id)?.scan) ??
    items.find((x) => !ctx.photos.get(x.id)?.scan)
  );
}

export default function ScanReview() {
  const c = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    uri: string;
    source: Source;
    cardId?: string;
    kind?: PhotoKind;
  }>();
  const kind = params.kind || 'scan';
  const ctx = useBinder();
  const picked = usePickedCard();
  const [uri, setUri] = useState(params.uri);
  const [rotation, setRotation] = useState(0);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  // A fresh review never inherits the card picked in a previous one.
  useEffect(() => () => setPickedCard(null), []);

  const fixedId = params.cardId || null;
  const suggested = fixedId ? undefined : suggest(ctx.items, ctx);
  const cardId = fixedId ?? picked ?? suggested?.id ?? null;
  const card = cardId ? ctx.cards.find((x) => x.id === cardId) : undefined;
  const isSuggestion = !fixedId && !picked && !!suggested;

  const retake = async () => {
    const r = await capture(params.source);
    if (r && 'uri' in r) {
      setUri(r.uri);
      setRotation(0);
    }
  };

  const save = async () => {
    if (!card || saving) return;
    setSaving(true);
    setFailed(false);
    try {
      await savePhoto(getDb(), {
        source: uri,
        rotation,
        cardId: card.id,
        kind,
        mark: ctx.marks.get(card.id),
      });
      haptics.cardPlaced();
      if (fixedId) router.back();
      else if (ctx.items.some((x) => x.id === card.id)) {
        router.back();
        router.navigate({ pathname: '/binder', params: { new: card.id } });
      } else router.replace({ pathname: '/card/[id]', params: { id: card.id } });
    } catch {
      setFailed(true);
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingHorizontal: screenPadding,
          paddingBottom: 24,
          gap: 18,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <RoundButton icon="close" label={t('scan.review.close')} onPress={() => router.back()} />
          <Txt
            variant="title"
            size={17}
            style={{ flex: 1, textAlign: Platform.OS === 'ios' ? 'center' : 'left' }}
          >
            {t('dock.scan')}
          </Txt>
          {Platform.OS === 'ios' ? <View style={{ width: 44 }} /> : null}
        </View>

        <View style={{ gap: 6 }}>
          <Txt variant="label" muted>
            {params.source === 'camera'
              ? t('scan.review.kickerCamera')
              : t('scan.review.kickerGallery')}
          </Txt>
          <Txt variant="display" size={34} accessibilityRole="header">
            {kind === 'scan' ? t('scan.review.title') : t('scan.review.titleCondition')}
          </Txt>
          {params.source === 'gallery' ? (
            // Gallery images skip the scanner: remind what may be uploaded (moderated by reports).
            <Txt size={13} muted>
              {t('scan.review.galleryRule')}
            </Txt>
          ) : null}
        </View>

        <View style={{ alignItems: 'center', paddingVertical: 8 }}>
          <Preview uri={uri} rotation={rotation} />
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10 }}>
          <Action
            icon="rotate"
            label={t('scan.review.rotate')}
            onPress={() => setRotation((r) => (r + 90) % 360)}
          />
          <Action
            icon={params.source === 'camera' ? 'camera' : 'image'}
            label={t('scan.review.retake')}
            onPress={retake}
          />
        </View>

        {kind === 'scan' ? (
          <View style={{ gap: 10 }}>
            <Txt variant="title" accessibilityRole="header">
              {t('scan.review.which')}
            </Txt>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                padding: 12,
                borderRadius: radius.card,
                backgroundColor: c.surface,
                borderWidth: 1,
                borderColor: c.line,
              }}
            >
              {card ? (
                <>
                  <CardMarker {...markerProps(card)} width={56} decorative />
                  <View style={{ flex: 1, gap: 4 }}>
                    <Txt variant="title" size={15} numberOfLines={2}>
                      {card.memberName}
                    </Txt>
                    <Txt size={13} muted numberOfLines={2}>
                      {`${card.releaseTitle} · ${markerProps(card).version}`}
                    </Txt>
                    {isSuggestion ? <Tag label={t('scan.review.suggested')} /> : null}
                  </View>
                </>
              ) : (
                <Txt muted style={{ flex: 1 }}>
                  {t('scan.review.none')}
                </Txt>
              )}
              {fixedId ? null : (
                <Button
                  compact
                  variant="ghost"
                  label={card ? t('scan.review.change') : t('scan.review.choose')}
                  onPress={() => router.push('/scan-pick')}
                />
              )}
            </View>
          </View>
        ) : null}

        {failed ? (
          <Txt accessibilityLiveRegion="polite" color={c.accentText}>
            {t('scan.review.error')}
          </Txt>
        ) : null}
      </ScrollView>

      <View
        style={{
          paddingHorizontal: screenPadding,
          paddingTop: 12,
          paddingBottom: insets.bottom + 12,
          borderTopWidth: 1,
          borderTopColor: c.line,
          backgroundColor: c.bg,
        }}
      >
        <Button
          variant="accent"
          icon="check"
          disabled={!card || saving}
          label={
            saving
              ? t('scan.review.saving')
              : fixedId
                ? t('scan.review.saveCard')
                : t('scan.review.save')
          }
          onPress={save}
        />
      </View>
    </View>
  );
}
