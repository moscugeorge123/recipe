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
});
