import type { NutritionValues } from '@recipe/contracts';

import { normalizeIngredientName } from '../../normalization/domain/units.js';
import { convertToGrams, parseQuantityNumber } from '../domain/conversions.js';
import {
  addNutrition,
  divideNutrition,
  nutritionHasAnyValue,
  scaleNutrition,
} from '../domain/nutrients.js';
import type {
  CalculatedMatch,
  IngredientToMatch,
  MatchedFood,
  NutritionCalculation,
  NutritionProvider,
} from '../domain/types.js';
import type { NutritionCache } from './memory-nutrition-cache.js';

export function normalizeNutritionQuery(name: string): string {
  return normalizeIngredientName(name).replace(/\s+/g, ' ').trim();
}

export class NutritionCalculator {
  constructor(
    private readonly provider: NutritionProvider,
    private readonly cache: NutritionCache,
  ) {}

  async calculate(
    ingredients: IngredientToMatch[],
    servings: number | null,
  ): Promise<NutritionCalculation> {
    const matches: CalculatedMatch[] = [];
    const unmatchedIngredients: string[] = [];
    let wholeRecipe: NutritionValues = {};
    let totalGrams = 0;
    let matchedCount = 0;

    for (const ingredient of ingredients) {
      const query = normalizeNutritionQuery(ingredient.canonicalName ?? ingredient.name);
      const food = query ? await this.resolveFood(query) : null;
      const quantity = parseQuantityNumber(ingredient.quantity);
      const conversion = convertToGrams({
        quantity,
        unit: ingredient.unit,
        ingredientName: ingredient.canonicalName ?? ingredient.name,
        ...(food ? { portions: food.portions } : {}),
      });

      if (!food || !conversion.ok) {
        unmatchedIngredients.push(ingredient.name);
        matches.push({
          ingredientId: ingredient.id,
          query,
          matchedFoodId: food?.fdcId ?? null,
          matchedFoodName: food?.name ?? null,
          confidence: food?.confidence ?? null,
          grams: null,
          nutrients: null,
          unmatched: true,
        });
        continue;
      }

      const nutrients = scaleNutrition(food.nutrientsPer100g, conversion.grams / 100);
      wholeRecipe = addNutrition(wholeRecipe, nutrients);
      totalGrams += conversion.grams;
      matchedCount += 1;
      matches.push({
        ingredientId: ingredient.id,
        query,
        matchedFoodId: food.fdcId,
        matchedFoodName: food.name,
        confidence: food.confidence,
        grams: conversion.grams,
        nutrients,
        unmatched: false,
      });
    }

    const totalCount = ingredients.length;
    const coveragePercent = totalCount === 0 ? 0 : Math.round((matchedCount / totalCount) * 10000) / 100;
    const hasTotals = nutritionHasAnyValue(wholeRecipe);
    const perServing = servings !== null && servings > 0 ? divideNutrition(wholeRecipe, servings) : null;
    const per100g = totalGrams > 0 ? divideNutrition(wholeRecipe, totalGrams / 100) : null;

    let status: NutritionCalculation['status'];
    let failureReason: string | null = null;
    if (totalCount === 0) {
      status = 'FAILED';
      failureReason = 'Recipe has no ingredients to calculate';
    } else if (matchedCount === 0) {
      status = 'FAILED';
      failureReason =
        this.provider.id === 'unconfigured'
          ? 'Nutrition provider is not configured'
          : 'No ingredients could be matched or converted to a known weight';
    } else if (matchedCount < totalCount) {
      status = 'PARTIAL';
    } else {
      status = 'COMPLETED';
    }

    return {
      status,
      servings,
      wholeRecipe: hasTotals ? wholeRecipe : null,
      perServing,
      per100g,
      totalGrams: totalGrams > 0 ? Math.round(totalGrams * 10) / 10 : null,
      coveragePercent,
      matchedCount,
      totalCount,
      unmatchedIngredients,
      matches,
      failureReason,
      provider: this.provider.id,
      calculatedAt: new Date(),
    };
  }

  async resolveFood(query: string): Promise<MatchedFood | null> {
    const cachedQuery = await this.cache.findQueryCache(query);
    if (cachedQuery?.fdcId) {
      const byId = await this.resolveByFdcId(cachedQuery.fdcId);
      if (byId) {
        return byId;
      }
    }

    const searched = await this.provider.search({ query });
    await this.cache.upsertQueryCache({
      query,
      fdcId: searched?.fdcId ?? null,
      matchedName: searched?.name ?? null,
      dataType: searched?.dataType ?? null,
    });
    if (!searched) {
      return null;
    }
    await this.cache.upsertFoodCache(searched);
    return searched;
  }

  async resolveByFdcId(fdcId: string): Promise<MatchedFood | null> {
    const cachedFood = await this.cache.findFoodCache(fdcId);
    if (cachedFood) {
      return cachedFood;
    }
    const fetched = await this.provider.getFood(fdcId);
    if (fetched) {
      await this.cache.upsertFoodCache(fetched);
    }
    return fetched;
  }
}