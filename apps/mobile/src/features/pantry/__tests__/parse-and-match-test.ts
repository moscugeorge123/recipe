import { parsePantryLines } from '@/features/pantry/parse';
import { pantryKeysFrom, partitionByPantry } from '@/features/pantry/match';
import { mergeOrganizedItems } from '@/features/pantry/types';
import { isHave } from '@/stores/contracts';
import type { OrganizedPantryItem } from '@/features/pantry/types';

function item(rawText: string, name: string): OrganizedPantryItem {
  return {
    rawText,
    name,
    canonicalName: name.toLowerCase(),
    category: 'Pantry',
    emoji: '🥣',
    colorToken: 'peach',
    quantity: null,
    unit: null,
    confidence: 0.9,
    source: 'ai',
    status: 'CLASSIFIED',
    locale: 'en',
    promptVersion: 'ingredient-enrichment-v1',
  };
}

describe('pantry parse and matching', () => {
  test('splits newline and comma batches without dropping thousands', () => {
    expect(parsePantryLines('olive oil\nsalt, pepper\n1,000 g flour')).toEqual([
      'olive oil',
      'salt',
      'pepper',
      '1,000 g flour',
    ]);
  });

  test('matches YOU HAVE by canonical name, not substring', () => {
    expect(isHave('Unsalted butter', ['salt'], 'unsalted butter')).toBe(false);
    expect(isHave('Olive oil', ['olive oil'], 'olive oil')).toBe(true);
    expect(isHave('Garlic cloves', ['garlic'])).toBe(false);
  });

  test('partitions recipe ingredients with the same canonical keys', () => {
    const keys = pantryKeysFrom({
      items: [
        { name: 'Olive oil', canonicalName: 'olive oil' },
        { name: 'Salt', canonicalName: 'salt' },
      ],
    });
    const { have, need } = partitionByPantry(
      [
        { name: 'Olive oil', canonicalName: 'olive oil' },
        { name: 'Garlic cloves', canonicalName: 'garlic cloves' },
        { name: 'Unsalted butter', canonicalName: 'unsalted butter' },
      ],
      keys,
    );
    expect(have.map((item) => item.name)).toEqual(['Olive oil']);
    expect(need.map((item) => item.name)).toEqual([
      'Garlic cloves',
      'Unsalted butter',
    ]);
  });

  test('retry merges only the unresolved lines back into preview', () => {
    const current = [item('gochujang', 'Gochujang'), item('salt', 'Salt')];
    const merged = mergeOrganizedItems(current, {
      items: [{ ...item('gochujang', 'Gochujang paste'), source: 'ai' }],
      unresolved: [],
      meta: {
        promptVersion: 'ingredient-enrichment-v1',
        cacheHits: 0,
        dictionaryHits: 0,
        aiItemCount: 1,
        modelsUsed: ['gpt-5-nano'],
        escalatedCount: 0,
        fallbackCount: 0,
        truncated: false,
        aiAvailable: true,
      },
    });
    expect(merged.map((entry) => entry.name)).toEqual([
      'Salt',
      'Gochujang paste',
    ]);
  });
});
