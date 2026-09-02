import { Prisma, type RecipeSource } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';

import { RecipeService } from '../../../../src/modules/recipes/application/recipe-service.js';
import type {
  EffectiveRecipeRecord,
  IRecipeRepository,
} from '../../../../src/modules/recipes/repository/recipe.repository.js';
import { RecipeEngagementConflictError, RecipeNotFoundError, RecipeRevisionConflictError } from '../../../../src/shared/errors/recipe-errors.js';

const USER_ID = '00000000-0000-4000-8000-000000000001';

function source(): RecipeSource {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    sourceType: 'GENERIC_WEB',
    originalUrl: 'https://example.com/pasta',
    normalizedUrl: 'https://example.com/pasta',
    urlHash: 'hash',
    metadata: { author: 'Chef' },
    createdAt: new Date('2026-08-31T00:00:00.000Z'),
  };
}

function effective(overrides: Partial<EffectiveRecipeRecord> = {}): EffectiveRecipeRecord {
  return {
    id: '22222222-2222-4222-8222-222222222222',
    userRecipeId: '33333333-3333-4333-8333-333333333333',
    revisionId: '44444444-4444-4444-8444-444444444444',
    revisionNumber: 0,
    revisionSource: 'IMPORT',
    reviewState: 'NEEDS_REVIEW',
    rating: null,
    isFavorite: false,
    cookCount: 0,
    nutritionStatus: 'NOT_REQUESTED',
    title: 'Imported pasta',
    description: 'A weeknight pasta',
    servings: 2,
    prepTimeMinutes: 5,
    cookTimeMinutes: 15,
    totalTimeMinutes: 20,
    calories: 400,
    cuisine: 'Italian',
    nutrition: null,
    sourceLanguage: 'en',
    confidence: 0.8,
    warnings: [],
    promptVersion: 'recipe-extraction-v8',
    ingredients: [
      {
        id: '55555555-5555-4555-8555-555555555555',
        name: 'Pasta',
        canonicalName: 'pasta',
        quantity: new Prisma.Decimal(200),
        unit: 'g',
        preparation: null,
        optional: false,
        emoji: '🍝',
        colorToken: 'peach',
        category: 'Pantry',
        confidence: 0.8,
        provenance: {},
        warnings: [],
        sortOrder: 0,
      },
    ],
    steps: [
      {
        id: '66666666-6666-4666-8666-666666666666',
        stepOrder: 1,
        instruction: 'Boil pasta',
        durationMinutes: 10,
        temperature: null,
        stage: 'COOK',
        confidence: 0.8,
        provenance: {},
        warnings: [],
      },
    ],
    categories: [
      {
        id: '77777777-7777-4777-8777-777777777777',
        slug: 'dinner',
        name: 'Dinner',
        sortOrder: 2,
      },
    ],
    source: source(),
    createdAt: new Date('2026-08-31T00:00:00.000Z'),
    updatedAt: new Date('2026-08-31T00:00:00.000Z'),
    ...overrides,
  };
}

function repo(overrides: Partial<IRecipeRepository> = {}): IRecipeRepository {
  return {
    create: vi.fn(),
    findById: vi.fn(),
    findBySourceId: vi.fn(),
    delete: vi.fn(),
    list: vi.fn(),
    update: vi.fn(),
    findEffectiveById: vi.fn(),
    setFavorite: vi.fn(),
    setRating: vi.fn(),
    setReviewState: vi.fn(),
    adjustCompletedCookCount: vi.fn(),
    listNotes: vi.fn(),
    createNote: vi.fn(),
    updateNote: vi.fn(),
    deleteNote: vi.fn(),
    appendRevision: vi.fn(),
    listRevisions: vi.fn(),
    findRevision: vi.fn(),
    restoreRevision: vi.fn(),
    ...overrides,
  };
}

describe('RecipeService revisions', () => {
  it('returns the effective snapshot with ownership and source metadata', async () => {
    const current = effective();
    const update = vi.fn();
    const recipeRepo = repo({ findEffectiveById: vi.fn().mockResolvedValue(current), update });
    const service = new RecipeService(recipeRepo);

    await expect(service.getByIdForProfile(current.id, USER_ID)).resolves.toMatchObject({
      title: 'Imported pasta',
      revisionNumber: 0,
      reviewState: 'NEEDS_REVIEW',
      cookCount: 0,
      nutritionStatus: 'NOT_REQUESTED',
      categories: [expect.objectContaining({ slug: 'dinner' })],
      source: expect.objectContaining({ originalUrl: 'https://example.com/pasta' }),
    });
    expect(update).not.toHaveBeenCalled();
  });

  it('appends the next revision instead of mutating the imported original', async () => {
    const current = effective();
    const saved = effective({
      revisionNumber: 1,
      revisionSource: 'USER_EDIT',
      reviewState: 'READY',
      title: 'Corrected pasta',
    });
    const appendRevision = vi.fn().mockResolvedValue(saved);
    const update = vi.fn();
    const recipeRepo = repo({
      findEffectiveById: vi.fn().mockResolvedValue(current),
      appendRevision,
      update,
    });
    const service = new RecipeService(recipeRepo);

    const result = await service.updateForProfile(current.id, USER_ID, {
      expectedRevisionNumber: 0,
      title: 'Corrected pasta',
    });

    expect(result.revisionNumber).toBe(1);
    expect(result.title).toBe('Corrected pasta');
    expect(update).not.toHaveBeenCalled();
    expect(appendRevision).toHaveBeenCalledWith(
      current.id,
      USER_ID,
      0,
      expect.objectContaining({
        title: 'Corrected pasta',
        categoryIds: ['77777777-7777-4777-8777-777777777777'],
        ingredients: [
          expect.objectContaining({ name: 'Pasta', emoji: '🍝', colorToken: 'peach' }),
        ],
      }),
    );
  });

  it('maps a stale expectedRevisionNumber to RecipeRevisionConflictError', async () => {
    const current = effective({ revisionNumber: 1 });
    const recipeRepo = repo({
      findEffectiveById: vi.fn().mockResolvedValue(current),
      appendRevision: vi.fn().mockResolvedValue('conflict'),
    });
    const service = new RecipeService(recipeRepo);

    await expect(
      service.updateForProfile(current.id, USER_ID, { expectedRevisionNumber: 0, title: 'Stale' }),
    ).rejects.toBeInstanceOf(RecipeRevisionConflictError);
  });

  it('restores by creating a new head rather than rewriting history', async () => {
    const restored = effective({
      revisionNumber: 2,
      revisionSource: 'RESTORE',
      title: 'Imported pasta',
    });
    const restoreRevision = vi.fn().mockResolvedValue(restored);
    const service = new RecipeService(repo({ restoreRevision }));

    await expect(
      service.restoreRevision(restored.id, restored.revisionId, USER_ID, 1),
    ).resolves.toMatchObject({ revisionNumber: 2, revisionSource: 'RESTORE' });
    expect(restoreRevision).toHaveBeenCalledWith(restored.id, restored.revisionId, USER_ID, 1);
  });

  it('refuses delete and restore for recipes the profile does not own', async () => {
    const remove = vi.fn();
    const recipeRepo = repo({
      findEffectiveById: vi.fn().mockResolvedValue(null),
      restoreRevision: vi.fn().mockResolvedValue(null),
      delete: remove,
    });
    const service = new RecipeService(recipeRepo);

    await expect(service.deleteForProfile('22222222-2222-4222-8222-222222222222', USER_ID)).rejects.toBeInstanceOf(
      RecipeNotFoundError,
    );
    await expect(
      service.restoreRevision(
        '22222222-2222-4222-8222-222222222222',
        '44444444-4444-4444-8444-444444444444',
        USER_ID,
        0,
      ),
    ).rejects.toBeInstanceOf(RecipeNotFoundError);
    expect(remove).not.toHaveBeenCalled();
  });

  it('requests nutrition after ingredient or serving changes, not title-only edits', async () => {
    const current = effective();
    const titleOnly = effective({ revisionNumber: 1, title: 'Corrected pasta' });
    const withServings = effective({
      revisionNumber: 2,
      revisionId: '88888888-8888-4888-8888-888888888888',
      servings: 4,
    });
    const requestForRevision = vi.fn().mockResolvedValue(undefined);
    const requestForRecipe = vi.fn().mockResolvedValue(undefined);
    const scheduler = { requestForRevision, requestForRecipe };

    const titleService = new RecipeService(
      repo({
        findEffectiveById: vi.fn().mockResolvedValue(current),
        appendRevision: vi.fn().mockResolvedValue(titleOnly),
      }),
      scheduler,
    );
    await titleService.updateForProfile(current.id, USER_ID, {
      expectedRevisionNumber: 0,
      title: 'Corrected pasta',
    });
    expect(requestForRevision).not.toHaveBeenCalled();

    const servingService = new RecipeService(
      repo({
        findEffectiveById: vi.fn().mockResolvedValue(current),
        appendRevision: vi.fn().mockResolvedValue(withServings),
      }),
      scheduler,
    );
    await servingService.updateForProfile(current.id, USER_ID, {
      expectedRevisionNumber: 0,
      servings: 4,
    });
    expect(requestForRevision).toHaveBeenCalledWith({
      recipeId: withServings.id,
      revisionId: withServings.revisionId,
      userId: USER_ID,
    });
  });
});

describe('RecipeService engagement', () => {
  it('treats a matching favorite write as success and maps OCC to a 409', async () => {
    const current = effective();
    const service = new RecipeService(
      repo({
        setFavorite: vi.fn().mockResolvedValue({
          id: current.id,
          userRecipeId: current.userRecipeId,
          isFavorite: true,
          rating: null,
          ratingAverage: null,
          ratingCount: 0,
          cookCount: 0,
          updatedAt: current.updatedAt,
        }),
      }),
    );
    await expect(service.setFavorite(current.id, USER_ID, true)).resolves.toMatchObject({
      isFavorite: true,
    });

    const conflicted = new RecipeService(repo({ setFavorite: vi.fn().mockResolvedValue('conflict') }));
    await expect(conflicted.setFavorite(current.id, USER_ID, false, current.updatedAt)).rejects.toBeInstanceOf(
      RecipeEngagementConflictError,
    );
  });

  it('sets review state without creating a revision', async () => {
    const current = effective();
    const appendRevision = vi.fn();
    const service = new RecipeService(
      repo({
        appendRevision,
        setReviewState: vi.fn().mockResolvedValue({
          id: current.id,
          userRecipeId: current.userRecipeId,
          isFavorite: false,
          rating: null,
          ratingAverage: null,
          ratingCount: 0,
          cookCount: 0,
          reviewState: 'READY',
          updatedAt: current.updatedAt,
        }),
      }),
    );
    await expect(
      service.setReviewState(current.id, USER_ID, 'READY'),
    ).resolves.toMatchObject({ reviewState: 'READY' });
    expect(appendRevision).not.toHaveBeenCalled();
  });

  it('does not create revisions when adding a note', async () => {
    const current = effective();
    const appendRevision = vi.fn();
    const createNote = vi.fn().mockResolvedValue({
      id: '99999999-9999-4999-8999-999999999999',
      recipeId: current.id,
      body: 'less salt',
      cookSessionId: null,
      createdAt: current.createdAt,
      updatedAt: current.updatedAt,
    });
    const service = new RecipeService(repo({ createNote, appendRevision }));
    await expect(service.createNote(current.id, USER_ID, { body: 'less salt' })).resolves.toMatchObject({
      body: 'less salt',
    });
    expect(appendRevision).not.toHaveBeenCalled();
  });
});
