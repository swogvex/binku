// Bottom of the conversation: why a message was refused, quick trade replies, and the input row
// (+ to add a card or proposal, text, send). Adult ↔ minor chats have no text field.
import { useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';

import type { CatalogCard } from '@/data/catalog';
import type { Proposal, ProposalType } from '@/data/chat';
import { t, type TKey } from '@/i18n';
import { fonts, radius, screenPadding } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { Button } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { Icon } from '@/ui/icons/Icon';
import { Txt } from '@/ui/Txt';

import { SwapPair } from './ChatParts';

type Offer = Extract<Proposal, { type: 'offer' }>;
const QUICK: Exclude<ProposalType, 'offer'>[] = ['accept', 'tracked', 'shipped', 'received'];

function CircleButton({
  icon,
  label,
  onPress,
  filled,
  disabled,
}: {
  icon: 'plus' | 'send';
  label: string;
  onPress: () => void;
  filled?: boolean;
  disabled?: boolean;
}) {
  const c = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: filled ? c.ink : c.surface,
        borderWidth: filled ? 0 : 1,
        borderColor: c.line,
        opacity: disabled ? 0.35 : pressed ? 0.7 : 1,
      })}
    >
      <Icon name={icon} size={20} color={filled ? c.onInk : c.ink} />
    </Pressable>
  );
}

/** The proposal waiting to be sent (from the match or the + sheet). */
function Draft({
  offer,
  cards,
  onSend,
  onDiscard,
  sending,
}: {
  offer: Offer;
  cards: CatalogCard[];
  onSend: () => void;
  onDiscard: () => void;
  sending: boolean;
}) {
  const c = useTheme();
  const name = (id: string) => cards.find((x) => x.id === id)?.memberName ?? '';
  return (
    <View
      style={{
        gap: 12,
        padding: 14,
        borderRadius: radius.card,
        backgroundColor: c.surface,
        borderWidth: 1.5,
        borderColor: c.ink,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <SwapPair give={offer.give} get={offer.get} cards={cards} width={30} />
        <View style={{ flex: 1, gap: 2 }}>
          <Txt variant="title" size={15}>
            {t('chat.draft')}
          </Txt>
          <Txt size={12} muted numberOfLines={2}>
            {`${t('chat.youGive')} ${offer.give.map(name).join(', ')} · ${t('chat.youGet')} ${offer.get.map(name).join(', ')}`}
          </Txt>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button
          label={t('chat.discard')}
          variant="ghost"
          compact
          onPress={onDiscard}
          style={{ flex: 1 }}
        />
        <Button
          label={t('chat.sendProposal')}
          icon="send"
          compact
          disabled={sending}
          onPress={onSend}
          style={{ flex: 1.4 }}
        />
      </View>
    </View>
  );
}

type Props = {
  username: string;
  cards: CatalogCard[];
  structured: boolean;
  blocked: boolean;
  error: TKey | null;
  sending: boolean;
  draft: Offer | null;
  /** quick replies appear once a trade is on the table */
  quick: boolean;
  bottom: number;
  onSend: (text: string) => Promise<boolean>;
  onSendDraft: () => void;
  onDiscardDraft: () => void;
  onQuick: (type: Exclude<ProposalType, 'offer'>) => void;
  onAttach: () => void;
  onUnblock: () => void;
};

export function Composer(p: Props) {
  const c = useTheme();
  const [text, setText] = useState('');
  const send = async () => {
    if (await p.onSend(text)) setText('');
  };

  return (
    <View
      style={{
        gap: 10,
        paddingHorizontal: screenPadding,
        paddingTop: 10,
        paddingBottom: p.bottom,
        borderTopWidth: 1,
        borderTopColor: c.line,
        backgroundColor: c.bg,
      }}
    >
      {p.error ? (
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
          <Icon name="shield" size={16} color={c.accentText} />
          <Txt
            size={13}
            variant="label"
            color={c.accentText}
            accessibilityLiveRegion="polite"
            style={{ flex: 1 }}
          >
            {t(p.error)}
          </Txt>
        </View>
      ) : null}

      {p.blocked ? (
        <View style={{ gap: 10, paddingBottom: 4 }}>
          <Txt size={15} muted style={{ textAlign: 'center' }}>
            {t('chat.blocked', { username: p.username })}
          </Txt>
          <Button
            label={t('chat.unblock', { username: p.username })}
            variant="ghost"
            compact
            onPress={p.onUnblock}
          />
        </View>
      ) : (
        <>
          {p.draft ? (
            <Draft
              offer={p.draft}
              cards={p.cards}
              sending={p.sending}
              onSend={p.onSendDraft}
              onDiscard={p.onDiscardDraft}
            />
          ) : null}
          {p.quick ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              style={{ marginHorizontal: -screenPadding }}
              contentContainerStyle={{ paddingHorizontal: screenPadding, gap: 8 }}
            >
              {QUICK.map((q) => (
                <Chip key={q} label={t(`chat.quick.${q}`)} onPress={() => p.onQuick(q)} />
              ))}
            </ScrollView>
          ) : null}
          {p.structured ? (
            <Txt size={12} muted>
              {t('chat.structured')}
            </Txt>
          ) : null}
          {p.structured ? (
            // no text field with minors: one clear action instead of a lonely + button
            <Button label={t('chat.attach')} icon="plus" variant="ghost" onPress={p.onAttach} />
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
              <CircleButton icon="plus" label={t('chat.attach')} onPress={p.onAttach} />
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder={t('chat.placeholder')}
                placeholderTextColor={c.muted}
                accessibilityLabel={t('chat.placeholder')}
                multiline
                maxLength={500}
                style={{
                  flex: 1,
                  minHeight: 44,
                  maxHeight: 120,
                  paddingHorizontal: 16,
                  paddingTop: 11,
                  paddingBottom: 11,
                  borderRadius: 22,
                  backgroundColor: c.surface,
                  borderWidth: 1,
                  borderColor: c.line,
                  color: c.ink,
                  fontFamily: fonts.text400,
                  fontSize: 15,
                }}
              />
              <CircleButton
                icon="send"
                label={t('chat.send')}
                filled
                disabled={!text.trim() || p.sending}
                onPress={send}
              />
            </View>
          )}
        </>
      )}
    </View>
  );
}
