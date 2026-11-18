// Catalog filters sheet (native sheet via `sheetOptions`): type + own state.
import { useRouter } from 'expo-router';
import { View } from 'react-native';

import type { CardType } from '@/data/catalogFile';
import type { OwnState } from '@/features/catalog/filter';
import { setFilter, useFilteredCards } from '@/features/catalog/useCatalog';
import { t } from '@/i18n';
import { screenPadding } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { Button } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { Txt } from '@/ui/Txt';

const TYPES: CardType[] = ['album', 'pob', 'lucky_draw', 'event', 'season_greetings', 'other'];
const STATES: OwnState[] = ['missing', 'have', 'dupe'];

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <Txt variant="label" accessibilityRole="header">
        {title}
      </Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{children}</View>
    </View>
  );
}

export default function CatalogFilters() {
  const c = useTheme();
  const router = useRouter();
  const { filter, results } = useFilteredCards();

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: c.surface,
        padding: screenPadding,
        paddingTop: 28,
        gap: 18,
      }}
    >
      <Txt variant="title" size={22} accessibilityRole="header">
        {t('catalog.sheet.title')}
      </Txt>
      <Group title={t('catalog.sheet.type')}>
        {TYPES.map((type) => (
          <Chip
            key={type}
            label={t(`catalog.type.${type}`)}
            selected={filter.type === type}
            onPress={() => setFilter({ type: filter.type === type ? null : type })}
          />
        ))}
      </Group>
      <Group title={t('catalog.sheet.state')}>
        {STATES.map((state) => (
          <Chip
            key={state}
            label={t(`catalog.sheet.${state}`)}
            selected={filter.state === state}
            onPress={() => setFilter({ state: filter.state === state ? null : state })}
          />
        ))}
      </Group>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button
          variant="ghost"
          label={t('catalog.sheet.clear')}
          onPress={() => setFilter({ type: null, state: null })}
        />
        <Button
          style={{ flex: 1 }}
          label={t('catalog.sheet.show', { count: results.length })}
          onPress={() => router.back()}
        />
      </View>
    </View>
  );
}
