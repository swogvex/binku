// Inicio (08-spec-matches-home): double matches first, then binder progress. No social feed.
// Messages and notifications icons arrive with chat (M6).
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
import { Avatar, MatchTags, placeName, SwapRow } from '@/features/matches/MatchParts';
import { useMatches } from '@/features/matches/useMatches';
import { t } from '@/i18n';
import { era, radius } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { Button } from '@/ui/Button';
import { TabScreen } from '@/ui/TabScreen';
import { Txt } from '@/ui/Txt';

const BAR_COLORS = Object.values(era);

function Binders() {
  'use no memo'; // reads SQLite during render (see useCatalogData)
  const c = useTheme();
  const router = useRouter();
  const { cards, marks } = useCatalogData();
  const binders = listBinders(getDb());
  if (!binders.length) return null;
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
  const doubles = res.matches.filter((m) => m.kind === 'double');
  const top = doubles[0] ?? res.matches[0];
  const n = doubles.length || res.matches.length;
  const headline =
    res.status === 'loading' && !res.matches.length
      ? null
      : !res.matches.length
        ? t('home.none')
        : doubles.length
          ? t('home.doubles', { count: n })
          : t('home.singles', { count: n });
  return (
    <View style={{ gap: 14 }}>
      {headline ? (
        <Txt variant="display" size={46} accessibilityRole="header">
          {headline}
        </Txt>
      ) : null}
      {res.status === 'error' ? (
        <Txt size={13} muted>
          {t('matches.offline')}
        </Txt>
      ) : null}
      {top ? (
        <View
          style={{
            gap: 12,
            padding: 14,
            borderRadius: radius.card,
            backgroundColor: c.surface,
            borderWidth: 1,
            borderColor: c.line,
          }}
        >
          <View accessible style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Avatar username={top.username} />
            <View style={{ flex: 1, gap: 2 }}>
              <Txt variant="title" size={15}>
                @{top.username}
              </Txt>
              <Txt size={12} muted>
                {placeName(top)}
              </Txt>
            </View>
            <MatchTags m={top} />
          </View>
          <SwapRow m={top} cards={cards} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button
              label={t('home.see')}
              style={{ flex: 1 }}
              onPress={() => router.push({ pathname: '/match/[id]', params: { id: top.user_id } })}
            />
            <Button
              label={t('home.allMatches')}
              variant="ghost"
              style={{ flex: 1 }}
              onPress={() => router.push('/matches')}
            />
          </View>
        </View>
      ) : res.status === 'ready' ? (
        <Txt muted>{t('home.noneBody')}</Txt>
      ) : null}
    </View>
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
      <Txt size={15} muted>
        {username ? t('home.hello', { username }) : t('home.helloAnon')}
      </Txt>
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
