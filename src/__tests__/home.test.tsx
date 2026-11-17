import { render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import Home from '@/app/(tabs)/index';

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

test('shows the app name as a header', async () => {
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <Home />
    </SafeAreaProvider>,
  );
  expect(screen.getByRole('header', { name: 'Binku' })).toBeTruthy();
});
