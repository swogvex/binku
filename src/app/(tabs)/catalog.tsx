import { t } from '@/i18n';
import { TabScreen } from '@/ui/TabScreen';
import { Txt } from '@/ui/Txt';

export default function Screen() {
  return (
    <TabScreen>
      <Txt variant="display" size={40} accessibilityRole="header">
        {t('dock.catalog')}
      </Txt>
    </TabScreen>
  );
}
