import type { FastifyReply, FastifyRequest } from 'fastify';

import { dataResponse } from '../../../shared/http/response.js';
import type { NutritionService, NutritionView } from '../application/nutrition-service.js';
import type { CorrectNutritionMatchBody } from './nutrition.schema.js';

function serializeNutrition(view: NutritionView): NutritionView {
  return view;
}

export function createNutritionController(service: NutritionService): {
  get: (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => Promise<void>;
  recalculate: (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) => Promise<void>;
  correctMatch: (
    request: FastifyRequest<{ Params: { id: string }; Body: CorrectNutritionMatchBody }>,
    reply: FastifyReply,
  ) => Promise<void>;
} {
  return {
    get: async (request, reply): Promise<void> => {
      const view = await service.getForRecipe(request.params.id, request.profile.userId);
      reply.send(dataResponse(serializeNutrition(view)));
    },
    recalculate: async (request, reply): Promise<void> => {
      request.log.info(
        { step: 'http.nutrition.recalculate', recipeId: request.params.id },
        'http.nutrition.recalculate started',
      );
      const view = await service.recalculate(request.params.id, request.profile.userId);
      reply.send(dataResponse(serializeNutrition(view)));
    },
    correctMatch: async (request, reply): Promise<void> => {
      request.log.info(
        {
          step: 'http.nutrition.correct-match',
          recipeId: request.params.id,
          ingredientId: request.body.ingredientId,
        },
        'http.nutrition.correct-match started',
      );
      const view = await service.correctMatch(request.params.id, request.profile.userId, request.body);
      reply.send(dataResponse(serializeNutrition(view)));
    },
  };
}