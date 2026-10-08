import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { PrismaProfileBootstrapRepository } from '../../../src/infrastructure/database/repositories/profile-bootstrap.repository.js';
import { DEFAULT_PROFILE_ID } from '../../../src/modules/profiles/domain/profile.js';
import {
  disconnectTestDatabase,
  getTestPrisma,
  isPersistenceFoundationAvailable,
  resetDatabase,
} from '../../helpers/database.js';

const foundationAvailable = await isPersistenceFoundationAvailable();

describe.skipIf(!foundationAvailable)('profile persistence foundation', () => {
  const db = getTestPrisma();
  const bootstrap = new PrismaProfileBootstrapRepository(db);

  beforeEach(async () => {
    await resetDatabase(db, { bootstrapDefaults: false });
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  it('idempotently seeds the singleton, categories, and links all existing recipes', async () => {
    const first = await bootstrap.ensureDefaults();
    expect(first.profileId).toBe(DEFAULT_PROFILE_ID);
    expect(first.categoriesCreated).toBe(4);

    const source = await db.recipeSource.create({
      data: {
        sourceType: 'GENERIC_WEB',
        originalUrl: 'https://example.com/foundation',
        normalizedUrl: 'https://example.com/foundation',
        urlHash: 'profile-foundation',
      },
    });
    const recipe = await db.recipe.create({
      data: {
        recipeSourceId: source.id,
        title: 'Preserved recipe',
        ingredients: { create: [{ name: 'Flour', quantity: '1.250', unit: 'cup' }] },
        steps: { create: [{ stepOrder: 1, instruction: 'Mix thoroughly' }] },
      },
    });

    const repaired = await bootstrap.ensureDefaults();
    const repeated = await bootstrap.ensureDefaults();

    expect(repaired.recipeLinksCreated).toBe(1);
    expect(repaired.revisionsCreated).toBe(1);
    expect(repeated.categoriesCreated).toBe(0);
    expect(repeated.recipeLinksCreated).toBe(0);
    expect(repeated.revisionsCreated).toBe(0);
    const link = await db.userRecipe.findUniqueOrThrow({
      where: { userId_recipeId: { userId: DEFAULT_PROFILE_ID, recipeId: recipe.id } },
      include: {
        revisions: { include: { ingredients: true, steps: true } },
      },
    });
    expect(link.reviewState).toBe('NEEDS_REVIEW');
    expect(link.rating).toBeNull();
    expect(link.revisions).toHaveLength(1);
    expect(link.revisions[0]?.revisionNumber).toBe(0);
    expect(link.revisions[0]?.ingredients[0]?.quantity?.toFixed(3)).toBe('1.250');
    expect(link.revisions[0]?.steps[0]?.instruction).toBe('Mix thoroughly');
    await expect(db.category.count({ where: { userId: DEFAULT_PROFILE_ID } })).resolves.toBe(4);
  });

  it('supports immutable revision snapshots and cascades them with the recipe', async () => {
    await bootstrap.ensureDefaults();
    const source = await db.recipeSource.create({
      data: {
        sourceType: 'GENERIC_WEB',
        originalUrl: 'https://example.com/revision',
        normalizedUrl: 'https://example.com/revision',
        urlHash: 'revision-foundation',
      },
    });
    const recipe = await db.recipe.create({
      data: { recipeSourceId: source.id, title: 'Revision recipe' },
    });
    await bootstrap.ensureDefaults();
    const userRecipe = await db.userRecipe.findUniqueOrThrow({
      where: { userId_recipeId: { userId: DEFAULT_PROFILE_ID, recipeId: recipe.id } },
    });
    const revision = await db.recipeRevision.create({
      data: {
        userRecipeId: userRecipe.id,
        revisionNumber: 1,
        source: 'USER_EDIT',
        title: recipe.title,
        ingredients: {
          create: [{ name: 'Tomato', quantity: '2.000', sortOrder: 0 }],
        },
        steps: {
          create: [{ stepOrder: 1, instruction: 'Slice tomatoes' }],
        },
      },
      include: { ingredients: true, steps: true },
    });

    expect(revision.ingredients[0]?.quantity?.toFixed(3)).toBe('2.000');
    expect(revision.steps[0]?.instruction).toBe('Slice tomatoes');
    await expect(
      db.recipeRevision.update({
        where: { id: revision.id },
        data: { title: 'Mutation must fail' },
      }),
    ).rejects.toThrow(/immutable/i);

    await db.recipe.delete({ where: { id: recipe.id } });
    await expect(db.recipeRevision.count({ where: { userRecipeId: userRecipe.id } })).resolves.toBe(
      0,
    );
  });

  it('scopes categories, review state, ratings, and revisions to each profile', async () => {
    await bootstrap.ensureDefaults();
    const secondUser = await db.user.create({ data: { profileKey: 'second-profile' } });
    const secondBreakfast = await db.category.create({
      data: {
        userId: secondUser.id,
        slug: 'breakfast',
        name: 'Breakfast',
      },
    });
    const defaultBreakfast = await db.category.findUniqueOrThrow({
      where: {
        userId_slug: { userId: DEFAULT_PROFILE_ID, slug: 'breakfast' },
      },
    });
    expect(secondBreakfast.slug).toBe(defaultBreakfast.slug);

    const source = await db.recipeSource.create({
      data: {
        sourceType: 'GENERIC_WEB',
        originalUrl: 'https://example.com/shared-recipe',
        normalizedUrl: 'https://example.com/shared-recipe',
        urlHash: 'shared-recipe',
      },
    });
    const recipe = await db.recipe.create({
      data: { recipeSourceId: source.id, title: 'Shared recipe' },
    });
    await bootstrap.ensureDefaults();
    const defaultLink = await db.userRecipe.findUniqueOrThrow({
      where: { userId_recipeId: { userId: DEFAULT_PROFILE_ID, recipeId: recipe.id } },
    });
    const secondLink = await db.userRecipe.create({
      data: {
        userId: secondUser.id,
        recipeId: recipe.id,
        reviewState: 'READY',
        rating: 5,
        revisions: {
          create: {
            revisionNumber: 0,
            source: 'IMPORT',
            title: recipe.title,
          },
        },
      },
    });

    await expect(
      db.recipeCategory.create({
        data: {
          userId: secondUser.id,
          userRecipeId: secondLink.id,
          categoryId: defaultBreakfast.id,
        },
      }),
    ).rejects.toThrow();
    await expect(
      db.recipeCategory.create({
        data: {
          userId: secondUser.id,
          userRecipeId: secondLink.id,
          categoryId: secondBreakfast.id,
        },
      }),
    ).resolves.toBeDefined();
    await expect(
      db.userRecipe.update({
        where: { id: defaultLink.id },
        data: { rating: 6 },
      }),
    ).rejects.toThrow();
    await expect(
      db.recipeRevision.count({
        where: { userRecipeId: { in: [defaultLink.id, secondLink.id] }, revisionNumber: 0 },
      }),
    ).resolves.toBe(2);
  });

  it('enforces ownership uniqueness and user-owned cascades', async () => {
    await bootstrap.ensureDefaults();
    const source = await db.recipeSource.create({
      data: {
        sourceType: 'GENERIC_WEB',
        originalUrl: 'https://example.com/cascade',
        normalizedUrl: 'https://example.com/cascade',
        urlHash: 'cascade-foundation',
      },
    });
    const recipe = await db.recipe.create({
      data: { recipeSourceId: source.id, title: 'Cascade recipe' },
    });
    await bootstrap.ensureDefaults();
    const userRecipe = await db.userRecipe.findUniqueOrThrow({
      where: { userId_recipeId: { userId: DEFAULT_PROFILE_ID, recipeId: recipe.id } },
    });
    await db.pantryItem.create({
      data: { userId: DEFAULT_PROFILE_ID, name: 'Rice' },
    });
    await db.aIUsage.create({
      data: {
        userId: DEFAULT_PROFILE_ID,
        provider: 'test',
        model: 'test-model',
        operation: 'pantry_classification',
      },
    });
    await expect(
      db.aIUsage.create({
        data: {
          provider: 'test',
          model: 'test-model',
          operation: 'detached-operation',
        },
      }),
    ).rejects.toThrow();

    await expect(
      db.user.create({
        data: { profileKey: 'default' },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });

    await db.user.delete({ where: { id: DEFAULT_PROFILE_ID } });
    await expect(db.pantryItem.count()).resolves.toBe(0);
    await expect(db.aIUsage.count()).resolves.toBe(0);
    await expect(db.userRecipe.count({ where: { id: userRecipe.id } })).resolves.toBe(0);
    await expect(db.recipeRevision.count({ where: { userRecipeId: userRecipe.id } })).resolves.toBe(
      0,
    );
    await expect(db.recipe.count({ where: { id: recipe.id } })).resolves.toBe(1);
  });
});
