// Match detail: who, where (subdivision only), the swap at a glance and every card both ways.
// "Proponer este cambio" opens the chat with the trade ready to send.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { markerProps } from '@/features/catalog/cardView';
import { useCatalogData } from '@/features/catalog/useCatalog';
import { Avatar, MatchTags, placeName, TradeSteps } from '@/features/matches/MatchParts';
import { useMatches } from '@/features/matches/useMatches';
import { t } from '@/i18n';
import { radius, screenPadding } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { Button } from '@/ui/Button';
import { CardMarker } from '@/ui/CardMarker';
import { Icon, type IconName } from '@/ui/icons/Icon';
import { RoundButton } from '@/ui/RoundButton';
import { StateView } from '@/ui/StateView';
import { Txt } from '@/ui/Txt';

const COL_PAD = 14;

/** One half of the ticket: its cards stacked, each with the member and version underneath. */
function Half({ label, ids, width }: { label: string; ids: string[]; width: number }) {
  const router = useRouter();
  const { cards, marks } = useCatalogData();
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 12, padding: COL_PAD }}>
      <Txt variant="label" size={13} muted accessibilityRole="header">
        {`${label} · ${ids.length}`}
      </Txt>
      {/* The shorter side centres itself: one card sits between the other side's two. */}
      <View style={{ flex: 1, justifyContent: 'center', gap: 16 }}>
        {ids.map((id) => {
          const card = cards.find((x) => x.id === id);
          if (!card) return null;
          const p = markerProps(card, marks.get(id));
          return (
            <Pressable
              key={id}
              accessibilityRole="button"
              accessibilityLabel={`${card.memberName}, ${card.releaseTitle}, ${p.version}`}
              onPress={() => router.push({ pathname: '/card/[id]', params: { id } })}
              style={({ pressed }) => ({ width, gap: 6, opacity: pressed ? 0.8 : 1 })}
            >
              <CardMarker {...p} width={width} decorative />
              <View
                importantForAccessibility="no-hide-descendants"
                style={{ alignItems: 'center' }}
              >
                <Txt variant="label" size={13} numberOfLines={1}>
                  {card.memberName}
                </Txt>
                <Txt size={12} muted numberOfLines={1}>
                  {p.version}
                </Txt>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** The swap as a trade ticket: two halves split by a dashed fold with ⇄ on it. */
function Ticket({ they, you }: { they: string[]; you: string[] }) {
  const c = useTheme();
  const { width: screen } = useWindowDimensions();
  const half = (screen - screenPadding * 2) / 2;
  const cardW = Math.min(half - COL_PAD * 2 - 8, 132);
  return (
    <View
      style={{
        flexDirection: 'row',
        borderRadius: radius.card,
        backgroundColor: c.surface,
        borderWidth: 1.5,
        borderColor: c.ink,
      }}
    >
      <Half label={t('matches.theyGive')} ids={they} width={cardW} />
      <View
        style={{ width: 0, borderLeftWidth: 1.5, borderStyle: 'dashed', borderColor: c.line }}
      />
      <Half label={t('matches.youGive')} ids={you} width={cardW} />
      <View
        importantForAccessibility="no"
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%', // on the fold, level with the cards
          marginTop: -20,
          width: 40,
          height: 40,
          marginLeft: -20,
          borderRadius: 20,
          backgroundColor: c.bg,
          borderWidth: 1.5,
          borderColor: c.ink,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name="swap" size={20} />
      </View>
    </View>
  );
}

/** Before trading: the safety notes from the canvas trade flow. */
function Tips() {
  const c = useTheme();
  const items: { icon: IconName; text: string }[] = [
    { icon: 'lock', text: t('matches.tipAddress') },
    { icon: 'mail', text: t('matches.tipTracked') },
    { icon: 'check', text: t('matches.tipPayments') },
  ];
  return (
    <View style={{ gap: 12 }}>
      <Txt variant="title" size={17} accessibilityRole="header">
        {t('matches.tipsTitle')}
      </Txt>
      {items.map((it) => (
        <View key={it.icon} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: c.surface2,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name={it.icon} size={18} />
          </View>
          <Txt size={15} style={{ flex: 1 }}>
            {it.text}
          </Txt>
        </View>
      ))}
    </View>
  );
}

export default function MatchScreen() {
  const c = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const res = useMatches();
  const m = res?.matches.find((x) => x.user_id === id);

  return (
    // The safe area sits outside the scroll view so content never slides under the status bar.
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: 8,
          paddingBottom: 24,
          paddingHorizontal: screenPadding,
          gap: 28,
        }}
      >
        <View style={{ flexDirection: 'row' }}>
          <RoundButton
            icon="chevronLeft"
            label={t('cardSheet.back')}
            onPress={() => router.back()}
          />
        </View>
        {!m ? (
          res?.status === 'loading' ? null : (
            <StateView illustration="ups" title={t('matches.gone')} />
          )
        ) : (
          <>
            <View accessible style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <Avatar username={m.username} size={64} />
              <View style={{ flex: 1, gap: 4 }}>
                <Txt variant="title" size={22} accessibilityRole="header" numberOfLines={1}>
                  @{m.username}
                </Txt>
                <Txt size={13} muted numberOfLines={1}>
                  {placeName(m)}
                </Txt>
              </View>
              <MatchTags m={m} />
            </View>
            <Ticket they={m.they_give} you={m.you_give} />
            <TradeSteps />
            <Tips />
          </>
        )}
      </ScrollView>

      {m ? (
        // The next step stays visible at the bottom.
        <View
          style={{
            gap: 8,
            paddingHorizontal: screenPadding,
            paddingTop: 12,
            paddingBottom: insets.bottom + 12,
            borderTopWidth: 1,
            borderTopColor: c.line,
            backgroundColor: c.bg,
          }}
        >
          <Button
            label={t('matches.propose')}
            icon="swap"
            onPress={() =>
              router.push({
                pathname: '/chat/[id]',
                params: { id: 'new', to: m.user_id, propose: '1' },
              })
            }
          />
        </View>
      ) : null}
    </View>
  );
}
