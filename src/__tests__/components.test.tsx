import { fireEvent, render, screen } from '@testing-library/react-native';

import { CardMarker } from '@/ui/CardMarker';
import { Chip } from '@/ui/Chip';
import { Pocket } from '@/ui/Pocket';

test('CardMarker describes the card and its state for screen readers', async () => {
  await render(
    <CardMarker
      member="Jiwan"
      album="Paper Moon"
      version="Ver. A"
      format="pob"
      eraColor="cobalt"
      state={{ kind: 'dupe', count: 2 }}
    />,
  );
  expect(screen.getByLabelText(/Jiwan, Paper Moon, .*POB, .*2/)).toBeTruthy();
});

test('empty Pocket tells which member is missing', async () => {
  await render(<Pocket member="Seora" />);
  expect(screen.getByLabelText(/Seora/)).toBeTruthy();
});

test('Chip exposes selection and handles press', async () => {
  const onPress = jest.fn();
  await render(<Chip label="NEVIRA" selected onPress={onPress} />);
  const chip = screen.getByRole('button', { name: 'NEVIRA', selected: true });
  fireEvent.press(chip);
  expect(onPress).toHaveBeenCalled();
});
