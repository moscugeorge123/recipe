import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

import {
  errorResponseSchema,
  standardErrorResponses,
} from '../../../shared/errors/error-response.js';
import {
  collectionResponse,
  collectionResponseSchema,
  dataResponse,
  dataResponseSchema,
} from '../../../shared/http/response.js';
import { dbUuid } from '../../../shared/validation/uuid.js';
import type { RecipeService } from '../../recipes/application/recipe-service.js';
import { recipeIdParamsSchema } from '../../recipes/api/recipes.schema.js';
import type { CategoryService } from '../application/category-service.js';
import {
  assignRecipeCategoriesBodySchema,
  categoryIdParamsSchema,
  categorySchema,
  createCategoryBodySchema,
  renameCategoryBodySchema,
} from './categories.schema.js';

export interface CategoriesRoutesOptions {
  categoryService: CategoryService;
  recipeService: RecipeService;
}

export const categoriesRoutes: FastifyPluginAsyncZod<CategoriesRoutesOptions> = async (
  app,
  opts,
) => {
  app.get(
    '/categories',
    {
      schema: {
        tags: ['categories'],
        summary: 'List profile categories',
        response: { 200: collectionResponseSchema(categorySchema), ...standardErrorResponses },
      },
    },
    async (request, reply) => {
      const categories = await opts.categoryService.list(request.profile.userId);
      reply.send(
        collectionResponse(categories, {
          page: 1,
          pageSize: categories.length,
          total: categories.length,
          totalPages: 1,
        }),
      );
    },
  );

  app.post(
    '/categories',
    {
      schema: {
        tags: ['categories'],
        summary: 'Create a profile category',
        body: createCategoryBodySchema,
        response: {
          201: dataResponseSchema(categorySchema),
          409: errorResponseSchema,
          ...standardErrorResponses,
        },
      },
    },
    async (request, reply) => {
      const category = await opts.categoryService.create(request.profile.userId, request.body.name);
      reply.status(201).send(dataResponse(category));
    },
  );

  app.patch(
    '/categories/:categoryId',
    {
      schema: {
        tags: ['categories'],
        summary: 'Rename a category without changing its stable slug',
        params: categoryIdParamsSchema,
        body: renameCategoryBodySchema,
        response: {
          200: dataResponseSchema(categorySchema),
          404: errorResponseSchema,
          ...standardErrorResponses,
        },
      },
    },
    async (request, reply) => {
      const category = await opts.categoryService.rename(
        request.profile.userId,
        request.params.categoryId,
        request.body.name,
      );
      reply.send(dataResponse(category));
    },
  );

  app.delete(
    '/categories/:categoryId',
    {
      schema: {
        tags: ['categories'],
        summary: 'Delete a custom category without deleting recipes',
        params: categoryIdParamsSchema,
        response: {
          200: dataResponseSchema(categoryIdParamsSchema.extend({ deleted: z.literal(true) })),
          404: errorResponseSchema,
          ...standardErrorResponses,
        },
      },
    },
    async (request, reply) => {
      await opts.categoryService.delete(request.profile.userId, request.params.categoryId);
      reply.send(dataResponse({ categoryId: request.params.categoryId, deleted: true }));
    },
  );

  app.put(
    '/recipes/:id/categories',
    {
      schema: {
        tags: ['categories'],
        summary: 'Assign categories by creating a recipe revision',
        params: recipeIdParamsSchema,
        body: assignRecipeCategoriesBodySchema,
        response: {
          200: dataResponseSchema(
            z.object({
              recipeId: dbUuid(),
              revisionNumber: z.number().int().nonnegative(),
              categories: z.array(z.object({ id: dbUuid(), slug: z.string(), name: z.string() })),
            }),
          ),
          404: errorResponseSchema,
          409: errorResponseSchema,
          ...standardErrorResponses,
        },
      },
    },
    async (request, reply) => {
      const recipe = await opts.recipeService.updateForProfile(
        request.params.id,
        request.profile.userId,
        request.body,
      );
      reply.send(
        dataResponse({
          recipeId: recipe.id,
          revisionNumber: recipe.revisionNumber,
          categories: recipe.categories.map(({ id, slug, name }) => ({ id, slug, name })),
        }),
      );
    },
  );
};
