// Binder options sheet: rename, 3×3 / 2×2 pages, delete. Public/share arrive with public binders.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, TextInput, View } from 'react-native';

import { deleteBinder, listBinders, updateBinder, type Layout } from '@/data/binders';
import { getDb } from '@/data/db';
import { t } from '@/i18n';
import { fonts, radius, screenPadding } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { Button } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { Txt } from '@/ui/Txt';

export default function BinderOptions() {
  const c = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = getDb();
  const [binder] = useState(() => listBinders(db).find((b) => b.id === id));
  const [title, setTitle] = useState(binder?.title ?? '');
  const [layout, setLayout] = useState<Layout>(binder?.layout ?? '3x3');
  if (!binder) return null;

  const confirmDelete = () =>
    Alert.alert(t('binder.options.confirmTitle'), t('binder.options.confirmBody'), [
      { text: t('binder.options.cancel'), style: 'cancel' },
      {
        text: t('binder.options.delete'),
        style: 'destructive',
        onPress: () => {
          deleteBinder(db, binder.id);
          router.back();
        },
      },
    ]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.surface }}
      contentContainerStyle={{ padding: screenPadding, paddingTop: 28, gap: 18 }}
      keyboardShouldPersistTaps="handled"
    >
      <Txt variant="title" size={22} accessibilityRole="header">
        {t('binder.options.title')}
      </Txt>

      <View style={{ gap: 8 }}>
        <Txt variant="label">{t('binder.options.name')}</Txt>
        <TextInput
          value={title}
          onChangeText={setTitle}
          accessibilityLabel={t('binder.options.name')}
          maxLength={40}
          style={{
            height: 50,
            borderRadius: radius.control,
            borderWidth: 1.5,
            borderColor: c.line,
            backgroundColor: c.bg,
            paddingHorizontal: 14,
            fontFamily: fonts.text400,
            fontSize: 15,
            color: c.ink,
          }}
        />
        <Button
          variant="ghost"
          compact
          label={t('binder.options.save')}
          disabled={!title.trim() || title.trim() === binder.title}
          onPress={() => {
            updateBinder(db, binder.id, { title: title.trim() });
            router.back();
          }}
        />
      </View>

      <View style={{ gap: 8 }}>
        <Txt variant="label">{t('binder.options.layout')}</Txt>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {(['3x3', '2x2'] as const).map((l) => (
            <Chip
              key={l}
              label={l.replace('x', '×')}
              selected={layout === l}
              onPress={() => {
                setLayout(l);
                updateBinder(db, binder.id, { layout: l });
              }}
            />
          ))}
        </View>
      </View>

      <Button variant="danger" label={t('binder.options.delete')} onPress={confirmDelete} />
    </ScrollView>
  );
}
