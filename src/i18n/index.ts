import { getLocales } from 'expo-localization';

import en from './en.json';
import es from './es.json';

type Plural = { one: string; other: string };
type Dict = typeof es;
type Keys<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string | Plural ? `${P}${K}` : Keys<T[K], `${P}${K}.`>;
}[keyof T & string];
export type TKey = Keys<Dict>;

export const locale = getLocales()[0]?.languageCode === 'es' ? 'es' : 'en';

// Typed as Dict so a key missing in en.json fails typecheck.
const dicts: Record<'es' | 'en', Dict> = { es, en };

export function translate(
  lang: 'es' | 'en',
  key: TKey,
  params: Record<string, string | number> = {},
): string {
  const node = key
    .split('.')
    .reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], dicts[lang]);
  // shortcut: n === 1 is the CLDR "one" rule for es and en only; use Intl.PluralRules when adding a language.
  const text =
    typeof node === 'string' ? node : (node as Plural)[params.count === 1 ? 'one' : 'other'];
  return text.replace(/\{(\w+)\}/g, (m, p: string) => (p in params ? String(params[p]) : m));
}

export const t = (key: TKey, params?: Record<string, string | number>) =>
  translate(locale, key, params);
