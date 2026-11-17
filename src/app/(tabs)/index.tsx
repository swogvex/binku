import { TabScreen } from '@/ui/TabScreen';
import { Txt } from '@/ui/Txt';

export default function Home() {
  return (
    <TabScreen>
      <Txt variant="display" size={46} accessibilityRole="header">
        Binku
      </Txt>
    </TabScreen>
  );
}
