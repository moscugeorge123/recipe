import { count, countIn, pluralForm, weekdayNameIn } from '@/i18n/format';
import { MESSAGES } from '@/i18n/messages';
import { useTortiePrefs } from '@/tortie/prefs-store';
import { DAYNAMES, fmtT, plz, todayLine } from '@/tortie/lib/fmt';

describe('plural forms', () => {
  it('uses one/other in English', () => {
    expect([0, 1, 2].map((n) => pluralForm('en', n))).toEqual([
      'other',
      'one',
      'other',
    ]);
  });

  it('uses one/few/other in Romanian', () => {
    expect(
      [1, 2, 19, 20, 100, 101, 119, 120].map((n) => pluralForm('ro', n)),
    ).toEqual(['one', 'few', 'few', 'other', 'other', 'few', 'few', 'other']);
    expect(countIn('ro', 1, 'recipe')).toBe('1 rețetă');
    expect(countIn('ro', 2, 'recipe')).toBe('2 rețete');
    expect(countIn('ro', 20, 'recipe')).toBe('20 de rețete');
    expect(countIn('ro', 100, 'recipe')).toBe('100 de rețete');
  });

  it('treats 0 as singular in French', () => {
    expect(countIn('fr', 0, 'recipe')).toBe('0 recette');
  });
});

describe('placeholders in count and time keys', () => {
  it('keeps {n} in every plural form of every language', () => {
    for (const messages of Object.values(MESSAGES)) {
      for (const [key, value] of Object.entries(messages)) {
        if (key.startsWith('count.')) expect(value).toContain('{n}');
      }
    }
  });
});

describe('follows the app language', () => {
  afterEach(() => useTortiePrefs.getState().set({ appLanguage: 'en' }));

  it('defaults to English', () => {
    useTortiePrefs.getState().set({ appLanguage: 'en' });
    expect(plz(1, 'recipe')).toBe('1 recipe');
    expect(plz(3, 'recipe')).toBe('3 recipes');
    expect(DAYNAMES[0]).toBe('Monday');
    expect(fmtT(45)).toBe('45 min');
    expect(fmtT(90)).toBe('1 h 30');
    expect(fmtT(0)).toBe('—');
  });

  it('switches weekday names, counts and durations to Romanian', () => {
    useTortiePrefs.getState().set({ appLanguage: 'ro' });
    expect(DAYNAMES[0]).toBe('Luni');
    expect(DAYNAMES.map((d) => d)).toHaveLength(7);
    expect(count(25, 'step')).toBe('25 de pași');
    expect(fmtT(3 * 1440)).toBe('3 zile');
    expect(todayLine(new Date(2026, 8, 23))).toBe('Miercuri · sept. 23');
    expect(weekdayNameIn('de', 6)).toBe('Sonntag');
  });
});
