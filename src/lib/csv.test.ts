import { toCsv } from './csv';

test('quotes cells with commas, quotes or line breaks and keeps plain ones as they are', () => {
  expect(
    toCsv([
      ['group', 'member'],
      ['NOVA', 'Hana, "HN"'],
      ['A\nB', null],
    ]),
  ).toBe('group,member\r\nNOVA,"Hana, ""HN"""\r\n"A\nB",');
});

test('defuses text that a spreadsheet would run as a formula', () => {
  expect(toCsv([['=HYPERLINK("x")', '+1', '-2', '@me', 'ok']])).toBe(
    `"'=HYPERLINK(""x"")",'+1,'-2,'@me,ok`,
  );
});
