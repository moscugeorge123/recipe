import { DEFAULT_CATEGORIES } from '@recipe/contracts';
import { Prisma, type PrismaClient } from '@prisma/client';

import {
  DEFAULT_PROFILE_ID,
  DEFAULT_PROFILE_KEY,
} from '../../../modules/profiles/domain/profile.js';
import type {
  IProfileBootstrapRepository,
  ProfileBootstrapResult,
} from '../../../modules/profiles/repository/profile-bootstrap.repository.js';

function requiredJson(value: Prisma.JsonValue): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  return value === null ? Prisma.JsonNull : value;
}

function nullableJson(
  value: Prisma.JsonValue | null,
): Prisma.InputJsonValue | typeof Prisma.DbNull {
  return value === null ? Prisma.DbNull : value;
}

/**
 * Idempotent repair/bootstrap used at process startup and by database integration tests.
 * Migrations remain the source of truth; this covers empty developer databases and recipes
 * imported after the migration's one-time backfill.
 */
export class PrismaProfileBootstrapRepository implements IProfileBootstrapRepository {
  constructor(private readonly db: PrismaClient) {}

  async ensureDefaults(): Promise<ProfileBootstrapResult> {
    return this.db.$transaction(async (tx) => {
      await tx.user.upsert({
        where: { id: DEFAULT_PROFILE_ID },
        create: {
          id: DEFAULT_PROFILE_ID,
          profileKey: DEFAULT_PROFILE_KEY,
          displayName: 'My Kitchen',
        },
        update: {},
      });

      const categories = await tx.category.createMany({
        data: DEFAULT_CATEGORIES.map((category, index) => ({
          id: `00000000-0000-4000-8000-00000000010${String(index + 1)}`,
          userId: DEFAULT_PROFILE_ID,
          ...category,
        })),
        skipDuplicates: true,
      });

      const recipes = await tx.recipe.findMany({ select: { id: true } });
      const recipeLinks = await tx.userRecipe.createMany({
        data: recipes.map((recipe) => ({
          userId: DEFAULT_PROFILE_ID,
          recipeId: recipe.id,
        })),
        skipDuplicates: true,
      });

      const linksMissingOriginal = await tx.userRecipe.findMany({
        where: {
          userId: DEFAULT_PROFILE_ID,
          revisions: { none: { revisionNumber: 0 } },
        },
        include: {
          recipe: {
            include: {
              ingredients: { orderBy: { sortOrder: 'asc' } },
              steps: { orderBy: { stepOrder: 'asc' } },
            },
          },
          categoryLinks: { include: { category: true } },
        },
      });

      for (const link of linksMissingOriginal) {
        const recipe = link.recipe;
        let categories = link.categoryLinks.map((item) => item.category);
        if (categories.length === 0) {
          const slugs = inferCategorySlugs(recipe.title, recipe.description);
          categories = await tx.category.findMany({
            where: { userId: DEFAULT_PROFILE_ID, slug: { in: slugs } },
            orderBy: { sortOrder: 'asc' },
          });
          if (categories.length > 0) {
            await tx.recipeCategory.createMany({
              data: categories.map((category) => ({
                userRecipeId: link.id,
                categoryId: category.id,
                userId: DEFAULT_PROFILE_ID,
              })),
              skipDuplicates: true,
            });
          }
        }
        await tx.recipeRevision.create({
          data: {
            userRecipeId: link.id,
            authorUserId: DEFAULT_PROFILE_ID,
            revisionNumber: 0,
            source: 'MIGRATION',
            title: recipe.title,
            description: recipe.description,
            servings: recipe.servings,
            prepTimeMinutes: recipe.prepTimeMinutes,
            cookTimeMinutes: recipe.cookTimeMinutes,
            totalTimeMinutes: recipe.totalTimeMinutes,
            calories: recipe.calories,
            cuisine: recipe.cuisine,
            nutrition: nullableJson(recipe.nutrition),
            sourceLanguage: recipe.sourceLanguage,
            confidence: recipe.confidence,
            warnings: requiredJson(recipe.warnings),
            promptVersion: recipe.promptVersion,
            rawExtraction: nullableJson(recipe.rawExtraction),
            createdAt: recipe.updatedAt,
            ingredients: {
              create: recipe.ingredients.map((ingredient) => ({
                sourceId: ingredient.id,
                name: ingredient.name,
                canonicalName: ingredient.canonicalName,
                quantity: ingredient.quantity,
                unit: ingredient.unit,
                preparation: ingredient.preparation,
                optional: ingredient.optional,
                emoji: ingredient.emoji,
                colorToken: ingredient.colorToken,
                category: ingredient.category,
                confidence: ingredient.confidence,
                provenance: requiredJson(ingredient.provenance),
                warnings: requiredJson(ingredient.warnings),
                sortOrder: ingredient.sortOrder,
              })),
            },
            steps: {
              create: recipe.steps.map((step) => ({
                sourceId: step.id,
                stepOrder: step.stepOrder,
                title: step.title,
                instruction: step.instruction,
                durationMinutes: step.durationMinutes,
                temperature: step.temperature,
                stage: step.stage,
                ahead: step.ahead,
                confidence: step.confidence,
                provenance: requiredJson(step.provenance),
                warnings: requiredJson(step.warnings),
              })),
            },
            categories: {
              create: categories.map((category) => ({
                categoryId: category.id,
                slug: category.slug,
                name: category.name,
                sortOrder: category.sortOrder,
              })),
            },
          },
        });
      }

      return {
        profileId: DEFAULT_PROFILE_ID,
        categoriesCreated: categories.count,
        recipeLinksCreated: recipeLinks.count,
        revisionsCreated: linksMissingOriginal.length,
      };
    });
  }
}

function inferCategorySlugs(title: string, description: string | null): string[] {
  const text = `${title} ${description ?? ''}`.toLowerCase();
  const inferred: string[] = [];
  if (/(cake|cookie|dessert|sweet|brownie|pudding|pie|tart|chocolate)/.test(text)) {
    inferred.push('sweet');
  }
  if (/(breakfast|brunch|pancake|waffle|oat|omelette|omelet|cereal|toast)/.test(text)) {
    inferred.push('breakfast');
  } else if (/(lunch|sandwich|salad|wrap)/.test(text)) {
    inferred.push('lunch');
  } else {
    inferred.push('dinner');
  }
  return inferred;
}
