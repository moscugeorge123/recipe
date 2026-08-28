export const INGREDIENT_CATEGORIES = [
  'Produce',
  'Meat',
  'Dairy',
  'Pantry',
  'Spices',
  'Frozen',
] as const;

export const STEP_STAGES = ['PREP', 'COOK', 'FINISH', 'SERVE'] as const;

export type IngredientCategory = (typeof INGREDIENT_CATEGORIES)[number];
export type StepStage = (typeof STEP_STAGES)[number];

const CUISINE_WORDS: Record<string, string> = {
  italian: 'Italian',
  korean: 'Korean',
  indian: 'Indian',
  french: 'French',
  chinese: 'Chinese',
  african: 'North African',
  mexican: 'Mexican',
  thai: 'Thai',
  japanese: 'Japanese',
};

const MEAT = ['chicken', 'thigh', 'beef', 'pork', 'lamb', 'fish', 'salmon', 'shrimp'];
const PRODUCE = [
  'lemon',
  'onion',
  'spinach',
  'tomato',
  'basil',
  'ginger',
  'garlic',
  'courgette',
  'zucchini',
  'scallion',
  'spring onion',
  'thyme',
  'chilli',
  'chili',
];
const DAIRY = [
  'butter',
  'pecorino',
  'mozzarella',
  'ricotta',
  'cheese',
  'milk',
  'cream',
  'yoghurt',
  'yogurt',
];
const SPICES = ['cumin', 'chilli flake', 'chili flake', 'harissa', 'pepper'];

export function cuisineFromText(title: string, description?: string | null): string | null {
  const blob = `${title} ${description ?? ''}`.toLowerCase();
  for (const [word, cuisine] of Object.entries(CUISINE_WORDS)) {
    if (blob.includes(word)) {
      return cuisine;
    }
  }
  return null;
}

export function categorizeIngredient(name: string): IngredientCategory {
  const n = name.toLowerCase();
  if (MEAT.some((word) => n.includes(word))) {
    return 'Meat';
  }
  if (DAIRY.some((word) => n.includes(word))) {
    return 'Dairy';
  }
  if (SPICES.some((word) => n.includes(word))) {
    return 'Spices';
  }
  if (PRODUCE.some((word) => n.includes(word))) {
    return 'Produce';
  }
  if (n.includes('frozen')) {
    return 'Frozen';
  }
  return 'Pantry';
}

export function isIngredientCategory(value: unknown): value is string {
  return typeof value === 'string' && (INGREDIENT_CATEGORIES as readonly string[]).includes(value);
}

export function isStepStage(value: unknown): value is string {
  return typeof value === 'string' && (STEP_STAGES as readonly string[]).includes(value);
}

export function stageForIndex(index: number, total: number): StepStage {
  if (total <= 1) {
    return 'COOK';
  }
  const ratio = index / (total - 1);
  if (ratio < 1 / 3) {
    return 'PREP';
  }
  if (ratio < 2 / 3) {
    return 'COOK';
  }
  if (index === total - 1) {
    return 'SERVE';
  }
  return 'FINISH';
}
