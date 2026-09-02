import type {
  INutritionRepository,
  NutritionQueryCacheRecord,
} from '../../../infrastructure/database/repositories/nutrition.repository.js';
import type { MatchedFood } from '../domain/types.js';

export type NutritionCache = Pick<
  INutritionRepository,
  'findQueryCache' | 'upsertQueryCache' | 'findFoodCache' | 'upsertFoodCache'
>;

/** In-memory nutrition cache for calculator unit tests. */
export class InMemoryNutritionCache implements NutritionCache {
  readonly queries = new Map<string, NutritionQueryCacheRecord>();
  readonly foods = new Map<string, MatchedFood>();

  async findQueryCache(query: string): Promise<NutritionQueryCacheRecord | null> {
    return this.queries.get(query) ?? null;
  }

  async upsertQueryCache(input: NutritionQueryCacheRecord): Promise<void> {
    this.queries.set(input.query, input);
  }

  async findFoodCache(fdcId: string): Promise<MatchedFood | null> {
    return this.foods.get(fdcId) ?? null;
  }

  async upsertFoodCache(food: MatchedFood): Promise<void> {
    this.foods.set(food.fdcId, food);
  }
}