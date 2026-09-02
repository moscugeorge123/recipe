import type { NutritionValues } from '@recipe/contracts';

import { FDC_NUTRIENT_IDS, type NutrientKey } from '../../domain/nutrients.js';
import {
  NutritionRateLimitError,
  type FoodPortion,
  type MatchedFood,
  type NutritionProvider,
  type NutritionSearchQuery,
} from '../../domain/types.js';

const FDC_BASE_URL = 'https://api.nal.usda.gov/fdc/v1';
const PREFERRED_DATA_TYPES = ['Foundation', 'SR Legacy'] as const;

export interface UsdaFdcProviderOptions {
  apiKey: string;
  fetchImpl?: typeof fetch;
  maxRetries?: number;
  backoffMs?: number;
  maxBackoffMs?: number;
}

interface FdcNutrientEntry {
  amount?: number;
  nutrient?: {
    id?: number;
    number?: string;
    name?: string;
    unitName?: string;
  };
}

interface FdcPortionEntry {
  gramWeight?: number;
  amount?: number;
  modifier?: string;
  portionDescription?: string;
  measureUnit?: { name?: string };
}

interface FdcFood {
  fdcId?: number;
  description?: string;
  dataType?: string;
  score?: number;
  foodNutrients?: FdcNutrientEntry[];
  foodPortions?: FdcPortionEntry[];
}

interface FdcSearchResponse {
  foods?: FdcFood[];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function nutrientAmount(entries: FdcNutrientEntry[] | undefined, key: NutrientKey): number | undefined {
  if (!entries) {
    return undefined;
  }
  const ids = new Set(FDC_NUTRIENT_IDS[key]);
  for (const entry of entries) {
    const id = entry.nutrient?.id;
    const number = entry.nutrient?.number ? Number(entry.nutrient.number) : Number.NaN;
    if ((id !== undefined && ids.has(id)) || (Number.isFinite(number) && ids.has(number))) {
      const amount = entry.amount;
      if (typeof amount !== 'number' || !Number.isFinite(amount)) {
        continue;
      }
      const unit = entry.nutrient?.unitName?.toUpperCase() ?? '';
      if (key === 'calories' && unit === 'KJ') {
        return amount / 4.184;
      }
      return amount;
    }
  }
  return undefined;
}

export function nutrientsFromFdc(entries: FdcNutrientEntry[] | undefined): NutritionValues {
  const values: NutritionValues = {};
  const calories = nutrientAmount(entries, 'calories');
  const protein = nutrientAmount(entries, 'proteinGrams');
  const carbs = nutrientAmount(entries, 'carbohydrateGrams');
  const fat = nutrientAmount(entries, 'fatGrams');
  const satFat = nutrientAmount(entries, 'saturatedFatGrams');
  const fiber = nutrientAmount(entries, 'fiberGrams');
  const sugar = nutrientAmount(entries, 'sugarGrams');
  const sodium = nutrientAmount(entries, 'sodiumMilligrams');
  if (calories !== undefined) values.calories = calories;
  if (protein !== undefined) values.proteinGrams = protein;
  if (carbs !== undefined) values.carbohydrateGrams = carbs;
  if (fat !== undefined) values.fatGrams = fat;
  if (satFat !== undefined) values.saturatedFatGrams = satFat;
  if (fiber !== undefined) values.fiberGrams = fiber;
  if (sugar !== undefined) values.sugarGrams = sugar;
  if (sodium !== undefined) values.sodiumMilligrams = sodium;
  return values;
}

export function portionsFromFdc(entries: FdcPortionEntry[] | undefined): FoodPortion[] {
  if (!entries) {
    return [];
  }
  const portions: FoodPortion[] = [];
  for (const entry of entries) {
    if (typeof entry.gramWeight !== 'number' || !(entry.gramWeight > 0)) {
      continue;
    }
    const amount = typeof entry.amount === 'number' && entry.amount > 0 ? entry.amount : 1;
    const description = [entry.measureUnit?.name, entry.modifier, entry.portionDescription]
      .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
      .join(' ');
    portions.push({
      gramWeight: entry.gramWeight,
      amount,
      description: description || 'portion',
    });
  }
  return portions;
}

function rankFoods(foods: FdcFood[]): FdcFood[] {
  const preferred = new Set<string>(PREFERRED_DATA_TYPES);
  return [...foods]
    .filter((food) => food.fdcId !== undefined && food.dataType !== undefined && preferred.has(food.dataType))
    .sort((a, b) => {
      const aFoundation = a.dataType === 'Foundation' ? 0 : 1;
      const bFoundation = b.dataType === 'Foundation' ? 0 : 1;
      if (aFoundation !== bFoundation) {
        return aFoundation - bFoundation;
      }
      return (b.score ?? 0) - (a.score ?? 0);
    });
}

function toMatchedFood(food: FdcFood, confidence: number): MatchedFood | null {
  if (food.fdcId === undefined || !food.description || !food.dataType) {
    return null;
  }
  return {
    fdcId: String(food.fdcId),
    name: food.description,
    dataType: food.dataType,
    nutrientsPer100g: nutrientsFromFdc(food.foodNutrients),
    portions: portionsFromFdc(food.foodPortions),
    confidence,
  };
}

export class UsdaFdcProvider implements NutritionProvider {
  readonly id = 'usda-fdc';
  private readonly fetchImpl: typeof fetch;
  private readonly maxRetries: number;
  private readonly backoffMs: number;
  private readonly maxBackoffMs: number;

  constructor(private readonly options: UsdaFdcProviderOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.maxRetries = options.maxRetries ?? 3;
    this.backoffMs = options.backoffMs ?? 250;
    this.maxBackoffMs = options.maxBackoffMs ?? 2000;
  }

  async search(query: NutritionSearchQuery): Promise<MatchedFood | null> {
    const trimmed = query.query.trim();
    if (!trimmed) {
      return null;
    }
    const url = `${FDC_BASE_URL}/foods/search?api_key=${encodeURIComponent(this.options.apiKey)}`;
    const response = await this.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        query: trimmed,
        dataType: [...PREFERRED_DATA_TYPES],
        pageSize: 8,
      }),
    });
    if (!response.ok) {
      throw new Error(`USDA search failed with status ${String(response.status)}`);
    }
    const body = (await response.json()) as FdcSearchResponse;
    const ranked = rankFoods(body.foods ?? []);
    const top = ranked[0];
    if (!top) {
      return null;
    }
    const matched = toMatchedFood(top, top.dataType === 'Foundation' ? 0.9 : 0.75);
    if (!matched) {
      return null;
    }
    if (Object.keys(matched.nutrientsPer100g).length === 0 || matched.portions.length === 0) {
      return this.getFood(matched.fdcId);
    }
    return matched;
  }

  async getFood(fdcId: string): Promise<MatchedFood | null> {
    const url = `${FDC_BASE_URL}/food/${encodeURIComponent(fdcId)}?api_key=${encodeURIComponent(this.options.apiKey)}`;
    const response = await this.request(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new Error(`USDA food lookup failed with status ${String(response.status)}`);
    }
    const food = (await response.json()) as FdcFood;
    return toMatchedFood(food, food.dataType === 'Foundation' ? 0.9 : 0.75);
  }

  private async request(url: string, init: RequestInit): Promise<Response> {
    const maxAttempts = this.maxRetries + 1;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const response = await this.fetchImpl(url, init);
      if (response.status !== 429) {
        return response;
      }
      if (attempt === maxAttempts - 1) {
        throw new NutritionRateLimitError();
      }
      const retryAfter = response.headers.get('retry-after');
      const parsedRetry =
        retryAfter !== null && /^\d+$/.test(retryAfter) ? Number(retryAfter) * 1000 : undefined;
      const exponential = this.backoffMs * 2 ** attempt;
      const delay = Math.min(parsedRetry ?? exponential, this.maxBackoffMs);
      await sleep(delay);
    }
    throw new NutritionRateLimitError();
  }
}