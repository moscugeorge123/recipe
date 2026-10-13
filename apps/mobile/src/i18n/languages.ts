/**
 * Languages the app can show its interface in, and that recipes can be read in.
 * Recipes are translated by the API with AI, so the recipe list may grow beyond the
 * languages the interface itself is translated into.
 */
export const APP_LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'ro', name: 'Română' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
] as const;

export type AppLanguageCode = (typeof APP_LANGUAGES)[number]['code'];

export const RECIPE_LANGUAGES = [
  ...APP_LANGUAGES,
  { code: 'it', name: 'Italiano' },
  { code: 'pt', name: 'Português' },
  { code: 'nl', name: 'Nederlands' },
  { code: 'pl', name: 'Polski' },
  { code: 'hu', name: 'Magyar' },
  { code: 'tr', name: 'Türkçe' },
] as const;

export type RecipeLanguageCode = (typeof RECIPE_LANGUAGES)[number]['code'];

/** `'system'` follows the device; `'original'` shows each recipe as it was saved. */
export type AppLanguagePref = 'system' | AppLanguageCode;
export type RecipeLanguagePref = 'original' | RecipeLanguageCode;

export const DEFAULT_APP_LANGUAGE: AppLanguageCode = 'en';

export function isAppLanguage(code: string): code is AppLanguageCode {
  return APP_LANGUAGES.some((language) => language.code === code);
}

export function recipeLanguageName(code: string): string {
  return (
    RECIPE_LANGUAGES.find((language) => language.code === code)?.name ?? code
  );
}

/** Device locale as a bare language code ("ro-RO" → "ro"), or undefined when unknown. */
export function deviceLanguage(): string | undefined {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale;
    return locale.toLowerCase().split(/[-_]/)[0] || undefined;
  } catch {
    return undefined;
  }
}

export function resolveAppLanguage(pref: AppLanguagePref): AppLanguageCode {
  if (pref !== 'system') return pref;
  const device = deviceLanguage();
  return device && isAppLanguage(device) ? device : DEFAULT_APP_LANGUAGE;
}
