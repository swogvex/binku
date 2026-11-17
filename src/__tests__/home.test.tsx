import { render, screen } from '@testing-library/react-native';

import Home from '@/app/index';

test('shows the app name as a header', async () => {
  await render(<Home />);
  expect(screen.getByRole('header', { name: 'Binku' })).toBeTruthy();
});
