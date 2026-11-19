// Conversation (08-spec-chat-messages). id = conversation, or "new" with ?to=<user> for a first
// contact (the server creates the conversation with the first message). New messages arrive live
// while the screen is open. Report/block are in ⋯ (2 taps); long-press a message to report it.
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, KeyboardAvoidingView, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  chatError,
  fetchChat,
  fetchMessages,
  markRead,
  sendMessage,
  subscribeMessages,
  unblock,
  type Chat,
  type Message,
  type Outgoing,
  type Proposal,
} from '@/data/chat';
import { useSession } from '@/features/auth/useSession';
import { useCatalogData } from '@/features/catalog/useCatalog';
import { takePicked } from '@/features/chat/attach';
import { Bubble, DaySeparator } from '@/features/chat/Bubbles';
import { sameDay, StageTag, SwapPair, viewerSides } from '@/features/chat/ChatParts';
import { Composer } from '@/features/chat/Composer';
import { refreshChats } from '@/features/chat/useChats';
import { Avatar, placeName, SwapRow } from '@/features/matches/MatchParts';
import { findMatch } from '@/features/matches/useMatches';
import { offerMessageAlerts } from '@/features/notifications/push';
import { t, type TKey } from '@/i18n';
import { haptics } from '@/lib/haptics';
import { radius, screenPadding } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { Icon } from '@/ui/icons/Icon';
import { useKeyboardVisible } from '@/ui/dockVisibility';
import { RoundButton } from '@/ui/RoundButton';
import { StateView } from '@/ui/StateView';
import { Txt } from '@/ui/Txt';

type Offer = Extract<Proposal, { type: 'offer' }>;
const UUID = /^[0-9a-f-]{36}$/;

/** Newest first, no duplicates (a message can arrive both from send and from Realtime). */
const merge = (a: Message[], b: Message[]) => {
  const seen = new Set<number>();
  return [...a, ...b].filter((m) => !seen.has(m.id) && seen.add(m.id)).sort((x, y) => y.id - x.id);
};

function Header({ chat, onMenu }: { chat: Chat | null | undefined; onMenu: () => void }) {
  const router = useRouter();
  const place = chat
    ? placeName({ country: chat.other_country, subdivision: chat.other_subdivision, proximity: 0 })
    : '';
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: screenPadding,
        paddingBottom: 10,
      }}
    >
      <RoundButton icon="chevronLeft" label={t('cardSheet.back')} onPress={() => router.back()} />
      {chat ? (
        <>
          <Avatar username={chat.other_username} size={40} />
          <View style={{ flex: 1, gap: 1 }} accessible accessibilityRole="header">
            <Txt variant="title" size={17} numberOfLines={1}>
              @{chat.other_username}
            </Txt>
            {place ? (
              <Txt size={12} muted numberOfLines={1}>
                {place}
              </Txt>
            ) : null}
          </View>
          <RoundButton icon="more" label={t('chat.options')} onPress={onMenu} />
        </>
      ) : (
        <View style={{ flex: 1 }} />
      )}
    </View>
  );
}

/** The trade on the table, pinned under the header (canvas). "Hecho" arrives with trades (M7). */
function Pinned({ chat }: { chat: Chat }) {
  const c = useTheme();
  const { cards } = useCatalogData();
  if (!chat.offer || !chat.stage) return null;
  const { give, get } = viewerSides(chat.offer, !!chat.offer_mine);
  const name = (id: string) => cards.find((x) => x.id === id)?.memberName ?? '';
  return (
    <View
      accessible
      accessibilityLabel={`${t(`chat.stage.${chat.stage}`)}. ${t('matches.theyGive')} ${get.map(name).join(', ')}. ${t('matches.youGive')} ${give.map(name).join(', ')}.`}
      style={{
        marginHorizontal: screenPadding,
        marginBottom: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: radius.card,
        backgroundColor: c.surface,
        borderWidth: 1,
        borderColor: c.line,
      }}
    >
      <SwapPair give={give} get={get} cards={cards} width={36} />
      <View style={{ flex: 1, gap: 4 }}>
        <StageTag stage={chat.stage} />
        <Txt size={12} muted numberOfLines={1}>
          {`${t('matches.theyGive')} ${get.map(name).join(', ')} · ${t('matches.youGive')} ${give.map(name).join(', ')}`}
        </Txt>
      </View>
    </View>
  );
}

function SafetyTip() {
  const c = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: 10,
        padding: 12,
        marginTop: 8,
        marginBottom: 6,
        borderRadius: radius.card,
        backgroundColor: c.surface2,
      }}
    >
      <Icon name="shield" size={18} color={c.muted} />
      <Txt size={13} muted style={{ flex: 1 }}>
        {t('chat.tip')}
      </Txt>
    </View>
  );
}

export default function ChatScreen() {
  const c = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string; to?: string; propose?: string }>();
  const me = useSession()?.user.id;
  const { cards } = useCatalogData();
  const keyboard = useKeyboardVisible();

  const [convId, setConvId] = useState(UUID.test(params.id) ? params.id : null);
  const otherParam = params.to && UUID.test(params.to) ? params.to : null;
  const [chat, setChat] = useState<Chat | null>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loaded, setLoaded] = useState(!convId);
  const [more, setMore] = useState(true);
  const [error, setError] = useState<TKey | null>(null);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState<Offer | null>(() => {
    const m = params.propose && otherParam ? findMatch(otherParam) : undefined;
    return m ? { type: 'offer', give: m.you_give, get: m.they_give } : null;
  });

  const loadHeader = useCallback(() => {
    const by = convId ? { id: convId } : otherParam ? { other: otherParam } : null;
    if (!by) return setChat(null);
    fetchChat(by)
      .then((x) => {
        setChat(x);
        // the same trade is already on the table: don't offer to send it again
        const sent = x?.offer && JSON.stringify([x.offer.give, x.offer.get]);
        setDraft((d) =>
          d &&
          (sent === JSON.stringify([d.give, d.get]) || sent === JSON.stringify([d.get, d.give]))
            ? null
            : d,
        );
        if (x?.id && !convId) {
          setLoaded(false); // already talking: continue that conversation
          setConvId(x.id);
        }
      })
      .catch(() => setChat((prev) => prev ?? null));
  }, [convId, otherParam]);

  // Header again on focus: block / mute may have changed in the options sheet.
  useFocusEffect(
    useCallback(() => {
      loadHeader();
      const picked = takePicked();
      if (picked && 'offer' in picked) setDraft(picked.offer);
      if (picked && 'card' in picked) void send({ kind: 'card', card: picked.card });
      if (convId) markRead(convId).then(refreshChats, () => {});
      // eslint-disable-next-line react-hooks/exhaustive-deps -- send is stable enough here
    }, [loadHeader, convId]),
  );

  useEffect(() => {
    if (!convId) return;
    let live = true;
    fetchMessages(convId)
      .then((list) => {
        if (!live) return;
        setMessages((prev) => merge(prev, list));
        setMore(list.length === 50);
      })
      .catch(() => setError('chat.err.offline'))
      .finally(() => live && setLoaded(true));
    const stop = subscribeMessages(convId, (m) => {
      setMessages((prev) => merge([m], prev));
      if (m.sender_id !== me) {
        haptics.selection();
        void markRead(convId);
        loadHeader(); // their read time and the trade stage move with each message
      }
    });
    return () => {
      live = false;
      stop();
    };
  }, [convId, me, loadHeader]);

  const loadOlder = () => {
    const oldest = messages[messages.length - 1];
    if (!convId || !more || !oldest) return;
    fetchMessages(convId, oldest.id)
      .then((list) => {
        setMessages((prev) => merge(prev, list));
        setMore(list.length === 50);
      })
      .catch(() => {});
  };

  async function send(out: Outgoing) {
    if (!chat) return false;
    setSending(true);
    try {
      const first = !convId;
      const msg = await sendMessage(
        convId ? { conversation: convId } : { user: chat.other_id },
        out,
      );
      setMessages((prev) => merge([msg], prev));
      setError(null);
      if (first) {
        setConvId(msg.conversation_id);
        void offerMessageAlerts();
      }
      haptics.selection();
      loadHeader();
      void refreshChats();
      return true;
    } catch (e) {
      setError(chatError(e));
      return false;
    } finally {
      setSending(false);
    }
  }

  // Their latest offer can be accepted until somebody sends a step after it.
  const acceptable = useMemo(() => {
    const last = messages.find((m) => m.kind === 'proposal');
    return last?.proposal?.type === 'offer' && last.sender_id !== me ? last.id : null;
  }, [messages, me]);
  const lastMineId = messages.find((m) => m.sender_id === me)?.id;
  const readUpTo = chat?.other_read_at ? new Date(chat.other_read_at).getTime() : 0;

  if (chat === null)
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top + 8 }}>
        <Header chat={null} onMenu={() => {}} />
        <StateView illustration="ups" title={t('chat.err.unavailable')} />
      </View>
    );

  const openMenu = () =>
    chat &&
    router.push({
      pathname: '/chat-options',
      params: {
        conversation: convId ?? '',
        other: chat.other_id,
        username: chat.other_username,
        muted: chat.muted ? '1' : '',
        blocked: chat.blocked ? '1' : '',
      },
    });

  const report = (m: Message) =>
    chat &&
    router.push({
      pathname: '/report',
      params: { message: String(m.id), other: chat.other_id, username: chat.other_username },
    });

  const empty = loaded && !messages.length;
  const match = chat ? findMatch(chat.other_id) : undefined;

  return (
    <KeyboardAvoidingView
      behavior="padding"
      style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top + 8 }}
    >
      <Header chat={chat} onMenu={openMenu} />
      {chat ? <Pinned chat={chat} /> : null}

      {empty && chat ? (
        // first contact: who you're writing to and what happens next, centred, not a blank page
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            alignItems: 'center',
            gap: 14,
            padding: screenPadding,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <Avatar username={chat.other_username} size={64} />
          <Txt
            variant="display"
            size={28}
            style={{ textAlign: 'center' }}
            accessibilityRole="header"
          >
            {t('chat.startTitle')}
          </Txt>
          <Txt size={15} muted style={{ textAlign: 'center', maxWidth: 300 }}>
            {t('chat.startBody', { username: chat.other_username })}
          </Txt>
          {match ? (
            // what you two would swap, big, so the first message has a reason
            <View
              style={{
                alignSelf: 'stretch',
                paddingVertical: 18,
                marginTop: 6,
                borderRadius: radius.card,
                backgroundColor: c.surface,
                borderWidth: 1,
                borderColor: c.line,
              }}
            >
              <SwapRow m={match} cards={cards} width={84} />
            </View>
          ) : null}
          <SafetyTip />
        </ScrollView>
      ) : (
        <FlatList
          inverted
          data={messages}
          keyExtractor={(m) => String(m.id)}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: screenPadding, paddingVertical: 8 }}
          onEndReached={loadOlder}
          onEndReachedThreshold={0.4}
          // inverted: the footer is drawn at the top, before the first message
          ListFooterComponent={!more || !messages.length ? <SafetyTip /> : undefined}
          renderItem={({ item, index }) => {
            const older = messages[index + 1];
            const mine = item.sender_id === me;
            return (
              <View>
                {!older || !sameDay(older.created_at, item.created_at) ? (
                  <DaySeparator iso={item.created_at} />
                ) : null}
                <Bubble
                  m={item}
                  mine={mine}
                  cards={cards}
                  otherUsername={chat?.other_username ?? ''}
                  read={item.id === lastMineId && new Date(item.created_at).getTime() <= readUpTo}
                  canAccept={item.id === acceptable && !chat?.blocked}
                  onAccept={() => void send({ kind: 'proposal', proposal: { type: 'accept' } })}
                  onLongPress={() => report(item)}
                />
              </View>
            );
          }}
        />
      )}

      {chat ? (
        <Composer
          username={chat.other_username}
          cards={cards}
          structured={chat.structured}
          blocked={chat.blocked}
          error={error}
          sending={sending}
          draft={draft}
          quick={chat.stage === 'accept' || chat.stage === 'tracked' || chat.stage === 'shipped'}
          bottom={keyboard ? 10 : insets.bottom + 10}
          onSend={(text) => send({ kind: 'text', body: text })}
          onSendDraft={() =>
            draft &&
            void send({ kind: 'proposal', proposal: draft }).then((ok) => ok && setDraft(null))
          }
          onDiscardDraft={() => setDraft(null)}
          onQuick={(type) => void send({ kind: 'proposal', proposal: { type } })}
          onAttach={() =>
            router.push({ pathname: '/chat-attach', params: { other: chat.other_id } })
          }
          onUnblock={() =>
            unblock(chat.other_id).then(loadHeader, () => setError('chat.err.offline'))
          }
        />
      ) : null}
    </KeyboardAvoidingView>
  );
}
