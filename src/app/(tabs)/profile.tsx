import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { getDb, getKv } from '@/data/db';
import { fetchProfile } from '@/features/auth/account';
import { useSession } from '@/features/auth/useSession';
import { t } from '@/i18n';
import { Button } from '@/ui/Button';
import { RoundButton } from '@/ui/RoundButton';
import { TabScreen } from '@/ui/TabScreen';
import { Txt } from '@/ui/Txt';

export default function Profile() {
  // Hook, not the global `router`: the global one is unbound while Android recreates the activity (e.g. font scale change).
  const router = useRouter();
  const session = useSession();
  // undefined = not loaded (or offline), null = account without @username yet.
  const [username, setUsername] = useState<string | null>();

  useFocusEffect(
    useCallback(() => {
      if (!session) return setUsername(undefined);
      fetchProfile()
        .then((data) => setUsername(data?.username ?? null))
        .catch(() => {}); // offline: keep what is shown
    }, [session]),
  );

  return (
    <TabScreen>
      {/* Gear top-right, as in the canvas profile; sign-out and account data live in Settings. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Txt variant="display" size={40} accessibilityRole="header">
          {t('dock.profile')}
        </Txt>
        <RoundButton
          icon="settings"
          label={t('settings.title')}
          onPress={() => router.push('/settings')}
        />
      </View>
      {session === null ? (
        <>
          <Txt muted>{t('auth.email.body')}</Txt>
          <Button label={t('auth.profile.signIn')} onPress={() => router.push('/sign-in')} />
        </>
      ) : null}
      {session ? (
        <>
          <Txt variant="title" size={22}>
            {username ? `@${username}` : session.user.email}
          </Txt>
          {/* Set-up interrupted (offline, app closed): no @username yet or data not linked. */}
          {username === null || (username && getKv(getDb(), 'sync:user') !== session.user.id) ? (
            <Button
              label={t('auth.profile.finish')}
              onPress={() => router.push({ pathname: '/sign-in', params: { resume: '1' } })}
            />
          ) : null}
        </>
      ) : null}
      {__DEV__ ? (
        <Button variant="ghost" label="Component gallery" onPress={() => router.push('/gallery')} />
      ) : null}
    </TabScreen>
  );
}
