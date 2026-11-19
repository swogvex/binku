// Mensajes (08-spec-chat-messages): one row per conversation, newest first. Unread rows are bold
// with a count; the trade stage (Propuesta, Enviado…) and the cards in play sit under the text.
// Trade filters (En curso / Por valorar / Cerrados) arrive with trades in M7.
import { useRouter } from 'expo-router';
import { FlatList, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Chat } from '@/data/chat';
import { useCatalogData } from '@/features/catalog/useCatalog';
import { chatTime, MiniCard, preview, StageTag, viewerSides } from '@/features/chat/ChatParts';
import { unreadTotal, useChats } from '@/features/chat/useChats';
import { Avatar, TradeSteps } from '@/features/matches/MatchParts';
import { t } from '@/i18n';
import { textOn } from '@/lib/contrast';
import { radius, screenPadding } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { Icon } from '@/ui/icons/Icon';
import { RoundButton } from '@/ui/RoundButton';
import { StateView } from '@/ui/StateView';
import { Txt } from '@/ui/Txt';

function Row({ chat }: { chat: Chat }) {
  const c = useTheme();
  const router = useRouter();
  const { cards } = useCatalogData();
  const unread = chat.unread > 0;
  const sides = chat.offer ? viewerSides(chat.offer, !!chat.offer_mine) : null;
  const names = sides
    ? [sides.get[0], sides.give[0]].map((id) => cards.find((x) => x.id === id)?.memberName ?? '')
    : null;
  const text = preview(chat, cards);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[
        `@${chat.other_username}`,
        unread ? t('chat.unread', { count: chat.unread }) : null,
        text,
        chat.stage ? t(`chat.stage.${chat.stage}`) : null,
        chat.last_message_at ? chatTime(chat.last_message_at) : null,
      ]
        .filter(Boolean)
        .join('. ')}
      onPress={() => router.push({ pathname: '/chat/[id]', params: { id: chat.id! } })}
      style={({ pressed }) => ({
        flexDirection: 'row',
        gap: 14,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: c.line,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      {/* avatar with the card they'd give you peeking out, like the canvas */}
      <View style={{ width: 52, height: 52 }}>
        <Avatar username={chat.other_username} size={48} />
        {sides ? (
          <View
            style={{
              position: 'absolute',
              right: -4,
              bottom: -6,
              transform: [{ rotate: '8deg' }],
              borderRadius: 4,
              borderWidth: 2,
              borderColor: c.bg,
            }}
          >
            <MiniCard id={sides.get[0]!} cards={cards} width={20} />
          </View>
        ) : null}
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Txt variant="title" size={15} numberOfLines={1} style={{ flex: 1 }}>
            @{chat.other_username}
          </Txt>
          {chat.muted ? <Icon name="bell" size={14} color={c.muted} /> : null}
          <Txt
            size={12}
            variant={unread ? 'label' : 'body'}
            color={unread ? c.accentText : c.muted}
          >
            {chat.last_message_at ? chatTime(chat.last_message_at) : ''}
          </Txt>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Txt
            size={15}
            variant={unread ? 'label' : 'body'}
            color={unread ? c.ink : c.muted}
            numberOfLines={1}
            style={{ flex: 1 }}
          >
            {text}
          </Txt>
          {unread ? (
            <View
              style={{
                minWidth: 22,
                height: 22,
                paddingHorizontal: 6,
                borderRadius: 11,
                backgroundColor: c.accent,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Txt size={12} variant="title" color={textOn(c.accent)} allowFontScaling={false}>
                {chat.unread > 99 ? '99+' : chat.unread}
              </Txt>
            </View>
          ) : null}
        </View>
        {chat.stage || names ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
            {chat.stage ? <StageTag stage={chat.stage} /> : null}
            {names ? (
              <Txt size={12} muted numberOfLines={1} style={{ flexShrink: 1 }}>
                {`${names[0]} ⇄ ${names[1]}`}
              </Txt>
            ) : null}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

export default function MessagesScreen() {
  const c = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const res = useChats();
  const chats = res?.chats ?? [];
  const unread = unreadTotal(chats);

  const steps = (
    <View
      style={{
        padding: 18,
        borderRadius: radius.card,
        backgroundColor: c.surface,
        borderWidth: 1,
        borderColor: c.line,
      }}
    >
      <TradeSteps />
    </View>
  );

  const footer = chats.length ? (
    <View style={{ gap: 24, paddingTop: 18 }}>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
        <Icon name="lock" size={14} color={c.muted} />
        <Txt size={12} muted style={{ flex: 1 }}>
          {t('chat.retention')}
        </Txt>
      </View>
      {/* a short inbox would leave half a blank screen: show how a trade goes instead */}
      {chats.length < 4 ? steps : null}
    </View>
  ) : undefined;

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: c.bg, marginTop: insets.top }}
      contentContainerStyle={{
        flexGrow: 1,
        paddingTop: 8,
        paddingBottom: insets.bottom + 24,
        paddingHorizontal: screenPadding,
      }}
      data={chats}
      keyExtractor={(x) => x.id!}
      ListHeaderComponent={
        <View style={{ gap: 16, paddingBottom: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <RoundButton
              icon="chevronLeft"
              label={t('cardSheet.back')}
              onPress={() => router.back()}
            />
          </View>
          <View style={{ gap: 4 }}>
            <Txt variant="display" size={40} accessibilityRole="header">
              {t('chat.title')}
            </Txt>
            {unread ? (
              <Txt size={13} color={c.accentText} variant="label">
                {t('chat.unread', { count: unread })}
              </Txt>
            ) : null}
            {res?.status === 'error' ? (
              <Txt size={13} muted>
                {t('matches.offline')}
              </Txt>
            ) : null}
          </View>
        </View>
      }
      ListEmptyComponent={
        res === null ? (
          <StateView illustration="pocket" title={t('chat.needAccount')} />
        ) : res.status !== 'loading' ? (
          <View style={{ flex: 1, justifyContent: 'center', gap: 24, paddingTop: 8 }}>
            <StateView
              illustration="pocket"
              title={t('chat.empty')}
              body={t('chat.emptyBody')}
              actions={[{ label: t('chat.toMatches'), onPress: () => router.push('/matches') }]}
            />
            {steps}
            <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center' }}>
              <Icon name="lock" size={14} color={c.muted} />
              <Txt size={12} muted>
                {t('chat.retention')}
              </Txt>
            </View>
          </View>
        ) : undefined
      }
      renderItem={({ item }) => <Row chat={item} />}
      ListFooterComponent={footer}
    />
  );
}
