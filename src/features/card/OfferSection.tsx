// "Ofrecer para" on a spare card (08-spec-catalog): trade / sale / both, optional price.
// The price lives only here, on the card sheet: never in lists, sorting, filters or matching.
import { useState } from 'react';
import { TextInput, View } from 'react-native';

import type { Offer, UserMark } from '@/data/catalog';
import { locale, t } from '@/i18n';
import { fonts, radius } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { Chip } from '@/ui/Chip';
import { Txt } from '@/ui/Txt';

const OFFERS: Offer[] = ['trade', 'sale', 'both'];
// shortcut: EUR only (profile currency is EUR until LatAm launches, M10b).
const CURRENCY = 'EUR';

/** "5,5" / "5.50" → 550 cents; empty → null; junk → undefined (keep the old value). */
export function parsePrice(text: string): number | null | undefined {
  const s = text.trim().replace(',', '.');
  if (!s) return null;
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(s)) return undefined;
  return Math.round(Number(s) * 100);
}

const formatPrice = (cents: number) =>
  new Intl.NumberFormat(locale === 'es' ? 'es-ES' : 'en', {
    style: 'currency',
    currency: CURRENCY,
  }).format(cents / 100);

export function OfferSection({
  mark,
  hasConditionPhoto,
  onChange,
}: {
  mark: UserMark;
  hasConditionPhoto: boolean;
  onChange: (next: UserMark) => void;
}) {
  const c = useTheme();
  const [draft, setDraft] = useState<string | null>(null);
  const offer = mark.offer ?? null;
  const sells = offer === 'sale' || offer === 'both';
  const price =
    mark.priceCents != null
      ? (mark.priceCents / 100).toString().replace('.', locale === 'es' ? ',' : '.')
      : '';

  return (
    <View style={{ gap: 10 }}>
      <Txt variant="title" accessibilityRole="header">
        {t('offer.title')}
      </Txt>
      {hasConditionPhoto ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {OFFERS.map((o) => (
            <Chip
              key={o}
              label={t(`offer.${o}`)}
              selected={offer === o}
              // Tapping the selected mode again withdraws the offer.
              onPress={() => onChange({ ...mark, offer: offer === o ? null : o })}
            />
          ))}
        </View>
      ) : (
        <Txt size={13} muted>
          {t('offer.needsPhoto')}
        </Txt>
      )}
      {sells ? (
        <View style={{ gap: 6 }}>
          <Txt variant="label">{t('offer.price', { currency: CURRENCY })}</Txt>
          <TextInput
            value={draft ?? price}
            onChangeText={setDraft}
            onEndEditing={() => {
              const cents = draft == null ? undefined : parsePrice(draft);
              if (cents !== undefined) onChange({ ...mark, priceCents: cents });
              setDraft(null);
            }}
            keyboardType="decimal-pad"
            placeholder={t('offer.pricePlaceholder')}
            placeholderTextColor={c.muted}
            accessibilityLabel={t('offer.price', { currency: CURRENCY })}
            accessibilityHint={t('offer.priceHint')}
            style={{
              minHeight: 50,
              borderRadius: radius.control,
              borderWidth: 1.5,
              borderColor: c.line,
              backgroundColor: c.surface,
              paddingHorizontal: 14,
              fontFamily: fonts.text400,
              fontSize: 15,
              color: c.ink,
            }}
          />
          <Txt size={13} muted>
            {mark.priceCents != null
              ? t('offer.priceShown', { price: formatPrice(mark.priceCents) })
              : t('offer.priceHint')}
          </Txt>
        </View>
      ) : null}
    </View>
  );
}
