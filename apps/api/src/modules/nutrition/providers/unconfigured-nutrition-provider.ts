import type { MatchedFood, NutritionProvider, NutritionSearchQuery } from '../domain/types.js';

/** Used when USDA_FDC_API_KEY is unset. Never invents foods or nutrients. */
export class UnconfiguredNutritionProvider implements NutritionProvider {
  readonly id = 'unconfigured';

  async search(_query: NutritionSearchQuery): Promise<MatchedFood | null> {
    void _query;
    return null;
  }

  async getFood(_fdcId: string): Promise<MatchedFood | null> {
    void _fdcId;
    return null;
  }
}