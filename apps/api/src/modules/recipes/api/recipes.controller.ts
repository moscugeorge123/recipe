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
import type {
  CreateRecipeNoteBody,
  EngagementConcurrencyBody,
  ListRecipesQuery,
  PatchRecipeBody,
  PatchRecipeNoteBody,
  PutRatingBody,
  PutReviewStateBody,
  RestoreRevisionBody,
} from './recipes.schema.js';

export function serializeRecipeDetail(
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
    userRecipeId: recipe.userRecipeId,
    revisionId: recipe.revisionId,
    revisionNumber: recipe.revisionNumber,
    revisionSource: recipe.revisionSource,
    reviewState: recipe.reviewState,
    categories: recipe.categories,
    isFavorite: recipe.isFavorite,
    rating: recipe.rating,
    ratingAverage: recipe.ratingAverage,
    ratingCount: recipe.ratingCount,
    cookCount: recipe.cookCount,
    nutritionStatus: recipe.nutritionStatus,
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
    source: {
      id: recipe.source.id,
      sourceType: recipe.source.sourceType,
      originalUrl: recipe.source.originalUrl,
      normalizedUrl: recipe.source.normalizedUrl,
      metadata: recipe.source.metadata,
      author: authorFromMetadata(recipe.source.metadata),
      thumbnailUrl: thumbnailFromMetadata(recipe.source.metadata),
      sourceLabel: sourceLabelFromType(recipe.source.sourceType),
      createdAt: recipe.source.createdAt.toISOString(),
    },
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
    userRecipeId: item.userRecipeId,
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
    ingredientCount: item.ingredientCount,
    stepCount: item.stepCount,
    categories: item.categories,
    isFavorite: item.isFavorite,
    rating: item.rating,
    ratingAverage: item.ratingAverage,
    ratingCount: item.ratingCount,
    cookCount: item.cookCount,
    reviewState: item.reviewState,
  };
}

function serializeEngagement(
  item: Awaited<ReturnType<RecipeService['setFavorite']>>,
): Record<string, unknown> {
  return {
    id: item.id,
    userRecipeId: item.userRecipeId,
    isFavorite: item.isFavorite,
    rating: item.rating,
    ratingAverage: item.ratingAverage,
    ratingCount: item.ratingCount,
    cookCount: item.cookCount,
    reviewState: item.reviewState,
    updatedAt: item.updatedAt.toISOString(),
  };
}

function serializeNote(
  note: Awaited<ReturnType<RecipeService['createNote']>>,
): Record<string, unknown> {
  return {
    id: note.id,
    recipeId: note.recipeId,
    body: note.body,
    cookSessionId: note.cookSessionId,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
  };
}

function parseExpectedUpdatedAt(value: string | undefined): Date | undefined {
  return value ? new Date(value) : undefined;
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
  listRevisions: (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) => Promise<void>;
  getRevision: (
    request: FastifyRequest<{ Params: { id: string; revisionId: string } }>,
    reply: FastifyReply,
  ) => Promise<void>;
  restoreRevision: (
    request: FastifyRequest<{
      Params: { id: string; revisionId: string };
      Body: RestoreRevisionBody;
    }>,
    reply: FastifyReply,
  ) => Promise<void>;
  putFavorite: (
    request: FastifyRequest<{ Params: { id: string }; Body: EngagementConcurrencyBody }>,
    reply: FastifyReply,
  ) => Promise<void>;
  deleteFavorite: (
    request: FastifyRequest<{
      Params: { id: string };
      Querystring: { expectedUpdatedAt?: string };
    }>,
    reply: FastifyReply,
  ) => Promise<void>;
  putRating: (
    request: FastifyRequest<{ Params: { id: string }; Body: PutRatingBody }>,
    reply: FastifyReply,
  ) => Promise<void>;
  deleteRating: (
    request: FastifyRequest<{
      Params: { id: string };
      Querystring: { expectedUpdatedAt?: string };
    }>,
    reply: FastifyReply,
  ) => Promise<void>;
  putReviewState: (
    request: FastifyRequest<{ Params: { id: string }; Body: PutReviewStateBody }>,
    reply: FastifyReply,
  ) => Promise<void>;
  listNotes: (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) => Promise<void>;
  createNote: (
    request: FastifyRequest<{ Params: { id: string }; Body: CreateRecipeNoteBody }>,
    reply: FastifyReply,
  ) => Promise<void>;
  updateNote: (
    request: FastifyRequest<{
      Params: { id: string; noteId: string };
      Body: PatchRecipeNoteBody;
    }>,
    reply: FastifyReply,
  ) => Promise<void>;
  deleteNote: (
    request: FastifyRequest<{ Params: { id: string; noteId: string } }>,
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
      const recipe = await service.getByIdForProfile(request.params.id, request.profile.userId);
      reply.send(dataResponse(serializeRecipeDetail(recipe)));
    },

    list: async (
      request: FastifyRequest<{ Querystring: ListRecipesQuery }>,
      reply: FastifyReply,
    ): Promise<void> => {
      const { items, meta } = await service.list(request.query, request.profile.userId);

      reply.send(collectionResponse(items.map(serializeRecipeListItem), meta));
    },

    patch: async (
      request: FastifyRequest<{ Params: { id: string }; Body: PatchRecipeBody }>,
      reply: FastifyReply,
    ): Promise<void> => {
      const recipe = await service.updateForProfile(
        request.params.id,
        request.profile.userId,
        request.body,
      );
      reply.send(dataResponse(serializeRecipeDetail(recipe)));
    },

    listRevisions: async (request, reply): Promise<void> => {
      const revisions = await service.listRevisions(request.params.id, request.profile.userId);
      reply.send(
        collectionResponse(
          revisions.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() })),
          { page: 1, pageSize: revisions.length, total: revisions.length, totalPages: 1 },
        ),
      );
    },

    getRevision: async (request, reply): Promise<void> => {
      const revision = await service.getRevision(
        request.params.id,
        request.params.revisionId,
        request.profile.userId,
      );
      reply.send(
        dataResponse({
          ...serializeRecipeDetail(revision),
          summary: revision.summary,
          changes: revision.changes,
        }),
      );
    },

    restoreRevision: async (request, reply): Promise<void> => {
      const recipe = await service.restoreRevision(
        request.params.id,
        request.params.revisionId,
        request.profile.userId,
        request.body.expectedRevisionNumber,
      );
      reply.send(dataResponse(serializeRecipeDetail(recipe)));
    },

    putFavorite: async (request, reply): Promise<void> => {
      const engagement = await service.setFavorite(
        request.params.id,
        request.profile.userId,
        true,
        parseExpectedUpdatedAt(request.body.expectedUpdatedAt),
      );
      reply.send(dataResponse(serializeEngagement(engagement)));
    },

    deleteFavorite: async (request, reply): Promise<void> => {
      const engagement = await service.setFavorite(
        request.params.id,
        request.profile.userId,
        false,
        parseExpectedUpdatedAt(request.query.expectedUpdatedAt),
      );
      reply.send(dataResponse(serializeEngagement(engagement)));
    },

    putRating: async (request, reply): Promise<void> => {
      const engagement = await service.setRating(
        request.params.id,
        request.profile.userId,
        request.body.rating,
        parseExpectedUpdatedAt(request.body.expectedUpdatedAt),
      );
      reply.send(dataResponse(serializeEngagement(engagement)));
    },

    deleteRating: async (request, reply): Promise<void> => {
      const engagement = await service.setRating(
        request.params.id,
        request.profile.userId,
        null,
        parseExpectedUpdatedAt(request.query.expectedUpdatedAt),
      );
      reply.send(dataResponse(serializeEngagement(engagement)));
    },

    putReviewState: async (request, reply): Promise<void> => {
      const engagement = await service.setReviewState(
        request.params.id,
        request.profile.userId,
        request.body.reviewState,
        parseExpectedUpdatedAt(request.body.expectedUpdatedAt),
      );
      reply.send(dataResponse(serializeEngagement(engagement)));
    },

    listNotes: async (request, reply): Promise<void> => {
      const notes = await service.listNotes(request.params.id, request.profile.userId);
      reply.send(
        collectionResponse(notes.map(serializeNote), {
          page: 1,
          pageSize: notes.length,
          total: notes.length,
          totalPages: 1,
        }),
      );
    },

    createNote: async (request, reply): Promise<void> => {
      const note = await service.createNote(request.params.id, request.profile.userId, {
        body: request.body.body,
        ...(request.body.cookSessionId !== undefined
          ? { cookSessionId: request.body.cookSessionId }
          : {}),
      });
      reply.code(201).send(dataResponse(serializeNote(note)));
    },

    updateNote: async (request, reply): Promise<void> => {
      const note = await service.updateNote(
        request.params.id,
        request.params.noteId,
        request.profile.userId,
        {
          ...(request.body.body !== undefined ? { body: request.body.body } : {}),
          ...(request.body.cookSessionId !== undefined
            ? { cookSessionId: request.body.cookSessionId }
            : {}),
        },
      );
      reply.send(dataResponse(serializeNote(note)));
    },

    deleteNote: async (request, reply): Promise<void> => {
      await service.deleteNote(request.params.id, request.params.noteId, request.profile.userId);
      reply.send(dataResponse({ id: request.params.noteId, deleted: true as const }));
    },

    delete: async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply,
    ): Promise<void> => {
      await service.deleteForProfile(request.params.id, request.profile.userId);
      reply.send(dataResponse({ id: request.params.id, deleted: true as const }));
    },
  };
}
