// Pieces shared by the inbox and the conversation.
import { View } from 'react-native';

import type { CatalogCard } from '@/data/catalog';
import type { Chat, Proposal, ProposalType } from '@/data/chat';
import { markerProps } from '@/features/catalog/cardView';
import { locale, t } from '@/i18n';
import { textOn } from '@/lib/contrast';
import { era } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { CardMarker } from '@/ui/CardMarker';
import { Icon } from '@/ui/icons/Icon';
import { Txt } from '@/ui/Txt';

const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** 12:40 today, "ayer", then "12 oct". */
export function chatTime(iso: string) {
  const d = new Date(iso);
  const diff = Math.round((day(new Date()) - day(d)) / 86400000);
  if (diff === 0) return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  if (diff === 1) return t('chat.yesterday');
  return d.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
}

export const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });

/** Separator label: "Hoy", "ayer", "12 oct". */
export function dayLabel(iso: string) {
  const diff = Math.round((day(new Date()) - day(new Date(iso))) / 86400000);
  if (diff === 0) return t('chat.today');
  return chatTime(iso);
}
export const sameDay = (a: string, b: string) => day(new Date(a)) === day(new Date(b));

/** One line for the inbox row. */
export function preview(chat: Chat, cards: CatalogCard[]) {
  const text =
    chat.last_kind === 'text'
      ? (chat.last_body ?? '')
      : chat.last_kind === 'card'
        ? t('chat.preview.card', {
            name: cards.find((x) => x.id === chat.last_card)?.memberName ?? '',
          })
        : chat.last_proposal
          ? t(`chat.preview.${chat.last_proposal.type}`)
          : '';
  return chat.last_mine ? t('chat.you', { text }) : text;
}

const STAGE_TONE: Record<ProposalType, 'soft' | 'accent' | 'strong'> = {
  offer: 'soft',
  accept: 'accent',
  tracked: 'accent',
  shipped: 'accent',
  received: 'strong',
};

/** Where the trade is: Propuesta → Aceptado → Enviado → Recibido. */
export function StageTag({ stage }: { stage: ProposalType }) {
  const c = useTheme();
  const tone = STAGE_TONE[stage];
  const bg = tone === 'soft' ? c.surface2 : tone === 'accent' ? era.mango : c.ink;
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        paddingHorizontal: 9,
        paddingVertical: 2,
        borderRadius: 999,
        backgroundColor: bg,
      }}
    >
      <Txt size={12} variant="label" color={tone === 'soft' ? c.ink : textOn(bg)}>
        {t(`chat.stage.${stage}`)}
      </Txt>
    </View>
  );
}

export function MiniCard({
  id,
  cards,
  width,
}: {
  id: string;
  cards: CatalogCard[];
  width: number;
}) {
  const card = cards.find((x) => x.id === id);
  if (!card) return null;
  return <CardMarker {...markerProps(card)} width={width} decorative />;
}

/** The latest offer seen from the viewer: what I give ⇄ what I get. */
export function viewerSides(offer: Extract<Proposal, { type: 'offer' }>, mine: boolean) {
  return mine ? { give: offer.give, get: offer.get } : { give: offer.get, get: offer.give };
}

/** Tiny "give ⇄ get" pair for rows and the pinned trade card. */
export function SwapPair({
  give,
  get,
  cards,
  width,
}: {
  give: string[];
  get: string[];
  cards: CatalogCard[];
  width: number;
}) {
  const c = useTheme();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
    >
      <MiniCard id={give[0]!} cards={cards} width={width} />
      <Icon name="swap" size={14} color={c.muted} />
      <MiniCard id={get[0]!} cards={cards} width={width} />
    </View>
  );
}
