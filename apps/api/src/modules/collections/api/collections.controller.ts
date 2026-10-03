import type { FastifyReply, FastifyRequest } from 'fastify';

import { collectionResponse, dataResponse } from '../../../shared/http/response.js';
import {
  authorFromMetadata,
  creatorFromSource,
  difficultyFromMinutes,
  minutesFromTimes,
  sourceLabelFromType,
  thumbnailFromMetadata,
} from '../../recipes/application/recipe-presentation.js';
import type { CollectionService, CollectionView } from '../application/collection-service.js';
import type { CollectionRecord } from '../repository/collection.repository.js';
import type {
  AddCollectionRecipeBody,
  CreateCollectionBody,
  ListCollectionsQuery,
  PatchCollectionBody,
  ReorderCollectionRecipesBody,
} from './collections.schema.js';

function serializeMember(
  item: CollectionView['recipes'][number],
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
    sortOrder: item.sortOrder,
  };
}

function serializeSummary(item: CollectionRecord): Record<string, unknown> {
  return {
    id: item.id,
    name: item.name,
    description: item.description,
    recipeCount: item.recipeCount,
    recipeIds: item.recipeIds,
    coverPreviews: item.coverPreviews,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

function serializeDetail(item: CollectionView): Record<string, unknown> {
  return {
    ...serializeSummary(item),
    recipes: item.recipes.map(serializeMember),
  };
}

export function createCollectionsController(service: CollectionService): {
  list: (
    request: FastifyRequest<{ Querystring: ListCollectionsQuery }>,
    reply: FastifyReply,
  ) => Promise<void>;
  create: (
    request: FastifyRequest<{ Body: CreateCollectionBody }>,
    reply: FastifyReply,
  ) => Promise<void>;
  getById: (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) => Promise<void>;
  patch: (
    request: FastifyRequest<{ Params: { id: string }; Body: PatchCollectionBody }>,
    reply: FastifyReply,
  ) => Promise<void>;
  delete: (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) => Promise<void>;
  addRecipe: (
    request: FastifyRequest<{ Params: { id: string }; Body: AddCollectionRecipeBody }>,
    reply: FastifyReply,
  ) => Promise<void>;
  removeRecipe: (
    request: FastifyRequest<{ Params: { id: string; recipeId: string } }>,
    reply: FastifyReply,
  ) => Promise<void>;
  reorder: (
    request: FastifyRequest<{ Params: { id: string }; Body: ReorderCollectionRecipesBody }>,
    reply: FastifyReply,
  ) => Promise<void>;
} {
  return {
    list: async (request, reply): Promise<void> => {
      const { items, meta } = await service.list(request.profile.userId, request.query);
      reply.send(collectionResponse(items.map(serializeSummary), meta));
    },
    create: async (request, reply): Promise<void> => {
      request.log.info({ step: 'http.collection.create' }, 'http.collection.create started');
      const collection = await service.create(request.profile.userId, request.body);
      request.log.info(
        { step: 'http.collection.create', collectionId: collection.id },
        'http.collection.create completed',
      );
      reply.status(201).send(dataResponse(serializeDetail(collection)));
    },
    getById: async (request, reply): Promise<void> => {
      const collection = await service.getById(request.profile.userId, request.params.id);
      reply.send(dataResponse(serializeDetail(collection)));
    },
    patch: async (request, reply): Promise<void> => {
      const collection = await service.update(
        request.profile.userId,
        request.params.id,
        request.body,
      );
      reply.send(dataResponse(serializeDetail(collection)));
    },
    delete: async (request, reply): Promise<void> => {
      await service.delete(request.profile.userId, request.params.id);
      reply.send(dataResponse({ id: request.params.id, deleted: true as const }));
    },
    addRecipe: async (request, reply): Promise<void> => {
      const { collection, created } = await service.addRecipe(
        request.profile.userId,
        request.params.id,
        request.body,
      );
      reply.status(created ? 201 : 200).send(dataResponse(serializeDetail(collection)));
    },
    removeRecipe: async (request, reply): Promise<void> => {
      const collection = await service.removeRecipe(
        request.profile.userId,
        request.params.id,
        request.params.recipeId,
      );
      reply.send(dataResponse(serializeDetail(collection)));
    },
    reorder: async (request, reply): Promise<void> => {
      const collection = await service.reorder(
        request.profile.userId,
        request.params.id,
        request.body,
      );
      reply.send(dataResponse(serializeDetail(collection)));
    },
  };
}
