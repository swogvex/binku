// Account from the Profile tab (people who chose "Explorar sin cuenta" first).
// `?resume=1` finishes an account whose set-up was interrupted (offline, app closed).
import { useLocalSearchParams, useRouter } from 'expo-router';
import { KeyboardAvoidingView, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAccountFlow } from '@/features/auth/useAccountFlow';
import { t } from '@/i18n';
import { screenPadding } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { BinkuMark } from '@/ui/BinkuMark';
import { RoundButton } from '@/ui/RoundButton';

export default function SignIn() {
  const c = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { resume } = useLocalSearchParams<{ resume?: string }>();
  const flow = useAccountFlow({ start: resume ? 'finish' : 'email', onDone: () => router.back() });

  return (
    <KeyboardAvoidingView
      behavior="padding"
      style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top + 8 }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingHorizontal: screenPadding,
          minHeight: 48,
        }}
      >
        <RoundButton
          icon="chevronLeft"
          label={t('auth.close')}
          onPress={() => flow.back() || router.back()}
        />
        <BinkuMark />
      </View>
      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: screenPadding, paddingBottom: 24 }}
      >
        {flow.body}
      </ScrollView>
      <View
        style={{
          paddingHorizontal: screenPadding,
          paddingBottom: insets.bottom + 12,
          paddingTop: 8,
        }}
      >
        {flow.action}
      </View>
    </KeyboardAvoidingView>
  );
}
