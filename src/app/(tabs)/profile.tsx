import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';

import { useSession } from '@/features/auth/useSession';
import { t } from '@/i18n';
import { supabase } from '@/lib/supabase';
import { Button } from '@/ui/Button';
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
      supabase
        .from('profiles')
        .select('username')
        .maybeSingle()
        .then(({ data, error }) => !error && setUsername(data?.username ?? null));
    }, [session]),
  );

  return (
    <TabScreen>
      <Txt variant="display" size={40} accessibilityRole="header">
        {t('dock.profile')}
      </Txt>
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
          {username === null ? (
            <Button
              label={t('auth.username.title')}
              onPress={() => router.push({ pathname: '/sign-in', params: { resume: '1' } })}
            />
          ) : null}
          <Button
            variant="ghost"
            label={t('auth.profile.signOut')}
            onPress={() => supabase.auth.signOut()}
          />
        </>
      ) : null}
      {__DEV__ ? (
        <Button variant="ghost" label="Component gallery" onPress={() => router.push('/gallery')} />
      ) : null}
    </TabScreen>
  );
}
