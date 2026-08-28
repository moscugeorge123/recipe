import { mapRecipeListItem } from '@/features/recipes/mapper';
import type { RecipeListItemView } from '@/features/recipes/types';

const fixture: RecipeListItemView = {
  id: '11111111-1111-4111-8111-111111111111',
  title: 'Lemon Chicken Thighs',
  description: 'Weeknight Italian supper',
  confidence: 0.81,
  sourceLanguage: 'en',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  servings: 3,
  prepTimeMinutes: 10,
  cookTimeMinutes: 25,
  totalTimeMinutes: 35,
  calories: 420,
  cuisine: 'Italian',
  difficulty: 'Easy',
  minutes: 18,
  sourceType: 'INSTAGRAM',
  sourceLabel: 'Instagram',
  creator: '@noor.cooks',
  originalUrl: 'https://instagram.com/p/example',
  thumbnailUrl: 'https://img.example/t.jpg',
  ingredientCount: 8,
  stepCount: 4,
};

describe('mapRecipeListItem', () => {
  test('maps card-ready list fields into RecipeView', () => {
    const view = mapRecipeListItem(fixture);

    expect(view.origin).toBe('api');
    expect(view.title).toBe('Lemon Chicken Thighs');
    expect(view.description).toBe('Weeknight Italian supper');
    expect(view.minutes).toBe(18);
    expect(view.servings).toBe(3);
    expect(view.difficulty).toBe('Easy');
    expect(view.cuisine).toBe('Italian');
    expect(view.creator).toBe('@noor.cooks');
    expect(view.sourceLabel).toBe('Instagram');
    expect(view.sourceType).toBe('INSTAGRAM');
    expect(view.thumbnailUrl).toBe('https://img.example/t.jpg');
    expect(view.originalUrl).toBe('https://instagram.com/p/example');
    expect(view.calories).toBe(420);
    expect(view.confidence).toBe(0.81);
    expect(view.warnings).toEqual([]);
    expect(view.ingredients).toEqual([]);
    expect(view.steps).toEqual([]);
    expect(view.ingredientCount).toBe(8);
    expect(view.stepCount).toBe(4);
  });

  test('applies defaults when list fields are null', () => {
    const view = mapRecipeListItem({
      ...fixture,
      servings: null,
      cuisine: null,
      difficulty: null,
      minutes: null,
      calories: null,
      originalUrl: null,
      thumbnailUrl: null,
    });

    expect(view.minutes).toBe(30);
    expect(view.servings).toBe(4);
    expect(view.difficulty).toBe('Medium');
    expect(view.cuisine).toBe('Imported');
    expect(view.calories).toBeNull();
    expect(view.originalUrl).toBeNull();
    expect(view.thumbnailUrl).toBeNull();
    expect(view.ingredients).toEqual([]);
    expect(view.steps).toEqual([]);
  });
});
