import { useRouter } from 'expo-router';

import { t } from '@/i18n';
import { Button } from '@/ui/Button';
import { TabScreen } from '@/ui/TabScreen';
import { Txt } from '@/ui/Txt';

export default function Profile() {
  // Hook, not the global `router`: the global one is unbound while Android recreates the activity (e.g. font scale change).
  const router = useRouter();
  return (
    <TabScreen>
      <Txt variant="display" size={40} accessibilityRole="header">
        {t('dock.profile')}
      </Txt>
      {__DEV__ ? (
        <Button variant="ghost" label="Component gallery" onPress={() => router.push('/gallery')} />
      ) : null}
    </TabScreen>
  );
}
