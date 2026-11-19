import { getLocales } from 'expo-localization';

import en from './en.json';
import es from './es.json';

type Plural = { one: string; other: string };
type Dict = typeof es;
type Keys<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string | Plural ? `${P}${K}` : Keys<T[K], `${P}${K}.`>;
}[keyof T & string];
export type TKey = Keys<Dict>;

export type Lang = 'es' | 'en';
export const LANGS: Lang[] = ['es', 'en'];
const pick = (code?: string | null): Lang => (code === 'es' ? 'es' : 'en');

// Language picked inside the app (Settings → Idioma); null = follow the phone.
let chosen: Lang | null = null;
const listeners = new Set<() => void>();
export const languageChoice = {
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  get: () => chosen,
};
export function chooseLanguage(lang: Lang | null) {
  chosen = lang;
  listeners.forEach((fn) => fn());
}

// `let`: follows the in-app choice, else the phone's (per-app) language, while the app runs.
export let locale: Lang = pick(getLocales()[0]?.languageCode);

/** Sets the active language from a language code (es → es, anything else → en). */
export function setLocale(code?: string | null) {
  locale = pick(code);
  return locale;
}

// Typed as Dict so a key missing in en.json fails typecheck.
const dicts: Record<Lang, Dict> = { es, en };

export function translate(
  lang: Lang,
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
