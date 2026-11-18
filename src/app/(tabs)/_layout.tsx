import { useRouter } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';

import { openScan, tipsSeen } from '@/features/scan/scan';
import { Dock } from '@/ui/Dock';
import { DockProvider } from '@/ui/dockVisibility';

export default function TabsLayout() {
  const router = useRouter();
  return (
    <DockProvider>
      <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <Dock {...props} />}>
        <Tabs.Screen name="index" />
        <Tabs.Screen name="catalog" />
        <Tabs.Screen
          name="scan"
          listeners={{
            // Tips only before the first scan; then Escanear goes straight to the scanner.
            tabPress: (e) => {
              if (!tipsSeen()) return;
              e.preventDefault();
              openScan(router, 'camera');
            },
          }}
        />
        <Tabs.Screen name="binder" />
        <Tabs.Screen name="profile" />
      </Tabs>
    </DockProvider>
  );
}
