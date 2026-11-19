// Shown while there is no account (Profile, Settings): the app is a demo whose collection is
// erased when the app closes. Invites to create an account or sign in (two separate actions).
import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { t } from '@/i18n';
import { era, radius } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { Button } from '@/ui/Button';
import { Txt } from '@/ui/Txt';

export function DemoNotice() {
  const c = useTheme();
  const router = useRouter();
  return (
    <View
      style={{
        gap: 14,
        padding: 16,
        borderRadius: radius.card,
        backgroundColor: c.surface,
        borderWidth: 1,
        borderColor: c.line,
        // Mango edge: the same "heads-up" colour as the offline banner.
        borderLeftWidth: 5,
        borderLeftColor: era.mango,
      }}
    >
      <View accessible style={{ gap: 6 }}>
        <Txt variant="title" size={17} accessibilityRole="header">
          {t('demo.title')}
        </Txt>
        <Txt size={15} muted>
          {t('demo.body')}
        </Txt>
      </View>
      <View style={{ gap: 10 }}>
        <Button label={t('auth.profile.signUp')} onPress={() => router.push('/sign-in')} />
        <Button
          variant="ghost"
          label={t('auth.profile.signIn')}
          onPress={() => router.push({ pathname: '/sign-in', params: { intent: 'signIn' } })}
        />
      </View>
    </View>
  );
}
