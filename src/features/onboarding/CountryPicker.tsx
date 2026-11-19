// Country field for the "¿Dónde vives?" step. One row with the flag and the chosen country; tapping
// it opens a searchable list in a sheet, so the step stays clean however many countries launch
// (25-international: more countries are added over time).
import { useState } from 'react';
import { FlatList, Modal, Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fold } from '@/features/catalog/filter';
import { t } from '@/i18n';
import { haptics } from '@/lib/haptics';
import { radius, screenPadding } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { Icon } from '@/ui/icons/Icon';
import { RoundButton } from '@/ui/RoundButton';
import { SearchField } from '@/ui/SearchField';
import { Txt } from '@/ui/Txt';

/** ISO 3166-1 alpha-2 → flag emoji (regional indicator letters; every OS font draws them). */
export const flag = (code: string) =>
  String.fromCodePoint(...[...code.toUpperCase()].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65));

type Props<C extends string> = {
  countries: readonly C[];
  value: C;
  /** Shown first in the list (the phone's region). */
  suggested: C;
  name: (code: C) => string;
  onChange: (code: C) => void;
};

function Check({ selected }: { selected: boolean }) {
  const c = useTheme();
  return (
    <View
      style={{
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: selected ? 0 : 1.5,
        borderColor: c.line,
        backgroundColor: selected ? c.ink : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {selected ? <Icon name="check" size={14} color={c.onInk} strokeWidth={2.4} /> : null}
    </View>
  );
}

export function CountryPicker<C extends string>(p: Props<C>) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const q = fold(query.trim());
  const sorted = [...p.countries].sort((a, b) =>
    a === p.suggested ? -1 : b === p.suggested ? 1 : p.name(a).localeCompare(p.name(b)),
  );
  const results = q ? sorted.filter((code) => fold(p.name(code)).includes(q)) : sorted;

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t('onboarding.place.country')}: ${p.name(p.value)}`}
        accessibilityHint={t('onboarding.place.change')}
        onPress={() => setOpen(true)}
        style={({ pressed }) => ({
          minHeight: 64,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
          paddingHorizontal: 16,
          paddingVertical: 10,
          borderRadius: radius.card,
          backgroundColor: pressed ? c.surface2 : c.surface,
          borderWidth: 1.5,
          borderColor: c.ink,
        })}
      >
        <Txt size={28} allowFontScaling={false} style={{ lineHeight: 34 }}>
          {flag(p.value)}
        </Txt>
        <Txt variant="title" size={17} style={{ flex: 1 }}>
          {p.name(p.value)}
        </Txt>
        <Txt variant="label" size={13} muted>
          {t('onboarding.place.changeShort')}
        </Txt>
        <Icon name="chevronRight" size={18} color={c.muted} />
      </Pressable>

      <Modal
        visible={open}
        animationType="slide"
        // iOS: native card sheet with swipe-down; Android: full screen with the back button.
        presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
        onRequestClose={close}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: c.bg,
            paddingTop: Platform.OS === 'ios' ? 16 : insets.top + 8,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              paddingHorizontal: screenPadding,
            }}
          >
            <Txt variant="display" size={28} accessibilityRole="header" style={{ flex: 1 }}>
              {t('onboarding.place.pickCountry')}
            </Txt>
            <RoundButton icon="close" label={t('onboarding.place.close')} onPress={close} />
          </View>
          <View style={{ paddingHorizontal: screenPadding, paddingTop: 16, paddingBottom: 8 }}>
            <SearchField
              value={query}
              onChangeText={setQuery}
              placeholder={t('onboarding.place.searchCountry')}
            />
          </View>
          <FlatList
            data={results}
            keyExtractor={(code) => code}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              paddingHorizontal: screenPadding,
              paddingBottom: insets.bottom + 24,
            }}
            ListEmptyComponent={
              <Txt muted style={{ padding: 24, textAlign: 'center' }}>
                {t('onboarding.place.none')}
              </Txt>
            }
            renderItem={({ item: code }) => {
              const selected = code === p.value;
              return (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  accessibilityLabel={p.name(code)}
                  onPress={() => {
                    haptics.selection();
                    p.onChange(code);
                    close();
                  }}
                  style={({ pressed }) => ({
                    minHeight: 56,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 14,
                    paddingHorizontal: 12,
                    borderRadius: radius.control,
                    backgroundColor: selected || pressed ? c.surface2 : 'transparent',
                  })}
                >
                  <Txt size={28} allowFontScaling={false} style={{ fontSize: 24, lineHeight: 30 }}>
                    {flag(code)}
                  </Txt>
                  <View style={{ flex: 1 }}>
                    <Txt variant={selected ? 'title' : 'body'} size={17}>
                      {p.name(code)}
                    </Txt>
                    {code === p.suggested && !q ? (
                      <Txt size={12} muted>
                        {t('onboarding.place.suggested')}
                      </Txt>
                    ) : null}
                  </View>
                  <Check selected={selected} />
                </Pressable>
              );
            }}
          />
        </View>
      </Modal>
    </>
  );
}
