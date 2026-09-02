import type { NutritionValues } from '@recipe/contracts';

import type { FoodPortion, MatchedFood, NutritionProvider, NutritionSearchQuery } from '../../domain/types.js';

interface FakeFood {
  fdcId: string;
  name: string;
  aliases: string[];
  dataType: 'Foundation' | 'SR Legacy';
  nutrientsPer100g: NutritionValues;
  portions: FoodPortion[];
}

const FAKE_FOODS: FakeFood[] = [
  {
    fdcId: 'fake:spaghetti',
    name: 'Pasta, dry, enriched',
    aliases: ['spaghetti', 'pasta', 'noodles'],
    dataType: 'SR Legacy',
    nutrientsPer100g: {
      calories: 371,
      proteinGrams: 13,
      carbohydrateGrams: 74.7,
      fatGrams: 1.5,
      saturatedFatGrams: 0.3,
      fiberGrams: 3.2,
      sugarGrams: 2.7,
      sodiumMilligrams: 6,
    },
    portions: [{ gramWeight: 100, amount: 1, description: 'g' }],
  },
  {
    fdcId: 'fake:olive-oil',
    name: 'Oil, olive, salad or cooking',
    aliases: ['olive oil', 'oil'],
    dataType: 'Foundation',
    nutrientsPer100g: {
      calories: 884,
      proteinGrams: 0,
      carbohydrateGrams: 0,
      fatGrams: 100,
      saturatedFatGrams: 13.8,
      fiberGrams: 0,
      sugarGrams: 0,
      sodiumMilligrams: 2,
    },
    portions: [
      { gramWeight: 13.5, amount: 1, description: 'tbsp' },
      { gramWeight: 4.5, amount: 1, description: 'tsp' },
    ],
  },
  {
    fdcId: 'fake:garlic',
    name: 'Garlic, raw',
    aliases: ['garlic', 'garlic clove'],
    dataType: 'Foundation',
    nutrientsPer100g: {
      calories: 149,
      proteinGrams: 6.4,
      carbohydrateGrams: 33.1,
      fatGrams: 0.5,
      saturatedFatGrams: 0.1,
      fiberGrams: 2.1,
      sugarGrams: 1,
      sodiumMilligrams: 17,
    },
    portions: [{ gramWeight: 3, amount: 1, description: 'clove' }],
  },
  {
    fdcId: 'fake:egg',
    name: 'Egg, whole, raw, fresh',
    aliases: ['egg', 'eggs'],
    dataType: 'Foundation',
    nutrientsPer100g: {
      calories: 143,
      proteinGrams: 12.6,
      carbohydrateGrams: 0.7,
      fatGrams: 9.5,
      saturatedFatGrams: 3.1,
      fiberGrams: 0,
      sugarGrams: 0.4,
      sodiumMilligrams: 142,
    },
    portions: [{ gramWeight: 50, amount: 1, description: 'large' }],
  },
  {
    fdcId: 'fake:milk',
    name: 'Milk, whole, 3.25% milkfat',
    aliases: ['milk', 'whole milk'],
    dataType: 'Foundation',
    nutrientsPer100g: {
      calories: 61,
      proteinGrams: 3.2,
      carbohydrateGrams: 4.8,
      fatGrams: 3.3,
      saturatedFatGrams: 1.9,
      fiberGrams: 0,
      sugarGrams: 5.1,
      sodiumMilligrams: 43,
    },
    portions: [{ gramWeight: 244, amount: 1, description: 'cup' }],
  },
  {
    fdcId: 'fake:flour',
    name: 'Wheat flour, white, all-purpose',
    aliases: ['flour', 'all-purpose flour'],
    dataType: 'SR Legacy',
    nutrientsPer100g: {
      calories: 364,
      proteinGrams: 10.3,
      carbohydrateGrams: 76.3,
      fatGrams: 1,
      saturatedFatGrams: 0.2,
      fiberGrams: 2.7,
      sugarGrams: 0.3,
      sodiumMilligrams: 2,
    },
    portions: [{ gramWeight: 125, amount: 1, description: 'cup' }],
  },
  {
    fdcId: 'fake:butter',
    name: 'Butter, salted',
    aliases: ['butter'],
    dataType: 'Foundation',
    nutrientsPer100g: {
      calories: 717,
      proteinGrams: 0.9,
      carbohydrateGrams: 0.1,
      fatGrams: 81.1,
      saturatedFatGrams: 51.4,
      fiberGrams: 0,
      sugarGrams: 0.1,
      sodiumMilligrams: 643,
    },
    portions: [{ gramWeight: 14.2, amount: 1, description: 'tbsp' }],
  },
  {
    fdcId: 'fake:tomato',
    name: 'Tomatoes, raw',
    aliases: ['tomato', 'tomatoes'],
    dataType: 'Foundation',
    nutrientsPer100g: {
      calories: 18,
      proteinGrams: 0.9,
      carbohydrateGrams: 3.9,
      fatGrams: 0.2,
      saturatedFatGrams: 0,
      fiberGrams: 1.2,
      sugarGrams: 2.6,
      sodiumMilligrams: 5,
    },
    portions: [{ gramWeight: 123, amount: 1, description: 'medium' }],
  },
];

export class FakeNutritionProvider implements NutritionProvider {
  readonly id = 'fake';
  private readonly foods: FakeFood[];
  searchCalls = 0;
  getFoodCalls = 0;

  constructor(foods: FakeFood[] = FAKE_FOODS) {
    this.foods = foods;
  }

  async search(query: NutritionSearchQuery): Promise<MatchedFood | null> {
    this.searchCalls += 1;
    const needle = query.query.toLowerCase().trim();
    const food = this.foods.find(
      (entry) =>
        entry.aliases.some((alias) => needle.includes(alias) || alias.includes(needle)) ||
        entry.name.toLowerCase().includes(needle),
    );
    return food ? this.toMatched(food, 0.85) : null;
  }

  async getFood(fdcId: string): Promise<MatchedFood | null> {
    this.getFoodCalls += 1;
    const food = this.foods.find((entry) => entry.fdcId === fdcId);
    return food ? this.toMatched(food, 0.95) : null;
  }

  private toMatched(food: FakeFood, confidence: number): MatchedFood {
    return {
      fdcId: food.fdcId,
      name: food.name,
      dataType: food.dataType,
      nutrientsPer100g: food.nutrientsPer100g,
      portions: food.portions,
      confidence,
    };
  }
}