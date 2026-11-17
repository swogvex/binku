import { router } from 'expo-router';

import { t } from '@/i18n';
import { Button } from '@/ui/Button';
import { TabScreen } from '@/ui/TabScreen';
import { Txt } from '@/ui/Txt';

export default function Profile() {
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
