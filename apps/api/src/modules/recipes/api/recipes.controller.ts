import type { FastifyReply, FastifyRequest } from 'fastify';

import { collectionResponse, dataResponse } from '../../../shared/http/response.js';
import {
  authorFromMetadata,
  creatorFromSource,
  difficultyFromMinutes,
  ingredientHintForStep,
  minutesFromTimes,
  sourceLabelFromType,
  thumbnailFromMetadata,
} from '../application/recipe-presentation.js';
import type { RecipeService } from '../application/recipe-service.js';
import type { ListRecipesQuery, PatchRecipeBody } from './recipes.schema.js';

function serializeRecipeDetail(
  recipe: Awaited<ReturnType<RecipeService['getById']>>,
): Record<string, unknown> {
  const minutes = minutesFromTimes(
    recipe.prepTimeMinutes,
    recipe.cookTimeMinutes,
    recipe.totalTimeMinutes,
  );

  return {
    id: recipe.id,
    title: recipe.title,
    description: recipe.description,
    servings: recipe.servings,
    prepTimeMinutes: recipe.prepTimeMinutes,
    cookTimeMinutes: recipe.cookTimeMinutes,
    totalTimeMinutes: recipe.totalTimeMinutes,
    calories: recipe.calories,
    cuisine: recipe.cuisine,
    difficulty: difficultyFromMinutes(minutes),
    minutes,
    nutrition: recipe.nutrition,
    sourceLanguage: recipe.sourceLanguage,
    confidence: recipe.confidence,
    warnings: recipe.warnings,
    promptVersion: recipe.promptVersion,
    ingredients: recipe.ingredients.map((ing) => ({
      ...ing,
      quantity: ing.quantity?.toString() ?? null,
    })),
    steps: recipe.steps.map((step) => ({
      ...step,
      ingredientHint: ingredientHintForStep(
        step.instruction,
        recipe.ingredients.map((ing) => ({
          name: ing.name,
          quantity: ing.quantity?.toString() ?? null,
          unit: ing.unit,
        })),
      ),
    })),
    source: recipe.source
      ? {
          ...recipe.source,
          author: authorFromMetadata(recipe.source.metadata),
          thumbnailUrl: thumbnailFromMetadata(recipe.source.metadata),
          sourceLabel: sourceLabelFromType(recipe.source.sourceType),
          createdAt: recipe.source.createdAt.toISOString(),
        }
      : null,
    createdAt: recipe.createdAt.toISOString(),
    updatedAt: recipe.updatedAt.toISOString(),
  };
}

function serializeRecipeListItem(
  item: Awaited<ReturnType<RecipeService['list']>>['items'][number],
): Record<string, unknown> {
  const minutes = minutesFromTimes(
    item.prepTimeMinutes,
    item.cookTimeMinutes,
    item.totalTimeMinutes,
  );
  const sourceLabel = sourceLabelFromType(item.recipeSource.sourceType);
  const author = authorFromMetadata(item.recipeSource.metadata);

  return {
    id: item.id,
    title: item.title,
    description: item.description,
    confidence: item.confidence,
    sourceLanguage: item.sourceLanguage,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    servings: item.servings,
    prepTimeMinutes: item.prepTimeMinutes,
    cookTimeMinutes: item.cookTimeMinutes,
    totalTimeMinutes: item.totalTimeMinutes,
    calories: item.calories,
    cuisine: item.cuisine,
    difficulty: difficultyFromMinutes(minutes),
    minutes,
    sourceType: item.recipeSource.sourceType,
    sourceLabel,
    creator: creatorFromSource(author, sourceLabel),
    originalUrl: item.recipeSource.originalUrl,
    thumbnailUrl: thumbnailFromMetadata(item.recipeSource.metadata),
    ingredientCount: item._count.ingredients,
    stepCount: item._count.steps,
  };
}

export function createRecipesController(service: RecipeService): {
  getById: (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) => Promise<void>;
  list: (
    request: FastifyRequest<{ Querystring: ListRecipesQuery }>,
    reply: FastifyReply,
  ) => Promise<void>;
  patch: (
    request: FastifyRequest<{ Params: { id: string }; Body: PatchRecipeBody }>,
    reply: FastifyReply,
  ) => Promise<void>;
  delete: (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) => Promise<void>;
} {
  return {
    getById: async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply,
    ): Promise<void> => {
      const recipe = await service.getById(request.params.id);
      reply.send(dataResponse(serializeRecipeDetail(recipe)));
    },

    list: async (
      request: FastifyRequest<{ Querystring: ListRecipesQuery }>,
      reply: FastifyReply,
    ): Promise<void> => {
      const { items, meta } = await service.list(request.query);

      reply.send(collectionResponse(items.map(serializeRecipeListItem), meta));
    },

    patch: async (
      request: FastifyRequest<{ Params: { id: string }; Body: PatchRecipeBody }>,
      reply: FastifyReply,
    ): Promise<void> => {
      const recipe = await service.update(request.params.id, request.body);
      reply.send(dataResponse(serializeRecipeDetail(recipe)));
    },

    delete: async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply,
    ): Promise<void> => {
      await service.delete(request.params.id);
      reply.send(dataResponse({ id: request.params.id, deleted: true as const }));
    },
  };
}
