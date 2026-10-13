import { useCallback } from 'react';

import { useTortiePrefs } from '@/tortie/prefs-store';

import {
  resolveAppLanguage,
  type AppLanguageCode,
  type AppLanguagePref,
} from './languages';
import { MESSAGES, type MessageKey } from './messages';

export type { MessageKey };

export type TranslateParams = Record<string, string | number>;

/** Looks `key` up in `language`, falling back to English, and fills `{name}` placeholders. */
export function translate(
  language: AppLanguageCode,
  key: MessageKey,
  params?: TranslateParams,
): string {
  const template = MESSAGES[language][key] ?? MESSAGES.en[key];
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

export function useAppLanguage(): AppLanguageCode {
  const pref = useTortiePrefs((s) => s.appLanguage);
  return resolveAppLanguage(pref as AppLanguagePref);
}

/** `t('tab.today')` in the language the user picked for the app. */
export function useT(): (key: MessageKey, params?: TranslateParams) => string {
  const language = useAppLanguage();
  return useCallback(
    (key: MessageKey, params?: TranslateParams) =>
      translate(language, key, params),
    [language],
  );
}
