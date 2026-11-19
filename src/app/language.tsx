// "Idioma de la app" sheet: Español or English (until chosen, the phone's language applies). Applies at once and is
// remembered on this phone (kv `lang`).
import { useRouter } from 'expo-router';
import { useSyncExternalStore } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { getDb, setKv } from '@/data/db';
import { chooseLanguage, languageChoice, locale, t, type Lang } from '@/i18n';
import { haptics } from '@/lib/haptics';
import { radius, screenPadding } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { Icon } from '@/ui/icons/Icon';
import { Txt } from '@/ui/Txt';

// Native names: someone lost in a language they don't read can still find their own.
const OPTIONS: { lang: Lang; label: () => string }[] = [
  { lang: 'es', label: () => 'Español' },
  { lang: 'en', label: () => 'English' },
];

export default function LanguageSheet() {
  const c = useTheme();
  const router = useRouter();
  const chosen = useSyncExternalStore(languageChoice.subscribe, languageChoice.get);

  const pick = (lang: Lang) => {
    haptics.selection();
    setKv(getDb(), 'lang', lang);
    router.back();
    chooseLanguage(lang);
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.surface }}
      contentContainerStyle={{ padding: screenPadding, paddingTop: 28, gap: 18 }}
    >
      <Txt variant="title" size={22} accessibilityRole="header">
        {t('settings.languageTitle')}
      </Txt>
      <View
        accessibilityRole="radiogroup"
        style={{
          borderRadius: radius.card,
          borderWidth: 1,
          borderColor: c.line,
          overflow: 'hidden',
        }}
      >
        {OPTIONS.map((o, i) => {
          const selected = o.lang === (chosen ?? locale);
          return (
            <Pressable
              key={o.lang}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              onPress={() => pick(o.lang)}
              style={({ pressed }) => ({
                minHeight: 56,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                paddingHorizontal: 16,
                borderTopWidth: i ? 1 : 0,
                borderTopColor: c.line,
                backgroundColor: selected || pressed ? c.surface2 : c.bg,
              })}
            >
              <Txt variant={selected ? 'title' : 'body'} size={17} style={{ flex: 1 }}>
                {o.label()}
              </Txt>
              {selected ? <Icon name="check" size={20} strokeWidth={2.4} /> : null}
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}
