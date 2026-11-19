// Message bubbles: mine in ink on the right, theirs on white on the left (canvas ios-chat).
// Cards and trade proposals are drawn as cards, not as text.
import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';

import type { CatalogCard } from '@/data/catalog';
import type { Message } from '@/data/chat';
import { markerProps } from '@/features/catalog/cardView';
import { t } from '@/i18n';
import { radius } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { Button } from '@/ui/Button';
import { CardMarker } from '@/ui/CardMarker';
import { Icon, type IconName } from '@/ui/icons/Icon';
import { Txt } from '@/ui/Txt';

import { clock, dayLabel, MiniCard } from './ChatParts';

const STEP_ICON: Record<string, IconName> = {
  accept: 'check',
  tracked: 'shield',
  shipped: 'send',
  received: 'heart',
};

export function DaySeparator({ iso }: { iso: string }) {
  const c = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14 }}>
      <View style={{ flex: 1, height: 1, backgroundColor: c.line }} />
      <Txt size={12} variant="label" muted accessibilityRole="header">
        {dayLabel(iso)}
      </Txt>
      <View style={{ flex: 1, height: 1, backgroundColor: c.line }} />
    </View>
  );
}

/** One side of a proposal: label + up to 3 cards in a row. */
function Side({ label, ids, cards }: { label: string; ids: string[]; cards: CatalogCard[] }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 8 }}>
      <Txt size={12} variant="label" muted>
        {`${label} · ${ids.length}`}
      </Txt>
      <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
        {ids.slice(0, 3).map((id, i) => (
          <View
            key={id}
            style={{
              marginLeft: i ? -40 : 0,
              transform: [{ rotate: `${(i - (Math.min(ids.length, 3) - 1) / 2) * 7}deg` }],
            }}
          >
            <MiniCard id={id} cards={cards} width={64} />
          </View>
        ))}
      </View>
    </View>
  );
}

type Props = {
  m: Message;
  mine: boolean;
  cards: CatalogCard[];
  otherUsername: string;
  /** "Leído" under my latest message */
  read: boolean;
  /** this is their latest offer and nobody accepted it yet */
  canAccept: boolean;
  onAccept: () => void;
  onLongPress: () => void;
};

export function Bubble({
  m,
  mine,
  cards,
  otherUsername,
  read,
  canAccept,
  onAccept,
  onLongPress,
}: Props) {
  const c = useTheme();
  const router = useRouter();
  const time = clock(m.created_at) + (mine && read ? ` · ${t('chat.read')}` : '');
  const align = mine ? 'flex-end' : 'flex-start';
  const p = m.proposal;

  let body: React.ReactNode;
  let label: string;
  if (m.kind === 'proposal' && p?.type === 'offer') {
    // seen from the viewer: what I give / what I get
    const give = mine ? p.give : p.get;
    const get = mine ? p.get : p.give;
    label = `${mine ? t('chat.offerMine') : t('chat.offerTheirs', { username: otherUsername })}. ${t('matches.theyGive')}: ${get.length}. ${t('matches.youGive')}: ${give.length}.`;
    body = (
      <View
        style={{
          width: '88%',
          gap: 12,
          padding: 14,
          borderRadius: radius.card,
          backgroundColor: c.surface,
          borderWidth: 1.5,
          borderColor: mine ? c.line : c.ink,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icon name="swap" size={16} />
          <Txt variant="title" size={15}>
            {mine ? t('chat.offerMine') : t('chat.offerTheirs', { username: otherUsername })}
          </Txt>
        </View>
        <View
          importantForAccessibility="no-hide-descendants"
          style={{ flexDirection: 'row', alignItems: 'center' }}
        >
          <Side label={t('matches.theyGive')} ids={get} cards={cards} />
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: c.surface2,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="swap" size={16} />
          </View>
          <Side label={t('matches.youGive')} ids={give} cards={cards} />
        </View>
        {canAccept ? (
          <Button label={t('chat.accept')} icon="check" compact onPress={onAccept} />
        ) : null}
      </View>
    );
  } else if (m.kind === 'proposal' && p) {
    label = t(`chat.preview.${p.type}`);
    body = (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingVertical: 9,
          paddingHorizontal: 14,
          borderRadius: 999,
          backgroundColor: mine ? c.ink : c.surface2,
        }}
      >
        <Icon name={STEP_ICON[p.type] ?? 'check'} size={16} color={mine ? c.onInk : c.ink} />
        <Txt variant="label" size={15} color={mine ? c.onInk : c.ink}>
          {label}
        </Txt>
      </View>
    );
  } else if (m.kind === 'card' && m.card_id) {
    const card = cards.find((x) => x.id === m.card_id);
    const mp = card ? markerProps(card) : null;
    label = t('chat.preview.card', { name: card?.memberName ?? '' });
    body = (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${mine ? t('chat.you', { text: label }) : `@${otherUsername}: ${label}`}. ${time}`}
        onPress={() => router.push({ pathname: '/card/[id]', params: { id: m.card_id! } })}
        onLongPress={onLongPress}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          padding: 10,
          paddingRight: 16,
          borderRadius: 18,
          backgroundColor: mine ? c.ink : c.surface,
          borderWidth: mine ? 0 : 1,
          borderColor: c.line,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        {mp ? <CardMarker {...mp} width={54} decorative /> : null}
        <View style={{ gap: 2, maxWidth: 150 }}>
          <Txt variant="title" size={15} color={mine ? c.onInk : c.ink} numberOfLines={1}>
            {card?.memberName ?? ''}
          </Txt>
          <Txt size={12} color={mine ? c.onInk : c.muted} numberOfLines={2}>
            {mp ? `${card!.releaseTitle} · ${mp.version}` : ''}
          </Txt>
        </View>
      </Pressable>
    );
  } else {
    label = m.body ?? '';
    body = (
      <View
        style={{
          maxWidth: '80%',
          paddingVertical: 10,
          paddingHorizontal: 14,
          borderRadius: 18,
          borderBottomRightRadius: mine ? 6 : 18,
          borderBottomLeftRadius: mine ? 18 : 6,
          backgroundColor: mine ? c.ink : c.surface,
          borderWidth: mine ? 0 : 1,
          borderColor: c.line,
        }}
      >
        <Txt size={15} color={mine ? c.onInk : c.ink} selectable>
          {m.body}
        </Txt>
      </View>
    );
  }

  return (
    <Pressable
      // cards and the accept button stay reachable on their own with a screen reader
      accessible={m.kind !== 'card' && !canAccept}
      accessibilityLabel={`${mine ? t('chat.you', { text: label }) : `@${otherUsername}: ${label}`}. ${time}`}
      accessibilityHint={mine ? undefined : t('chat.reportMessage')}
      onLongPress={mine ? undefined : onLongPress}
      delayLongPress={350}
      style={{ alignItems: align, gap: 4, paddingVertical: 3 }}
    >
      {body}
      <Txt size={12} muted style={{ paddingHorizontal: 4 }}>
        {time}
      </Txt>
    </Pressable>
  );
}
