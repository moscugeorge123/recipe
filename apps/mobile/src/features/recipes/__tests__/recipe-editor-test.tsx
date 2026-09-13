import type { ReactElement } from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  userEvent,
  waitFor,
} from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { RecipeEditor } from '@/features/recipes/components/recipe-editor';
import {
  forgetRecipeEditorDraftMemory,
  readRecipeEditorDraft,
  writeRecipeEditorDraft,
} from '@/features/recipes/editor-drafts';
import { editorDefaults } from '@/features/recipes/editor-form';
import type { RecipeView } from '@/features/recipes/types';
import { ApiError } from '@/services/api-client';
import { usePreferencesStore } from '@/stores/preferences-store';

const mockMutateAsync = jest.fn();
const mockFetchRecipe = jest.fn();

jest.mock('expo-router', () => ({
  useNavigation: () => ({
    addListener: jest.fn(() => jest.fn()),
    dispatch: jest.fn(),
  }),
}));

jest.mock('@/features/recipes/hooks/use-recipe-editor', () => ({
  useCategories: () => ({
    data: [
      {
        id: 'cat-breakfast',
        slug: 'breakfast',
        name: 'Breakfast',
        sortOrder: 0,
        recipeCount: 1,
        isDefault: true,
      },
      {
        id: 'cat-dinner',
        slug: 'dinner',
        name: 'Dinner',
        sortOrder: 2,
        recipeCount: 1,
        isDefault: true,
      },
    ],
  }),
  useSaveRecipe: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
  useFetchRecipe: () => mockFetchRecipe,
}));

const recipe: RecipeView = {
  id: 'recipe-1',
  origin: 'api',
  title: 'Imported pasta',
  description: 'A quick pasta',
  sourceType: 'INSTAGRAM',
  sourceLabel: 'Instagram',
  creator: 'Chef',
  originalUrl: 'https://example.com',
  thumbnailUrl: null,
  placeholder: ['#fff', '#eee'],
  minutes: 20,
  prepTimeMinutes: 5,
  cookTimeMinutes: 15,
  totalTimeMinutes: 20,
  difficulty: 'Easy',
  servings: 2,
  cuisine: 'Italian',
  calories: 400,
  confidence: 0.8,
  warnings: [],
  revisionNumber: 0,
  reviewState: 'NEEDS_REVIEW',
  categories: [
    { id: 'cat-dinner', slug: 'dinner', name: 'Dinner', sortOrder: 2 },
  ],
  isFavorite: false,
  rating: null,
  cookCount: 0,
  nutritionStatus: 'NOT_REQUESTED',
  ingredients: [
    {
      id: 'ing-1',
      name: 'Pasta',
      canonicalName: 'pasta',
      emoji: '🍝',
      colorToken: 'peach',
      quantity: 200,
      unit: 'g',
      preparation: null,
      optional: false,
      category: 'Pantry',
      confidence: 0.8,
    },
    {
      id: 'ing-2',
      name: 'Tomato',
      canonicalName: 'tomato',
      emoji: '🍅',
      colorToken: 'basilSoft',
      quantity: 2,
      unit: null,
      preparation: 'chopped',
      optional: false,
      category: 'Produce',
      confidence: 0.8,
    },
  ],
  steps: [
    {
      id: 'step-1',
      stepOrder: 1,
      instruction: 'Boil pasta',
      durationSeconds: 600,
      temperature: null,
      stage: 'COOK',
      ingredientHint: null,
      confidence: 0.8,
    },
    {
      id: 'step-2',
      stepOrder: 2,
      instruction: 'Add tomato',
      durationSeconds: 300,
      temperature: null,
      stage: 'FINISH',
      ingredientHint: null,
      confidence: 0.8,
    },
  ],
};

function input(label: string, index = 0) {
  return screen.getAllByLabelText(label)[index]!;
}

function control(label: string) {
  return screen.getAllByLabelText(label)[0]!;
}

async function renderEditor(
  ui: ReactElement = (
    <RecipeEditor recipe={recipe} onSaved={jest.fn()} onCancel={jest.fn()} />
  ),
) {
  const view = await render(ui);
  await screen.findByLabelText('Title');
  return view;
}

function sparseLargeRecipe(): RecipeView {
  return {
    ...recipe,
    id: 'recipe-large',
    title: '家庭料理 SehrlangesRezeptmitSpätzleundRöstzwiebeln',
    description: '長い説明と extra context '.repeat(12),
    cuisine: 'Imported',
    calories: null,
    servings: 4,
    warnings: [{ message: 'Quantity missing on garlic' }],
    ingredients: Array.from({ length: 16 }, (_, index) => ({
      id: `ing-${index}`,
      name: index === 0 ? 'Garlic' : `Ingredient ${index}`,
      canonicalName: null,
      emoji: index === 1 ? undefined : '🥣',
      colorToken: undefined,
      quantity: index % 2 === 0 ? null : index,
      unit: index % 3 === 0 ? null : 'g',
      preparation: index === 4 ? null : 'chopped',
      optional: index === 5,
      category: 'Pantry',
      confidence: index === 6 ? 0.4 : 0.9,
    })),
    steps: Array.from({ length: 16 }, (_, index) => ({
      id: `step-${index}`,
      stepOrder: index + 1,
      instruction:
        index === 0
          ? 'まず野菜を切る. Zuerst die Zwiebeln fein würfeln.'
          : `Step ${index + 1} with enough localized text to wrap`,
      durationSeconds: index % 2 === 0 ? null : 60,
      temperature: index === 2 ? null : 'medium',
      stage: index < 4 ? 'PREP' : 'COOK',
      ingredientHint: null,
      confidence: index === 7 ? 0.3 : 0.9,
    })),
  };
}

describe('RecipeEditor', () => {
  beforeEach(async () => {
    mockMutateAsync.mockReset();
    mockMutateAsync.mockResolvedValue({ ...recipe, revisionNumber: 1 });
    mockFetchRecipe.mockReset();
    mockFetchRecipe.mockResolvedValue({
      ...recipe,
      title: 'Server pasta',
      revisionNumber: 2,
    });
    usePreferencesStore.getState().setReduceMotion('system');
    forgetRecipeEditorDraftMemory();
    await AsyncStorage.clear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    forgetRecipeEditorDraftMemory();
  });

  it('loads every section and submits edited, reordered, categorized fields', async () => {
    const onSaved = jest.fn();
    const user = userEvent.setup();
    await renderEditor(
      <RecipeEditor recipe={recipe} onSaved={onSaved} onCancel={jest.fn()} />,
    );

    expect(input('Title').props.value).toBe('Imported pasta');
    expect(input('Emoji').props.value).toBe('🍝');
    await act(() => fireEvent.changeText(input('Title'), 'Corrected pasta'));
    await user.press(control('Breakfast'));
    await user.press(control('Move ingredient 2 up'));
    await user.press(control('Move step 2 up'));
    await user.press(control('Save recipe'));

    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledTimes(1));
    const payload = mockMutateAsync.mock.calls[0]?.[0];
    expect(payload).toMatchObject({
      expectedRevisionNumber: 0,
      title: 'Corrected pasta',
      categoryIds: expect.arrayContaining(['cat-breakfast', 'cat-dinner']),
    });
    expect(payload.ingredients[0].name).toBe('Tomato');
    expect(payload.steps[0].instruction).toBe('Add tomato');
    expect(onSaved).toHaveBeenCalled();
    await waitFor(async () => {
      await expect(readRecipeEditorDraft(recipe.id)).resolves.toBeNull();
    });
  });

  it('supports remove controls and keeps all controls at accessible button roles', async () => {
    const user = userEvent.setup();
    await renderEditor(
      <RecipeEditor
        recipe={{ ...recipe, id: 'recipe-remove' }}
        onSaved={jest.fn()}
        onCancel={jest.fn()}
      />,
    );
    await user.press(control('Add ingredient'));
    await user.press(control('Add step'));
    expect(screen.getAllByLabelText('Name')).toHaveLength(3);
    expect(screen.getAllByLabelText('Instruction')).toHaveLength(3);
    await user.press(control('Remove ingredient 1'));
    await user.press(control('Remove step 1'));
    expect(screen.getAllByLabelText('Name')).toHaveLength(2);
    expect(screen.getAllByLabelText('Instruction')).toHaveLength(2);
    expect(control('Cancel editing').props.accessibilityRole).toBe('button');
  });

  it('preserves the draft after a failed save', async () => {
    const user = userEvent.setup();
    mockMutateAsync.mockRejectedValueOnce(new Error('network down'));
    await renderEditor(
      <RecipeEditor
        recipe={{ ...recipe, id: 'recipe-failed-save' }}
        onSaved={jest.fn()}
        onCancel={jest.fn()}
      />,
    );
    await act(() =>
      fireEvent.changeText(input('Title'), 'Keep this after error'),
    );
    await user.press(control('Save recipe'));

    expect(await screen.findByText(/Could not save/)).toBeTruthy();
    expect(input('Title').props.value).toBe('Keep this after error');
    await waitFor(async () => {
      await expect(
        readRecipeEditorDraft('recipe-failed-save'),
      ).resolves.toMatchObject({
        values: expect.objectContaining({ title: 'Keep this after error' }),
      });
    });
  });

  it('keeps 44px targets and works with reduced motion', async () => {
    const user = userEvent.setup();
    usePreferencesStore.getState().setReduceMotion('reduce');
    await renderEditor(
      <RecipeEditor
        recipe={{ ...recipe, id: 'recipe-a11y' }}
        onSaved={jest.fn()}
        onCancel={jest.fn()}
      />,
    );

    expect(screen.getByTestId('recipe-editor-reduced-motion')).toBeTruthy();
    expect(control('Move ingredient 2 up').props.className).toContain('h-11');
    expect(control('Move step 2 down').props.className).toContain('h-11');
    expect(control('Cancel editing').props.className).toContain('h-11');
    expect(control('Save recipe').props.className).toContain('min-h-11');
    await user.press(control('Color token basilSoft'));
    await user.press(control('Save recipe'));
    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalled());
    expect(mockMutateAsync.mock.calls[0]?.[0].ingredients[0].colorToken).toBe(
      'basilSoft',
    );
    await act(() => {
      usePreferencesStore.getState().setReduceMotion('system');
    });
  });

  it('preserves the draft and explains a revision conflict', async () => {
    const user = userEvent.setup();
    mockMutateAsync.mockRejectedValueOnce(
      new ApiError('changed', 409, {}, 'RECIPE_REVISION_CONFLICT'),
    );
    await renderEditor(
      <RecipeEditor
        recipe={{ ...recipe, id: 'recipe-conflict' }}
        onSaved={jest.fn()}
        onCancel={jest.fn()}
      />,
    );
    await act(() => fireEvent.changeText(input('Title'), 'My unsaved title'));
    await user.press(control('Save recipe'));

    expect(
      await screen.findByText(/This recipe changed elsewhere/),
    ).toBeTruthy();
    expect(input('Title').props.value).toBe('My unsaved title');
    expect(screen.getByTestId('recipe-editor-conflict')).toBeTruthy();
  });

  it('lets the user keep a conflicted draft and rebase the next save', async () => {
    const user = userEvent.setup();
    mockMutateAsync.mockRejectedValueOnce(
      new ApiError('changed', 409, {}, 'RECIPE_REVISION_CONFLICT'),
    );
    mockFetchRecipe.mockResolvedValue({
      ...recipe,
      id: 'recipe-conflict-keep',
      title: 'Server pasta',
      revisionNumber: 2,
    });
    await renderEditor(
      <RecipeEditor
        recipe={{ ...recipe, id: 'recipe-conflict-keep' }}
        onSaved={jest.fn()}
        onCancel={jest.fn()}
      />,
    );
    await act(() => fireEvent.changeText(input('Title'), 'My unsaved title'));
    await user.press(control('Save recipe'));
    await screen.findByLabelText('Keep my draft');
    expect(control('Save recipe').props.accessibilityState).toMatchObject({
      disabled: true,
    });
    await user.press(control('Keep my draft'));
    expect(input('Title').props.value).toBe('My unsaved title');
    await user.press(control('Save recipe'));
    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledTimes(2));
    expect(mockMutateAsync.mock.calls[1]?.[0]).toMatchObject({
      expectedRevisionNumber: 2,
      title: 'My unsaved title',
    });
  });

  it('loads the latest version without discarding the stored draft', async () => {
    const user = userEvent.setup();
    mockMutateAsync.mockRejectedValueOnce(
      new ApiError('changed', 409, {}, 'RECIPE_REVISION_CONFLICT'),
    );
    mockFetchRecipe.mockResolvedValue({
      ...recipe,
      id: 'recipe-conflict-reload',
      title: 'Server pasta',
      revisionNumber: 2,
    });
    await renderEditor(
      <RecipeEditor
        recipe={{ ...recipe, id: 'recipe-conflict-reload' }}
        onSaved={jest.fn()}
        onCancel={jest.fn()}
      />,
    );
    await act(() => fireEvent.changeText(input('Title'), 'My unsaved title'));
    await user.press(control('Save recipe'));
    await user.press(await screen.findByLabelText('Load latest version'));
    expect(input('Title').props.value).toBe('Server pasta');
    expect(screen.getByTestId('recipe-editor-draft-banner')).toBeTruthy();
    await waitFor(async () => {
      await expect(
        readRecipeEditorDraft('recipe-conflict-reload'),
      ).resolves.toMatchObject({
        values: expect.objectContaining({ title: 'My unsaved title' }),
      });
    });
  });

  it('restores an unsaved draft after navigating away', async () => {
    const draftRecipe = { ...recipe, id: 'recipe-navigation-draft' };
    const view = await renderEditor(
      <RecipeEditor
        key="first-visit"
        recipe={draftRecipe}
        onSaved={jest.fn()}
        onCancel={jest.fn()}
      />,
    );
    await act(() => fireEvent.changeText(input('Title'), 'Keep this draft'));

    await view.rerender(
      <RecipeEditor
        key="second-visit"
        recipe={draftRecipe}
        onSaved={jest.fn()}
        onCancel={jest.fn()}
      />,
    );
    await screen.findByLabelText('Title');

    expect(input('Title').props.value).toBe('Keep this draft');
  });

  it('recovers a persisted draft after a process restart', async () => {
    const restartRecipe = { ...recipe, id: 'recipe-restart' };
    await writeRecipeEditorDraft({
      recipeId: restartRecipe.id,
      revisionNumber: 0,
      updatedAt: '2026-08-31T00:00:00.000Z',
      values: {
        ...editorDefaults(restartRecipe),
        title: 'After restart',
      },
    });
    forgetRecipeEditorDraftMemory(restartRecipe.id);

    await renderEditor(
      <RecipeEditor
        recipe={restartRecipe}
        onSaved={jest.fn()}
        onCancel={jest.fn()}
      />,
    );

    expect(input('Title').props.value).toBe('After restart');
    expect(screen.getByTestId('recipe-editor-draft-banner')).toBeTruthy();
  });

  it('asks before discarding unsaved edits', async () => {
    const onCancel = jest.fn();
    const user = userEvent.setup();
    await renderEditor(
      <RecipeEditor
        recipe={{ ...recipe, id: 'recipe-discard' }}
        onSaved={jest.fn()}
        onCancel={onCancel}
      />,
    );
    await act(() => fireEvent.changeText(input('Title'), 'Do not lose this'));
    await user.press(control('Cancel editing'));
    expect(await screen.findByText('Discard unsaved edits?')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Keep editing' }));
    expect(onCancel).not.toHaveBeenCalled();
    expect(input('Title').props.value).toBe('Do not lose this');
  });

  it('discards the local draft only after confirmation', async () => {
    const onCancel = jest.fn();
    const user = userEvent.setup();
    await renderEditor(
      <RecipeEditor
        recipe={{ ...recipe, id: 'recipe-discard-confirm' }}
        onSaved={jest.fn()}
        onCancel={onCancel}
      />,
    );
    await act(() => fireEvent.changeText(input('Title'), 'Throw away'));
    await user.press(control('Cancel editing'));
    await user.press(await screen.findByRole('button', { name: 'Discard' }));
    await waitFor(() => expect(onCancel).toHaveBeenCalled());
    await waitFor(async () => {
      await expect(
        readRecipeEditorDraft('recipe-discard-confirm'),
      ).resolves.toBeNull();
    });
  });

  it('edits large sparse recipes, reorders from the ends, and keeps optional blanks', async () => {
    const user = userEvent.setup();
    const large = sparseLargeRecipe();
    await renderEditor(
      <RecipeEditor recipe={large} onSaved={jest.fn()} onCancel={jest.fn()} />,
    );

    expect(input('Title').props.value).toContain('家庭料理');
    expect(input('Description').props.value).toContain('長い説明');
    expect(input('Cuisine').props.value).toBe('');
    expect(input('Calories').props.value).toBe('');
    expect(screen.getAllByLabelText('Name')).toHaveLength(16);
    expect(screen.getAllByLabelText('Instruction')).toHaveLength(16);
    expect(input('Quantity').props.value).toBe('');
    expect(input('Unit').props.value).toBe('');
    expect(screen.getByLabelText('Needs a look: ingredient 7')).toBeTruthy();
    await user.press(control('Move ingredient 16 to top'));
    expect(input('Name').props.value).toBe('Ingredient 15');
    await user.press(control('Move step 16 to top'));
    expect(input('Instruction').props.value).toContain('Step 16');
    await user.press(control('Save recipe'));
    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalled());
    const payload = mockMutateAsync.mock.calls[0]?.[0];
    expect(payload.ingredients[0].name).toBe('Ingredient 15');
    expect(payload.ingredients[0].quantity).toBe(15);
    expect(payload.ingredients[0].unit).toBeNull();
    expect(payload.steps[0].instruction).toContain('Step 16');
  });

  it('exposes screen-reader editing controls and keyboard reorder without dragging', async () => {
    await renderEditor(
      <RecipeEditor
        recipe={{ ...recipe, id: 'recipe-sr' }}
        onSaved={jest.fn()}
        onCancel={jest.fn()}
      />,
    );

    expect(control('Move ingredient 1 down').props.accessibilityRole).toBe(
      'button',
    );
    expect(control('Move ingredient 2 to top').props.accessibilityHint).toMatch(
      /Dragging is not required/,
    );
    expect(control('Save recipe').props.accessibilityRole).toBe('button');
    expect(screen.getByTestId('recipe-editor-status').props).toMatchObject({
      accessibilityLiveRegion: 'polite',
    });
    expect(input('Title').props.accessibilityLabel).toBe('Title');
  });

  it('focuses the first invalid field and does not save', async () => {
    const user = userEvent.setup();
    await renderEditor(
      <RecipeEditor
        recipe={{ ...recipe, id: 'recipe-validate' }}
        onSaved={jest.fn()}
        onCancel={jest.fn()}
      />,
    );
    await act(() => fireEvent.changeText(input('Title'), ''));
    await user.press(control('Save recipe'));
    expect(await screen.findByText('Title is required')).toBeTruthy();
    expect(mockMutateAsync).not.toHaveBeenCalled();
    expect(input('Title').props['aria-invalid']).toBe(true);
  });

  it('blocks saving when every category is deselected', async () => {
    const user = userEvent.setup();
    await renderEditor(
      <RecipeEditor
        recipe={{ ...recipe, id: 'recipe-category' }}
        onSaved={jest.fn()}
        onCancel={jest.fn()}
      />,
    );
    await user.press(control('Dinner'));
    expect(screen.getByText('Choose at least one category.')).toBeTruthy();
    expect(control('Save recipe').props.accessibilityState).toMatchObject({
      disabled: true,
    });
  });
});
