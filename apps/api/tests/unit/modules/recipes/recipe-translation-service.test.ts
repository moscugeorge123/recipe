import { describe, expect, it, vi } from 'vitest';

import {
  applyTranslation,
  RecipeTranslationService,
} from '../../../../src/modules/recipes/application/recipe-translation-service.js';
import type { RecipeTranslator } from '../../../../src/modules/recipes/application/recipe-translator.js';
import type {
  EffectiveRecipeRecord,
  IRecipeRepository,
  RecipeTranslationRecord,
} from '../../../../src/modules/recipes/repository/recipe.repository.js';

const content = {
  title: 'Tort cu unt',
  description: 'Un tort simplu',
  ingredients: [
    { name: 'Făină', unit: 'cană', metricUnit: 'g', imperialUnit: 'cană', preparation: null },
  ],
  steps: [{ title: 'Amestecă', instruction: 'Amestecă făina cu untul.' }],
};

function recipe(overrides: Partial<EffectiveRecipeRecord> = {}): EffectiveRecipeRecord {
  return {
    id: 'r1',
    userRecipeId: 'ur1',
    revisionId: 'rev1',
    title: 'Butter cake',
    description: 'A simple cake',
    contentLanguage: 'en',
    ingredients: [
      {
        id: 'i1',
        name: 'Flour',
        unit: 'cup',
        metricUnit: 'g',
        imperialUnit: 'cup',
        preparation: null,
        quantity: null,
      },
    ],
    steps: [{ id: 's1', title: 'Mix', instruction: 'Mix the flour with the butter.' }],
    ...overrides,
  } as unknown as EffectiveRecipeRecord;
}

function row(overrides: Partial<RecipeTranslationRecord> = {}): RecipeTranslationRecord {
  return {
    id: 't1',
    userRecipeId: 'ur1',
    language: 'ro',
    sourceRevisionId: 'rev1',
    status: 'COMPLETED',
    content,
    error: null,
    updatedAt: new Date(),
    ...overrides,
  };
}

function setup(
  existing: RecipeTranslationRecord | null,
  translate = vi.fn().mockResolvedValue({ content, promptVersion: 'v1' }),
  available = true,
) {
  const findTranslation = vi.fn().mockResolvedValue(existing);
  const save = vi.fn().mockResolvedValue(row());
  const repo = {
    findTranslation,
    saveTranslation: save,
  } as unknown as IRecipeRepository;
  const translator = { available, translate } as unknown as RecipeTranslator;
  return {
    find: findTranslation,
    save,
    translate,
    service: new RecipeTranslationService(repo, translator),
  };
}

describe('RecipeTranslationService', () => {
  it('returns the original untouched when it is already in the requested language', async () => {
    const { service, find } = setup(null);
    const result = await service.resolve(recipe(), 'en-US');
    expect(result.translation).toEqual({ language: 'en', status: 'ORIGINAL' });
    expect(find).not.toHaveBeenCalled();
  });

  it('applies a stored translation for the current revision', async () => {
    const { service } = setup(row());
    const result = await service.resolve(recipe(), 'ro');
    expect(result.translation.status).toBe('READY');
    expect(result.recipe.title).toBe('Tort cu unt');
    expect(result.recipe.ingredients[0]?.name).toBe('Făină');
    expect(result.recipe.steps[0]?.instruction).toBe('Amestecă făina cu untul.');
    expect(result.recipe.ingredients[0]?.id).toBe('i1');
  });

  it('starts a translation when none exists and returns the original while pending', async () => {
    const { service, save, translate } = setup(null);
    const result = await service.resolve(recipe(), 'ro');
    expect(result.translation).toEqual({ language: 'ro', status: 'PENDING' });
    expect(result.recipe.title).toBe('Butter cake');
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'PENDING', language: 'ro', sourceRevisionId: 'rev1' }),
    );
    await vi.waitFor(() =>
      { expect(save).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'COMPLETED', content }),
      ); },
    );
    expect(translate).toHaveBeenCalledTimes(1);
  });

  it('re-translates when the recipe was edited after the stored translation', async () => {
    const { service, translate } = setup(row({ sourceRevisionId: 'old' }));
    const result = await service.resolve(recipe(), 'ro');
    expect(result.translation.status).toBe('PENDING');
    await vi.waitFor(() => { expect(translate).toHaveBeenCalled(); });
  });

  it('does not start a second translation while one is fresh and pending', async () => {
    const { service, translate } = setup(row({ status: 'PENDING', content: null }));
    const result = await service.resolve(recipe(), 'ro');
    expect(result.translation.status).toBe('PENDING');
    expect(translate).not.toHaveBeenCalled();
  });

  it('restarts a pending translation that has gone stale', async () => {
    const { service, translate } = setup(
      row({ status: 'PENDING', content: null, updatedAt: new Date(Date.now() - 10 * 60_000) }),
    );
    await service.resolve(recipe(), 'ro');
    await vi.waitFor(() => { expect(translate).toHaveBeenCalled(); });
  });

  it('reports a failed translation without retrying on its own', async () => {
    const { service, translate } = setup(row({ status: 'FAILED', content: null }));
    const result = await service.resolve(recipe(), 'ro');
    expect(result.translation.status).toBe('FAILED');
    expect(translate).not.toHaveBeenCalled();
  });

  it('records a failure when the translator throws', async () => {
    const { service, save } = setup(null, vi.fn().mockRejectedValue(new Error('boom')));
    await service.resolve(recipe(), 'ro');
    await vi.waitFor(() =>
      { expect(save).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'FAILED', error: 'boom' }),
      ); },
    );
  });

  it('reports UNAVAILABLE without an AI provider', async () => {
    const { service, save } = setup(null, undefined, false);
    const result = await service.resolve(recipe(), 'ro');
    expect(result.translation.status).toBe('UNAVAILABLE');
    expect(save).not.toHaveBeenCalled();
  });

  it('keeps null optional fields null when applying', () => {
    const base = recipe({ description: null });
    const out = applyTranslation(base, content);
    expect(out.description).toBeNull();
  });
});
