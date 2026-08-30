import { placeholderPairs } from '@/theme/tokens';
import type {
  Difficulty,
  IngredientCategory,
  RecipeIngredientView,
  RecipeListItemView,
  RecipeStepView,
  RecipeView,
  StepStage,
} from '@/features/recipes/types';
import type {
  RecipeDetailDto,
  RecipeIngredientDto,
  RecipeStepDto,
} from '@/features/recipes/schemas';

const SOURCE_LABELS: Record<string, string> = {
  INSTAGRAM: 'Instagram',
  YOUTUBE: 'YouTube',
  TIKTOK: 'TikTok',
  FACEBOOK: 'Facebook',
  GENERIC_WEB: 'Website',
};

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

const INGREDIENT_CATEGORIES = new Set<string>([
  'Produce',
  'Meat',
  'Dairy',
  'Pantry',
  'Spices',
  'Frozen',
]);

const STEP_STAGES = new Set<string>(['PREP', 'COOK', 'FINISH', 'SERVE']);

const MEAT = [
  'chicken',
  'thigh',
  'beef',
  'pork',
  'lamb',
  'fish',
  'salmon',
  'shrimp',
];
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

export function coerceQuantity(value: string | number | null): number | null {
  if (value === null) {
    return null;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function difficultyFromMinutes(minutes: number): Difficulty {
  if (minutes < 30) {
    return 'Easy';
  }
  if (minutes <= 50) {
    return 'Medium';
  }
  return 'Hard';
}

export function sourceLabelFromType(sourceType: string | undefined): string {
  if (!sourceType) {
    return 'Website';
  }
  return SOURCE_LABELS[sourceType] ?? sourceType;
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

function cuisineFromText(title: string, metadata: unknown): string {
  const blob = `${title} ${JSON.stringify(metadata ?? {})}`.toLowerCase();
  for (const [word, cuisine] of Object.entries(CUISINE_WORDS)) {
    if (blob.includes(word)) {
      return cuisine;
    }
  }
  return 'Imported';
}

function metadataRecord(metadata: unknown): Record<string, unknown> {
  if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
    return metadata as Record<string, unknown>;
  }
  return {};
}

function stringField(
  record: Record<string, unknown>,
  ...keys: string[]
): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
  }
  return null;
}

function asIngredientCategory(value: string): IngredientCategory | null {
  return INGREDIENT_CATEGORIES.has(value)
    ? (value as IngredientCategory)
    : null;
}

function asStepStage(value: string): StepStage | null {
  return STEP_STAGES.has(value) ? (value as StepStage) : null;
}

function stageForIndex(index: number, total: number): StepStage {
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

function hintFromIngredients(
  instruction: string,
  ingredients: RecipeIngredientView[],
): string | null {
  const hintParts = ingredients
    .filter((ing) =>
      instruction
        .toLowerCase()
        .includes(ing.name.split(',')[0]?.toLowerCase() ?? ''),
    )
    .slice(0, 2)
    .map((ing) => {
      const qty = ing.quantity ?? '';
      const unit = ing.unit ? ` ${ing.unit}` : '';
      return `${qty}${unit} ${ing.name}`.trim();
    });

  return hintParts.length ? hintParts.join('|') : null;
}

function mapIngredient(ingredient: RecipeIngredientDto): RecipeIngredientView {
  return {
    id: ingredient.id,
    name: ingredient.name,
    quantity: coerceQuantity(ingredient.quantity),
    unit: ingredient.unit,
    preparation: ingredient.preparation,
    optional: ingredient.optional,
    category:
      asIngredientCategory(ingredient.category) ??
      categorizeIngredient(ingredient.name),
    confidence: ingredient.confidence,
  };
}

function mapStep(
  step: RecipeStepDto,
  index: number,
  total: number,
  ingredients: RecipeIngredientView[],
): RecipeStepView {
  return {
    id: step.id,
    stepOrder: step.stepOrder,
    instruction: step.instruction,
    durationSeconds:
      step.durationMinutes === null ? null : step.durationMinutes * 60,
    temperature: step.temperature,
    stage: asStepStage(step.stage) ?? stageForIndex(index, total),
    ingredientHint:
      step.ingredientHint ?? hintFromIngredients(step.instruction, ingredients),
    confidence: step.confidence,
  };
}

function placeholderForId(id: string): [string, string] {
  const hash = id.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return (
    placeholderPairs[hash % placeholderPairs.length] ?? ['#E6D9C4', '#DCCBB0']
  );
}

function minutesFromDetail(dto: RecipeDetailDto): number {
  if (dto.minutes != null) {
    return dto.minutes || 30;
  }
  const summedTimes = (dto.prepTimeMinutes ?? 0) + (dto.cookTimeMinutes ?? 0);
  const minutes = dto.totalTimeMinutes ?? (summedTimes > 0 ? summedTimes : 30);
  return minutes || 30;
}

export function mapRecipeDetail(dto: RecipeDetailDto): RecipeView {
  const minutes = minutesFromDetail(dto);
  const sourceType = dto.source?.sourceType ?? 'GENERIC_WEB';
  const sourceLabel =
    dto.source?.sourceLabel || sourceLabelFromType(sourceType);
  const meta = metadataRecord(dto.source?.metadata);
  const ingredients = [...dto.ingredients]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(mapIngredient);
  const sortedSteps = [...dto.steps].sort((a, b) => a.stepOrder - b.stepOrder);

  return {
    id: dto.id,
    origin: 'api',
    title: dto.title,
    description: dto.description,
    sourceType,
    sourceLabel,
    creator:
      dto.source?.author ||
      stringField(meta, 'author', 'uploader', 'creator') ||
      sourceLabel,
    originalUrl: dto.source?.originalUrl ?? null,
    thumbnailUrl:
      dto.source?.thumbnailUrl ||
      stringField(meta, 'thumbnailUrl', 'thumbnail'),
    placeholder: placeholderForId(dto.id),
    minutes,
    difficulty: dto.difficulty ?? difficultyFromMinutes(minutes),
    servings: dto.servings ?? 4,
    cuisine:
      dto.cuisine ||
      cuisineFromText(
        `${dto.title} ${dto.description ?? ''}`,
        dto.source?.metadata,
      ),
    calories: dto.calories,
    confidence: dto.confidence,
    warnings: dto.warnings,
    ingredients,
    steps: sortedSteps.map((step, index) =>
      mapStep(step, index, sortedSteps.length, ingredients),
    ),
    createdAt: dto.createdAt,
  };
}

export function mapRecipeListItem(dto: RecipeListItemView): RecipeView {
  const minutes = dto.minutes ?? 30;
  const sourceLabel = dto.sourceLabel || sourceLabelFromType(dto.sourceType);

  return {
    id: dto.id,
    origin: 'api',
    title: dto.title,
    description: dto.description,
    sourceType: dto.sourceType,
    sourceLabel,
    creator: dto.creator || sourceLabel,
    originalUrl: dto.originalUrl,
    thumbnailUrl: dto.thumbnailUrl,
    placeholder: placeholderForId(dto.id),
    minutes,
    difficulty: dto.difficulty ?? difficultyFromMinutes(minutes),
    servings: dto.servings ?? 4,
    cuisine: dto.cuisine ?? 'Imported',
    calories: dto.calories,
    confidence: dto.confidence,
    warnings: [],
    ingredients: [],
    steps: [],
    ingredientCount: dto.ingredientCount,
    stepCount: dto.stepCount,
    createdAt: dto.createdAt,
  };
}
