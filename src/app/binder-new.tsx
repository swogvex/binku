// "Nuevo binder" sheet: pick a group, then the whole group, one member or one album/era.
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { createBinder, type BinderKind } from '@/data/binders';
import { getDb } from '@/data/db';
import { selectBinder } from '@/features/binder/useBinder';
import { useCatalogData } from '@/features/catalog/useCatalog';
import { t } from '@/i18n';
import { screenPadding } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { Button } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { Txt } from '@/ui/Txt';

type Pick = { kind: BinderKind; id?: string; name?: string };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <Txt variant="label" accessibilityRole="header">
        {title}
      </Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{children}</View>
    </View>
  );
}

const unique = (pairs: [string, string][]) =>
  [...new Map(pairs)].map(([id, name]) => ({ id, name }));

export default function BinderNew() {
  const c = useTheme();
  const router = useRouter();
  const { cards } = useCatalogData();
  const [groupId, setGroupId] = useState<string>();
  const [pick, setPick] = useState<Pick>({ kind: 'group' });

  const groups = unique(cards.map((x) => [x.groupId, x.groupName]));
  const inGroup = cards.filter((x) => x.groupId === groupId);
  const members = unique(inGroup.map((x) => [x.memberId, x.memberName]));
  const releases = unique(inGroup.map((x) => [x.releaseId, x.releaseTitle]));
  const group = groups.find((g) => g.id === groupId);

  const create = () => {
    if (!group) return;
    const db = getDb();
    const id = createBinder(db, {
      title: pick.name ? `${group.name} ${pick.name}` : group.name,
      kind: pick.kind,
      filter: {
        group: group.id,
        ...(pick.kind === 'member' && { member: pick.id }),
        ...(pick.kind === 'era' && { release: pick.id }),
      },
    });
    selectBinder(id);
    router.back();
  };

  const choice = (p: Pick, label: string) => (
    <Chip
      key={`${p.kind}-${p.id ?? ''}`}
      label={label}
      selected={pick.kind === p.kind && pick.id === p.id}
      onPress={() => setPick(p)}
    />
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.surface }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: screenPadding, paddingTop: 28, gap: 18 }}
      >
        {/* Action beside the title: Android sheets lay out at full height, so a footer would
            sit below the fold at the half-height detent. */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Txt variant="title" size={22} accessibilityRole="header" style={{ flex: 1 }}>
            {t('binder.create.title')}
          </Txt>
          <Button compact label={t('binder.create.submit')} disabled={!group} onPress={create} />
        </View>
        <Section title={t('binder.create.group')}>
          {groups.map((g) => (
            <Chip
              key={g.id}
              label={g.name}
              selected={g.id === groupId}
              onPress={() => {
                setGroupId(g.id);
                setPick({ kind: 'group' });
              }}
            />
          ))}
        </Section>
        {group ? (
          <>
            <Section title={t('binder.create.what')}>
              {choice({ kind: 'group' }, t('binder.create.all'))}
            </Section>
            <Section title={t('binder.create.member')}>
              {members.map((m) => choice({ kind: 'member', id: m.id, name: m.name }, m.name))}
            </Section>
            <Section title={t('binder.create.era')}>
              {releases.map((r) => choice({ kind: 'era', id: r.id, name: r.name }, r.name))}
            </Section>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}
