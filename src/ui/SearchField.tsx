import { Pressable, TextInput, View } from 'react-native';

import { t } from '@/i18n';
import { fonts, radius } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import { Icon } from './icons/Icon';

type Props = {
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  /** Spoken label when it says more than the placeholder (e.g. what is being searched). */
  accessibilityLabel?: string;
};

/** Search input with a magnifier and a clear button (catalog, onboarding lists). */
export function SearchField({ value, onChangeText, placeholder, accessibilityLabel }: Props) {
  const c = useTheme();
  return (
    <View
      style={{
        height: 50,
        borderRadius: radius.control,
        backgroundColor: c.surface,
        borderWidth: 1.5,
        borderColor: c.line,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingLeft: 14,
      }}
    >
      <Icon name="search" size={20} color={c.muted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={c.muted}
        accessibilityLabel={accessibilityLabel ?? placeholder}
        returnKeyType="search"
        autoCorrect={false}
        style={{ flex: 1, height: '100%', fontFamily: fonts.text400, fontSize: 15, color: c.ink }}
      />
      {value ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('catalog.clearSearch')}
          onPress={() => onChangeText('')}
          style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}
        >
          <Icon name="close" size={18} color={c.muted} />
        </Pressable>
      ) : null}
    </View>
  );
}
