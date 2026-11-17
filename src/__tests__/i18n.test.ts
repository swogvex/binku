import { translate } from '@/i18n';

test('interpolates params', () => {
  expect(translate('es', 'card.photoOf', { member: 'Jiwan' })).toBe('Foto de Jiwan');
});

test('picks plural forms', () => {
  expect(translate('es', 'states.offline.pending', { count: 1 })).toBe(
    '1 foto espera para subirse.',
  );
  expect(translate('es', 'states.offline.pending', { count: 3 })).toBe(
    '3 fotos esperan para subirse.',
  );
  expect(translate('en', 'states.offline.pending', { count: 0 })).toBe(
    '0 photos waiting to upload.',
  );
});
