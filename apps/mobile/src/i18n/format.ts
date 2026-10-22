import { useTortiePrefs } from '@/tortie/prefs-store';

import {
  resolveAppLanguage,
  type AppLanguageCode,
  type AppLanguagePref,
} from './languages';
import { MESSAGES, type MessageKey } from './messages';

/**
 * Locale-aware formatting that works outside React (data helpers, toasts).
 * Hand-written tables rather than `Intl`, so output is identical on every
 * device and JS engine. Screens that call these should also subscribe to the
 * language (`useAppLanguage()` / `useT()`) so they re-render when it changes.
 */

/** The app language right now, for code that cannot call a hook. */
export function currentLanguage(): AppLanguageCode {
  return resolveAppLanguage(
    useTortiePrefs.getState().appLanguage as AppLanguagePref,
  );
}

/** `translate` against the current language; see `useT()` for components. */
export function tNow(
  key: MessageKey,
  params?: Record<string, string | number>,
): string {
  const language = currentLanguage();
  const template = MESSAGES[language][key] ?? MESSAGES.en[key];
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

export type PluralForm = 'one' | 'few' | 'other';

/** CLDR cardinal plural category for a whole number. */
export function pluralForm(language: AppLanguageCode, n: number): PluralForm {
  const abs = Math.abs(n);
  switch (language) {
    case 'ro': {
      if (abs === 1) return 'one';
      const mod100 = abs % 100;
      return abs === 0 || (mod100 >= 1 && mod100 <= 19) ? 'few' : 'other';
    }
    case 'fr':
      return abs === 0 || abs === 1 ? 'one' : 'other';
    default:
      return abs === 1 ? 'one' : 'other';
  }
}

/** Nouns that take a count: "3 recipes", "1 receta", "2 rețete". */
export type CountNoun =
  | 'recipe'
  | 'favourite'
  | 'item'
  | 'pack'
  | 'step'
  | 'ingredient'
  | 'meal'
  | 'collection'
  | 'note'
  | 'week'
  | 'day'
  | 'change';

export type PluralKey = `count.${CountNoun}.${PluralForm}`;

/** "{n} recipes" in the given language, with the right plural form. */
export function countIn(
  language: AppLanguageCode,
  n: number,
  noun: CountNoun,
): string {
  const form = pluralForm(language, n);
  const key = `count.${noun}.${form}` as MessageKey;
  const template =
    MESSAGES[language][key] ??
    MESSAGES[language][`count.${noun}.other` as MessageKey];
  return template.replace('{n}', String(n));
}

/** `countIn` for the current app language. */
export function count(n: number, noun: CountNoun): string {
  return countIn(currentLanguage(), n, noun);
}

type Names = readonly string[];

const WEEKDAYS: Record<AppLanguageCode, Names> = {
  en: [
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday',
  ],
  ro: ['Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă', 'Duminică'],
  es: [
    'Lunes',
    'Martes',
    'Miércoles',
    'Jueves',
    'Viernes',
    'Sábado',
    'Domingo',
  ],
  fr: ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'],
  de: [
    'Montag',
    'Dienstag',
    'Mittwoch',
    'Donnerstag',
    'Freitag',
    'Samstag',
    'Sonntag',
  ],
};

const WEEKDAY_LETTERS: Record<AppLanguageCode, Names> = {
  en: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
  ro: ['L', 'M', 'M', 'J', 'V', 'S', 'D'],
  es: ['L', 'M', 'X', 'J', 'V', 'S', 'D'],
  fr: ['L', 'M', 'M', 'J', 'V', 'S', 'D'],
  de: ['M', 'D', 'M', 'D', 'F', 'S', 'S'],
};

const MONTHS_SHORT: Record<AppLanguageCode, Names> = {
  en: [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'June',
    'July',
    'Aug',
    'Sept',
    'Oct',
    'Nov',
    'Dec',
  ],
  ro: [
    'ian.',
    'feb.',
    'mar.',
    'apr.',
    'mai',
    'iun.',
    'iul.',
    'aug.',
    'sept.',
    'oct.',
    'nov.',
    'dec.',
  ],
  es: [
    'ene',
    'feb',
    'mar',
    'abr',
    'may',
    'jun',
    'jul',
    'ago',
    'sept',
    'oct',
    'nov',
    'dic',
  ],
  fr: [
    'janv.',
    'févr.',
    'mars',
    'avr.',
    'mai',
    'juin',
    'juil.',
    'août',
    'sept.',
    'oct.',
    'nov.',
    'déc.',
  ],
  de: [
    'Jan.',
    'Feb.',
    'März',
    'Apr.',
    'Mai',
    'Juni',
    'Juli',
    'Aug.',
    'Sept.',
    'Okt.',
    'Nov.',
    'Dez.',
  ],
};

/**
 * An array-like whose items follow the current app language, so existing
 * `DAYNAMES[i]` / `.map` call sites keep working and pick up a language change.
 */
function followLanguage(
  length: number,
  table: Record<AppLanguageCode, Names>,
): readonly string[] {
  const list: string[] = [];
  for (let i = 0; i < length; i += 1) {
    Object.defineProperty(list, i, {
      enumerable: true,
      get: () => table[currentLanguage()][i] ?? table.en[i] ?? '',
    });
  }
  return list;
}

export const localizedWeekdays = followLanguage(7, WEEKDAYS);
export const localizedWeekdayLetters = followLanguage(7, WEEKDAY_LETTERS);
export const localizedMonths = followLanguage(12, MONTHS_SHORT);

export const weekdayNameIn = (language: AppLanguageCode, i: number): string =>
  WEEKDAYS[language][i] ?? WEEKDAYS.en[i] ?? '';
export const monthNameIn = (language: AppLanguageCode, i: number): string =>
  MONTHS_SHORT[language][i] ?? MONTHS_SHORT.en[i] ?? '';

/** Minutes → "40 min" / "3 h 30" / "3 days"; "—" when unknown (0). */
export function formatDuration(minutes: number): string {
  if (minutes <= 0) return '—';
  if (minutes < 60) return tNow('time.min', { n: minutes });
  if (minutes < 1440) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m ? tNow('time.hoursMin', { h, m }) : tNow('time.hours', { h });
  }
  return count(Math.round(minutes / 1440), 'day');
}

/** Translates a fixed English name (aisle, shelf, ...) stored as data; falls back to the name itself. */
export function tEnum(prefix: string, value: string | undefined): string {
  const messages = MESSAGES[currentLanguage()] as Record<string, string>;
  return (value && messages[`${prefix}.${value}`]) || value || '';
}

/** A copy of `tuple` whose item at `index` is the translation of `key`, looked up on every read. */
export function lazyAt<T extends readonly unknown[]>(
  tuple: T,
  index: number,
  key: MessageKey,
): T {
  const copy = [...tuple] as unknown[];
  Object.defineProperty(copy, index, {
    enumerable: true,
    get: () => tNow(key),
  });
  return copy as unknown as T;
}

/** An array-like of translations (`''` stays empty) that follows the app language. */
export function lazyList(keys: readonly (MessageKey | '')[]): readonly string[] {
  const list: string[] = [];
  keys.forEach((key, i) => {
    Object.defineProperty(list, i, {
      enumerable: true,
      get: () => (key ? tNow(key) : ''),
    });
  });
  return list;
}

/** `[title, subtitle]` that follows the app language. */
export function lazyHeader(
  titleKey: MessageKey,
  subKey: MessageKey,
): readonly [string, string] {
  return lazyAt(lazyAt(['', ''] as const, 0, titleKey), 1, subKey);
}
