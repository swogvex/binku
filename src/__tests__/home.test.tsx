import { render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import Home from '@/app/(tabs)/index';

// Signed out, no binders: Home is the demo invitation (matches need an account).
jest.mock('expo-router', () => ({ useRouter: () => ({}), useFocusEffect: () => {} }));
jest.mock('@/features/auth/useSession', () => ({ useSession: () => null }));
jest.mock('@/features/auth/account', () => ({}));
jest.mock('@/features/matches/useMatches', () => ({ useMatches: () => null }));
jest.mock('@/features/catalog/useCatalog', () => ({
  useCatalogData: () => ({ cards: [], marks: new Map() }),
}));
jest.mock('@/data/db', () => ({ getDb: () => ({}) }));
jest.mock('@/data/binders', () => ({ listBinders: () => [] }));
jest.mock('@/features/binder/useBinder', () => ({}));

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

test('without an account Home invites to try the demo', async () => {
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <Home />
    </SafeAreaProvider>,
  );
  expect(screen.getByRole('header', { name: 'Your collection, no account' })).toBeTruthy();
});
