// "Tus grupos" step: group tiles in the card-back motif (group colour + tiny binder pockets +
// monogram) and, for each chosen group, a row of member avatars to pick the bias. The order of
// choice is shown because the first group makes the first binder. No official images or logos.
import { Pressable, ScrollView, View } from 'react-native';
import Svg, { Defs, Pattern, Rect } from 'react-native-svg';

import { fold } from '@/features/catalog/filter';
import { t } from '@/i18n';
import { textOn } from '@/lib/contrast';
import { haptics } from '@/lib/haptics';
import { era, radius, type Era } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { Icon } from '@/ui/icons/Icon';
import { Txt } from '@/ui/Txt';

export type PickGroup = {
  id: string;
  name: string;
  monogram: string;
  color: Era;
  members: { id: string; name: string }[];
};

/** Tiny binder pockets, as on the card backs. */
function Pockets({ color }: { color: string }) {
  return (
    // Fixed size, clipped by the band: percentage sizes left the right edge unpatterned.
    <Svg style={{ position: 'absolute', top: 0, left: 0 }} width={420} height={120}>
      <Defs>
        <Pattern id="pockets" width={14} height={18} patternUnits="userSpaceOnUse">
          <Rect
            x={2}
            y={2}
            width={10}
            height={14}
            rx={2}
            fill="none"
            stroke={color}
            strokeOpacity={0.14}
            strokeWidth={1.2}
          />
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#pockets)" />
    </Svg>
  );
}

function GroupTile(p: { group: PickGroup; order: number; onPress: () => void }) {
  const c = useTheme();
  const bg = era[p.group.color];
  const fg = textOn(bg);
  const selected = p.order > 0;
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={[
        p.group.name,
        t('onboarding.groups.members', { count: p.group.members.length }),
        selected ? t('onboarding.groups.order', { n: p.order }) : '',
      ]
        .filter(Boolean)
        .join(', ')}
      onPress={() => {
        haptics.selection();
        p.onPress();
      }}
      style={({ pressed }) => ({
        width: '48.5%',
        borderRadius: radius.card,
        overflow: 'hidden',
        borderWidth: selected ? 2.5 : 1.5,
        borderColor: selected ? c.ink : c.line,
        backgroundColor: c.surface,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <View
        style={{
          height: 84,
          backgroundColor: bg,
          justifyContent: 'flex-end',
          padding: 12,
          overflow: 'hidden',
        }}
      >
        <Pockets color={fg} />
        {/* A badge graphic: it keeps its size so the letters always fit the band. */}
        <Txt variant="display" size={34} color={fg} allowFontScaling={false}>
          {p.group.monogram}
        </Txt>
        {selected ? (
          <View
            style={{
              position: 'absolute',
              top: 10,
              right: 10,
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: c.ink,
              borderWidth: 2,
              borderColor: c.onInk,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Txt variant="label" size={13} color={c.onInk} allowFontScaling={false}>
              {String(p.order)}
            </Txt>
          </View>
        ) : null}
      </View>
      <View style={{ padding: 12, gap: 2, flexGrow: 1 }}>
        {/* Long names (e.g. "TOMORROW X TOGETHER") wrap to two lines. */}
        <Txt variant="title" size={15} numberOfLines={2} maxFontSizeMultiplier={1.5}>
          {p.group.name}
        </Txt>
        <Txt size={12} muted maxFontSizeMultiplier={1.5}>
          {t('onboarding.groups.members', { count: p.group.members.length })}
        </Txt>
      </View>
    </Pressable>
  );
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2);

/** One member avatar (initials, never a photo): ink ring + heart when it is the bias. */
function Avatar(p: {
  label: string;
  inner: string;
  color: Era;
  selected: boolean;
  a11y: string;
  onPress: () => void;
}) {
  const c = useTheme();
  const bg = era[p.color];
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: p.selected }}
      accessibilityLabel={p.a11y}
      onPress={() => {
        haptics.selection();
        p.onPress();
      }}
      style={{ width: 72, alignItems: 'center', gap: 6 }}
    >
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          padding: 3,
          borderWidth: 2.5,
          borderColor: p.selected ? c.ink : 'transparent',
        }}
      >
        <View
          style={{
            flex: 1,
            borderRadius: 29,
            backgroundColor: p.selected ? bg : c.surface2,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Txt
            variant="display"
            size={22}
            color={p.selected ? textOn(bg) : c.ink}
            allowFontScaling={false}
          >
            {p.inner}
          </Txt>
        </View>
        {p.selected ? (
          <View
            style={{
              position: 'absolute',
              right: -4,
              bottom: -4,
              width: 24,
              height: 24,
              borderRadius: 12,
              backgroundColor: c.ink,
              borderWidth: 2,
              borderColor: c.surface,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="heart" size={13} color={c.onInk} strokeWidth={2.4} />
          </View>
        ) : null}
      </View>
      <Txt
        variant={p.selected ? 'title' : 'body'}
        size={12}
        numberOfLines={1}
        maxFontSizeMultiplier={1.3}
        style={{ maxWidth: 72, textAlign: 'center' }}
      >
        {p.label}
      </Txt>
    </Pressable>
  );
}

function BiasRow(p: { group: PickGroup; bias: string; onBias: (id: string) => void }) {
  const c = useTheme();
  const all = `OT${p.group.members.length}`;
  return (
    <View
      style={{
        gap: 12,
        paddingVertical: 14,
        borderRadius: radius.card,
        backgroundColor: c.surface,
        borderWidth: 1,
        borderColor: c.line,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 }}>
        <View
          style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: era[p.group.color] }}
        />
        <Txt variant="title" size={15} accessibilityRole="header" style={{ flex: 1 }}>
          {t('onboarding.groups.bias', { group: p.group.name })}
        </Txt>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        accessibilityRole="radiogroup"
        contentContainerStyle={{ paddingHorizontal: 10, gap: 4 }}
      >
        {/* "OT7" = all seven members: how fans say they love the whole group. */}
        <Avatar
          label={t('onboarding.groups.all')}
          inner={all}
          color={p.group.color}
          selected={p.bias === 'all'}
          a11y={`${t('onboarding.groups.all')} (${all})`}
          onPress={() => p.onBias('all')}
        />
        {p.group.members.map((m) => (
          <Avatar
            key={m.id}
            label={m.name}
            inner={initials(m.name)}
            color={p.group.color}
            selected={p.bias === m.id}
            a11y={m.name}
            onPress={() => p.onBias(m.id)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

type Props = {
  groups: PickGroup[];
  /** Search text: filters the tiles; chosen groups keep their bias row. */
  query: string;
  chosen: string[];
  bias: Record<string, string>;
  onToggle: (id: string) => void;
  onBias: (groupId: string, memberId: string) => void;
};

export function GroupPicker(p: Props) {
  return (
    <View style={{ gap: 24 }}>
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          rowGap: 12,
        }}
      >
        {p.groups
          .filter((g) => fold(g.name).includes(fold(p.query.trim())))
          .map((g) => (
            <GroupTile
              key={g.id}
              group={g}
              order={p.chosen.indexOf(g.id) + 1}
              onPress={() => p.onToggle(g.id)}
            />
          ))}
      </View>
      {p.chosen.length ? (
        <View style={{ gap: 12 }}>
          {p.chosen.map((gid) => {
            const g = p.groups.find((x) => x.id === gid) ?? null;
            return g ? (
              <BiasRow
                key={gid}
                group={g}
                bias={p.bias[gid] ?? 'all'}
                onBias={(m) => p.onBias(gid, m)}
              />
            ) : null;
          })}
        </View>
      ) : null}
    </View>
  );
}
