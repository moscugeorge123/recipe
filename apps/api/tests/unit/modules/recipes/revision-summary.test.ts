import { describe, expect, it } from 'vitest';

import {
  summarizeRevision,
  type RevisionSummarySnapshot,
} from '../../../../src/modules/recipes/application/revision-summary.js';

function snapshot(overrides: Partial<RevisionSummarySnapshot> = {}): RevisionSummarySnapshot {
  return {
    source: 'USER_EDIT',
    title: 'Pasta',
    description: 'Weeknight pasta',
    servings: 2,
    prepTimeMinutes: 5,
    cookTimeMinutes: 15,
    totalTimeMinutes: 20,
    calories: 400,
    cuisine: 'Italian',
    categories: [{ slug: 'dinner', name: 'Dinner' }],
    ingredients: [
      {
        name: 'Pasta',
        canonicalName: 'pasta',
        quantity: '200',
        unit: 'g',
        preparation: null,
        optional: false,
        emoji: '🍝',
        colorToken: 'peach',
        category: 'Pantry',
        sortOrder: 0,
      },
      {
        name: 'Tomato',
        canonicalName: 'tomato',
        quantity: '2',
        unit: null,
        preparation: 'chopped',
        optional: false,
        emoji: '🍅',
        colorToken: 'basilSoft',
        category: 'Produce',
        sortOrder: 1,
      },
    ],
    steps: [
      {
        stepOrder: 1,
        instruction: 'Boil pasta',
        durationMinutes: 10,
        temperature: null,
        stage: 'COOK',
      },
      {
        stepOrder: 2,
        instruction: 'Add tomato',
        durationMinutes: 5,
        temperature: null,
        stage: 'FINISH',
      },
    ],
    ...overrides,
  };
}

describe('summarizeRevision', () => {
  it('labels the original import', () => {
    expect(summarizeRevision(snapshot({ source: 'IMPORT' }), undefined)).toEqual([
      'Original imported recipe',
    ]);
  });

  it('describes restores as a new version rather than a field dump', () => {
    expect(
      summarizeRevision(snapshot({ source: 'RESTORE', title: 'Original pasta' }), snapshot()),
    ).toEqual(['Restored an earlier version as a new revision']);
  });

  it('uses human-readable field, reorder, and collection copy', () => {
    const previous = snapshot();
    const current = snapshot({
      title: 'Corrected pasta',
      servings: 4,
      categories: [
        { slug: 'dinner', name: 'Dinner' },
        { slug: 'family', name: 'Family' },
      ],
      ingredients: [previous.ingredients[1]!, previous.ingredients[0]!],
      steps: [
        previous.steps[0]!,
        previous.steps[1]!,
        {
          stepOrder: 3,
          instruction: 'Plate and serve',
          durationMinutes: null,
          temperature: null,
          stage: 'SERVE',
        },
      ],
    });

    expect(summarizeRevision(current, previous)).toEqual([
      'Renamed to “Corrected pasta”',
      'Changed servings to 4',
      'Updated categories (added Family)',
      'Reordered ingredients',
      'Steps: added 1',
    ]);
  });

  it('falls back when a save did not change recipe fields', () => {
    expect(summarizeRevision(snapshot(), snapshot())).toEqual(['Saved without field changes']);
  });
});
