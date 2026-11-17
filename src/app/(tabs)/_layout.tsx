import { Tabs } from 'expo-router/js-tabs';

import { Dock, DockProvider } from '@/ui/Dock';

export default function TabsLayout() {
  return (
    <DockProvider>
      <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <Dock {...props} />}>
        <Tabs.Screen name="index" />
        <Tabs.Screen name="catalog" />
        <Tabs.Screen name="scan" />
        <Tabs.Screen name="binder" />
        <Tabs.Screen name="profile" />
      </Tabs>
    </DockProvider>
  );
}
