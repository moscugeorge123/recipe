import { resolveAppLanguage } from '@/i18n/languages';
import { MESSAGES } from '@/i18n/messages';
import { translate } from '@/i18n';

describe('i18n', () => {
  it('has every English key in every language', () => {
    const keys = Object.keys(MESSAGES.en);
    for (const [language, messages] of Object.entries(MESSAGES)) {
      expect({ language, keys: Object.keys(messages).sort() }).toEqual({
        language,
        keys: [...keys].sort(),
      });
    }
  });

  it('fills placeholders and keeps the same ones in every language', () => {
    expect(translate('ro', 'recipe.translating', { language: 'Română' })).toBe(
      'Se traduce în Română…',
    );
    for (const messages of Object.values(MESSAGES)) {
      expect(messages['recipe.translating']).toContain('{language}');
      expect(messages['recipe.translated']).toContain('{language}');
    }
  });

  it('uses an explicit app language as is', () => {
    expect(resolveAppLanguage('fr')).toBe('fr');
  });

  it('uses the same {placeholders} for a key in every language', () => {
    const names = (text: string) =>
      (text.match(/\{\w+\}/g) ?? []).sort().join(',');
    for (const key of Object.keys(MESSAGES.en) as Array<
      keyof typeof MESSAGES.en
    >) {
      for (const [language, messages] of Object.entries(MESSAGES)) {
        expect({ key, language, names: names(messages[key]) }).toEqual({
          key,
          language,
          names: names(MESSAGES.en[key]),
        });
      }
    }
  });

  it('translates every key into at least one other language', () => {
    // Same text in every language on purpose: abbreviations, symbols, a placeholder-only line.
    const SAME_EVERYWHERE = new Set([
      'editor.ok',
      'ue.ok',
      'common.emoji',
      'detail.kcal',
      'detail.metaLine',
      'cookbook.sortAz',
    ]);
    const untranslated = (
      Object.keys(MESSAGES.en) as Array<keyof typeof MESSAGES.en>
    ).filter(
      (key) =>
        !SAME_EVERYWHERE.has(key) &&
        (['ro', 'es', 'fr', 'de'] as const).every(
          (language) => MESSAGES[language][key] === MESSAGES.en[key],
        ),
    );
    expect(untranslated).toEqual([]);
  });
});
