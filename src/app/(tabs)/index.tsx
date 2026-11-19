// Inicio (08-spec-matches-home): double matches first, then binder progress. No social feed.
// The Messages button (with the unread count) sits next to the greeting.
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';

import { listBinders } from '@/data/binders';
import { getDb } from '@/data/db';
import { fetchProfile } from '@/features/auth/account';
import { DemoNotice } from '@/features/auth/DemoNotice';
import { useSession } from '@/features/auth/useSession';
import { binderCards, owned } from '@/features/binder/pages';
import { selectBinder } from '@/features/binder/useBinder';
import { useCatalogData } from '@/features/catalog/useCatalog';
import { unreadTotal, useChats } from '@/features/chat/useChats';
import { Avatar, MatchTags, placeName, SwapRow } from '@/features/matches/MatchParts';
import { useMatches } from '@/features/matches/useMatches';
import { t } from '@/i18n';
import { textOn } from '@/lib/contrast';
import { era, radius } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { Button } from '@/ui/Button';
import { Icon } from '@/ui/icons/Icon';
import { StateView } from '@/ui/StateView';
import { TabScreen } from '@/ui/TabScreen';
import { Txt } from '@/ui/Txt';

const BAR_COLORS = Object.values(era);

function Binders() {
  'use no memo'; // reads SQLite during render (see useCatalogData)
  const c = useTheme();
  const router = useRouter();
  const { cards, marks } = useCatalogData();
  const binders = listBinders(getDb());
  if (!binders.length)
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t('home.firstBinder')}. ${t('home.firstBinderBody')}`}
        onPress={() => router.navigate('/binder')}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
          padding: 16,
          borderRadius: radius.card,
          borderWidth: 1.5,
          borderStyle: 'dashed',
          borderColor: c.line,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        {/* a tiny 3×3 page with one pocket filled, like the Binku mark */}
        <View
          style={{
            width: 52,
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 4,
            transform: [{ rotate: '-6deg' }],
          }}
        >
          {Array.from({ length: 9 }, (_, i) => (
            <View
              key={i}
              style={{
                width: 13,
                height: 18,
                borderRadius: 3,
                backgroundColor: i === 4 ? era.tomato : c.surface2,
              }}
            />
          ))}
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Txt variant="title" size={17}>
            {t('home.firstBinder')}
          </Txt>
          <Txt size={13} muted>
            {t('home.firstBinderBody')}
          </Txt>
        </View>
        <Icon name="chevronRight" size={18} color={c.muted} />
      </Pressable>
    );
  return (
    <View style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Txt variant="title" size={17} accessibilityRole="header" style={{ flex: 1 }}>
          {t('home.binders')}
        </Txt>
        <Pressable accessibilityRole="link" hitSlop={12} onPress={() => router.navigate('/binder')}>
          <Txt variant="label" size={15} color={c.accentText}>
            {t('home.seeAll')}
          </Txt>
        </Pressable>
      </View>
      {binders.slice(0, 4).map((b, i) => {
        const items = binderCards(cards, b.filter, []);
        const have = items.filter((x) => owned(marks.get(x.id))).length;
        const pct = items.length ? Math.round((have / items.length) * 100) : 0;
        return (
          <Pressable
            key={b.id}
            accessibilityRole="button"
            accessibilityLabel={`${b.title}, ${t('binder.progress', { owned: have, total: items.length })}`}
            onPress={() => {
              selectBinder(b.id);
              router.navigate('/binder');
            }}
            style={{ gap: 6 }}
          >
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Txt variant="label" size={15} style={{ flex: 1 }} numberOfLines={1}>
                {b.title}
              </Txt>
              <Txt variant="title" size={15}>
                {have}/{items.length}
              </Txt>
            </View>
            <View
              style={{
                height: 8,
                borderRadius: 8,
                backgroundColor: c.surface2,
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  width: `${pct}%`,
                  height: '100%',
                  backgroundColor: BAR_COLORS[i % BAR_COLORS.length],
                }}
              />
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function Matches() {
  const c = useTheme();
  const router = useRouter();
  const { cards } = useCatalogData();
  const res = useMatches();
  if (!res) return null;
  if (res.status === 'loading' && !res.matches.length) return null;
  const top = res.matches[0];
  const n = res.matches.length;

  if (!top)
    return (
      <View style={{ gap: 6 }}>
        {res.status === 'error' ? (
          <Txt size={13} muted>
            {t('matches.offline')}
          </Txt>
        ) : null}
        <StateView
          illustration="pocket"
          title={t('home.none')}
          body={t('home.noneBody')}
          actions={[{ label: t('home.toCatalog'), onPress: () => router.navigate('/catalog') }]}
        />
      </View>
    );

  return (
    <View style={{ gap: 14 }}>
      {/* Editorial headline: the number in the accent colour carries the news */}
      <Txt variant="display" size={46} accessibilityRole="header">
        <Txt variant="display" size={46} color={c.accentText}>
          {n}
        </Txt>{' '}
        {t('home.count', { count: n })}
      </Txt>
      {res.status === 'error' ? (
        <Txt size={13} muted>
          {t('matches.offline')}
        </Txt>
      ) : null}
      <View
        style={{
          gap: 14,
          padding: 16,
          borderRadius: radius.card,
          backgroundColor: c.surface,
          borderWidth: 1.5,
          borderColor: c.ink,
        }}
      >
        <View accessible style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Avatar username={top.username} size={44} />
          <View style={{ flex: 1, gap: 2 }}>
            <Txt variant="title" size={17} numberOfLines={1}>
              @{top.username}
            </Txt>
            <Txt size={13} muted numberOfLines={1}>
              {placeName(top)}
            </Txt>
          </View>
          <MatchTags m={top} />
        </View>
        <SwapRow m={top} cards={cards} width={92} />
        <Button
          label={t('home.see')}
          onPress={() => router.push({ pathname: '/match/[id]', params: { id: top.user_id } })}
        />
      </View>
      {res.matches.length > 1 ? (
        <Pressable
          accessibilityRole="link"
          onPress={() => router.push('/matches')}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            minHeight: 48,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          {/* a little stack of the next people waiting */}
          <View style={{ flexDirection: 'row' }}>
            {res.matches.slice(1, 4).map((m, i) => (
              <View
                key={m.user_id}
                style={{
                  marginLeft: i ? -10 : 0,
                  borderRadius: 18,
                  borderWidth: 2,
                  borderColor: c.bg,
                }}
              >
                <Avatar username={m.username} size={32} />
              </View>
            ))}
          </View>
          <Txt variant="label" size={15} color={c.accentText} style={{ flex: 1 }}>
            {t('home.allMatches', { count: res.matches.length })}
          </Txt>
          <Icon name="chevronRight" size={18} color={c.accentText} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** Messages button with the unread count (canvas Inicio header). */
function Inbox() {
  const c = useTheme();
  const router = useRouter();
  const res = useChats();
  if (!res) return null;
  const n = unreadTotal(res.chats);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        n ? `${t('chat.open')}, ${t('chat.unread', { count: n })}` : t('chat.open')
      }
      onPress={() => router.push('/messages')}
      hitSlop={6}
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
    >
      <Icon name="mail" size={21} />
      {n ? (
        <View
          style={{
            position: 'absolute',
            top: -4,
            right: -4,
            minWidth: 20,
            height: 20,
            paddingHorizontal: 5,
            borderRadius: 10,
            backgroundColor: c.accent,
            borderWidth: 2,
            borderColor: c.bg,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Txt size={12} variant="title" color={textOn(c.accent)} allowFontScaling={false}>
            {n > 9 ? '9+' : n}
          </Txt>
        </View>
      ) : null}
    </Pressable>
  );
}

export default function Home() {
  const session = useSession();
  // undefined = not loaded (or offline), null = account without @username yet.
  const [username, setUsername] = useState<string | null>();
  useFocusEffect(
    useCallback(() => {
      if (!session) return setUsername(undefined);
      fetchProfile()
        .then((data) => setUsername(data?.username ?? null))
        .catch(() => {});
    }, [session]),
  );

  return (
    <TabScreen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 }}>
        <Txt size={15} muted style={{ flex: 1 }} numberOfLines={1}>
          {username ? t('home.hello', { username }) : t('home.helloAnon')}
        </Txt>
        {session ? <Inbox /> : null}
      </View>
      {session === null ? (
        <>
          <Txt variant="display" size={46} accessibilityRole="header">
            {t('home.demoTitle')}
          </Txt>
          <DemoNotice />
        </>
      ) : (
        <Matches />
      )}
      <Binders />
    </TabScreen>
  );
}
