import { Prisma, type PrismaClient, type SourceType } from '@prisma/client';

import type {
  CreateRecipeInput,
  IRecipeRepository,
  RecipeListRecord,
  RecipeWithDetails,
} from '../../../modules/recipes/repository/recipe.repository.js';

function toNullableJson(
  value: Prisma.InputJsonValue | null,
): Prisma.InputJsonValue | typeof Prisma.DbNull {
  return value === null ? Prisma.DbNull : value;
}

function buildListWhere(params: {
  q?: string;
  cuisine?: string;
  sourceType?: SourceType;
}): Prisma.RecipeWhereInput {
  const and: Prisma.RecipeWhereInput[] = [];

  if (params.q) {
    and.push({
      OR: [
        { title: { contains: params.q, mode: 'insensitive' } },
        { description: { contains: params.q, mode: 'insensitive' } },
        { cuisine: { contains: params.q, mode: 'insensitive' } },
      ],
    });
  }

  if (params.cuisine) {
    and.push({
      cuisine: { equals: params.cuisine, mode: 'insensitive' },
    });
  }

  if (params.sourceType) {
    and.push({
      recipeSource: { sourceType: params.sourceType },
    });
  }

  return and.length > 0 ? { AND: and } : {};
}

export class PrismaRecipeRepository implements IRecipeRepository {
  constructor(private readonly db: PrismaClient) {}

  async create(input: CreateRecipeInput): Promise<RecipeWithDetails> {
    return this.db.recipe.create({
      data: {
        recipeSourceId: input.recipeSourceId,
        title: input.title,
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.servings !== undefined ? { servings: input.servings } : {}),
        ...(input.prepTimeMinutes !== undefined ? { prepTimeMinutes: input.prepTimeMinutes } : {}),
        ...(input.cookTimeMinutes !== undefined ? { cookTimeMinutes: input.cookTimeMinutes } : {}),
        ...(input.totalTimeMinutes !== undefined ? { totalTimeMinutes: input.totalTimeMinutes } : {}),
        ...(input.calories !== undefined ? { calories: input.calories } : {}),
        ...(input.cuisine !== undefined ? { cuisine: input.cuisine } : {}),
        ...(input.nutrition !== undefined ? { nutrition: toNullableJson(input.nutrition) } : {}),
        ...(input.sourceLanguage !== undefined ? { sourceLanguage: input.sourceLanguage } : {}),
        confidence: input.confidence ?? 0,
        warnings: input.warnings ?? [],
        ...(input.promptVersion !== undefined ? { promptVersion: input.promptVersion } : {}),
        ...(input.rawExtraction !== undefined ? { rawExtraction: input.rawExtraction } : {}),
        ingredients: {
          create: input.ingredients,
        },
        steps: {
          create: input.steps,
        },
      },
      include: {
        ingredients: { orderBy: { sortOrder: 'asc' } },
        steps: { orderBy: { stepOrder: 'asc' } },
      },
    });
  }

  findById(id: string): Promise<RecipeWithDetails | null> {
    return this.db.recipe.findUnique({
      where: { id },
      include: {
        ingredients: { orderBy: { sortOrder: 'asc' } },
        steps: { orderBy: { stepOrder: 'asc' } },
      },
    });
  }

  findBySourceId(recipeSourceId: string): Promise<RecipeWithDetails | null> {
    return this.db.recipe.findUnique({
      where: { recipeSourceId },
      include: {
        ingredients: { orderBy: { sortOrder: 'asc' } },
        steps: { orderBy: { stepOrder: 'asc' } },
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.db.recipe.delete({ where: { id } });
  }

  async list(params: {
    page: number;
    pageSize: number;
    q?: string;
    cuisine?: string;
    sourceType?: SourceType;
  }): Promise<{
    items: RecipeListRecord[];
    total: number;
  }> {
    const skip = (params.page - 1) * params.pageSize;
    const where = buildListWhere(params);

    const [items, total] = await Promise.all([
      this.db.recipe.findMany({
        where,
        skip,
        take: params.pageSize,
        orderBy: { createdAt: 'desc' },
        include: { recipeSource: true, _count: { select: { ingredients: true, steps: true } } },
      }),
      this.db.recipe.count({ where }),
    ]);

    return { items, total };
  }

  async update(
    id: string,
    input: Partial<Omit<CreateRecipeInput, 'recipeSourceId'>>,
  ): Promise<RecipeWithDetails> {
    const { ingredients, steps, nutrition, ...rest } = input;
    const scalarFields = {
      ...rest,
      ...(nutrition !== undefined ? { nutrition: toNullableJson(nutrition) } : {}),
    };

    if (ingredients || steps) {
      await this.db.$transaction(async (tx) => {
        if (ingredients) {
          await tx.recipeIngredient.deleteMany({ where: { recipeId: id } });
          await tx.recipeIngredient.createMany({
            data: ingredients.map((ing) => ({ ...ing, recipeId: id })),
          });
        }
        if (steps) {
          await tx.recipeStep.deleteMany({ where: { recipeId: id } });
          await tx.recipeStep.createMany({
            data: steps.map((step) => ({ ...step, recipeId: id })),
          });
        }
        await tx.recipe.update({
          where: { id },
          data: scalarFields,
        });
      });
    } else {
      await this.db.recipe.update({ where: { id }, data: scalarFields });
    }

    const result = await this.findById(id);
    if (!result) {
      throw new Error('Recipe not found after update');
    }
    return result;
  }
}
