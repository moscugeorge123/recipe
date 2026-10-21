import type { AppLanguageCode } from './languages';
import de from './locales/de.json';
import en from './locales/en.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import ro from './locales/ro.json';

/**
 * Strings live in `locales/<code>.json`, English is the source of truth. A key
 * missing from another language is a compile error here, and `translate()` also
 * falls back to English at runtime.
 */
export type MessageKey = keyof typeof en;
type Messages = Record<MessageKey, string>;

export const MESSAGES: Record<AppLanguageCode, Messages> = {
  en,
  ro,
  es,
  fr,
  de,
};
