import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  clearRecipeEditorDraft,
  forgetRecipeEditorDraftMemory,
  peekRecipeEditorDraft,
  readRecipeEditorDraft,
  rememberRecipeEditorDraft,
  writeRecipeEditorDraft,
} from '@/features/recipes/editor-drafts';
import { editorDefaults } from '@/features/recipes/editor-form';
import type { RecipeView } from '@/features/recipes/types';

const recipe = {
  id: 'recipe-drafts',
  title: 'Pasta',
  description: null,
  cuisine: 'Italian',
  servings: 2,
  ingredients: [],
  steps: [],
  categories: [],
} as unknown as RecipeView;

describe('recipe editor drafts', () => {
  beforeEach(async () => {
    forgetRecipeEditorDraftMemory();
    await AsyncStorage.clear();
  });

  it('keys persisted drafts by recipe and revision', async () => {
    const values = {
      ...editorDefaults(recipe),
      title: 'Draft pasta',
    };
    await writeRecipeEditorDraft({
      recipeId: recipe.id,
      revisionNumber: 3,
      updatedAt: '2026-08-31T00:00:00.000Z',
      values,
    });
    forgetRecipeEditorDraftMemory(recipe.id);

    await expect(readRecipeEditorDraft(recipe.id)).resolves.toMatchObject({
      recipeId: recipe.id,
      revisionNumber: 3,
      values: expect.objectContaining({ title: 'Draft pasta' }),
    });
  });

  it('remembers in memory immediately and only clears after an explicit cleanup', async () => {
    const values = { ...editorDefaults(recipe), title: 'Live draft' };
    rememberRecipeEditorDraft(recipe.id, 0, values);
    expect(peekRecipeEditorDraft(recipe.id)?.values.title).toBe('Live draft');
    await clearRecipeEditorDraft(recipe.id);
    expect(peekRecipeEditorDraft(recipe.id)).toBeNull();
    await expect(readRecipeEditorDraft(recipe.id)).resolves.toBeNull();
  });
});
