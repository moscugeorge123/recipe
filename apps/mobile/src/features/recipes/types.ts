export type RecipeId = string;
export type RecipeOrigin = 'seed' | 'api';
export type Difficulty = 'Easy' | 'Medium' | 'Hard';
export type StepStage = 'PREP' | 'COOK' | 'FINISH' | 'SERVE';
export type IngredientCategory =
  'Produce' | 'Meat' | 'Dairy' | 'Pantry' | 'Spices' | 'Frozen';

export type RecipeIngredientView = {
  id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  preparation: string | null;
  optional: boolean;
  category: IngredientCategory;
  confidence: number;
};

export type RecipeStepView = {
  id: string;
  stepOrder: number;
  instruction: string;
  durationSeconds: number | null;
  temperature: string | null;
  stage: StepStage;
  ingredientHint: string | null;
  confidence: number;
};

export type RecipeView = {
  id: RecipeId;
  origin: RecipeOrigin;
  title: string;
  description: string | null;
  sourceType: string;
  sourceLabel: string;
  creator: string;
  originalUrl: string | null;
  thumbnailUrl: string | null;
  placeholder: [string, string];
  minutes: number;
  difficulty: Difficulty;
  servings: number;
  cuisine: string;
  calories: number | null;
  confidence: number;
  warnings: unknown;
  ingredients: RecipeIngredientView[];
  steps: RecipeStepView[];
  ingredientCount?: number;
  stepCount?: number;
  createdAt?: string;
};

export type RecipeListItemView = {
  id: RecipeId;
  title: string;
  description: string | null;
  confidence: number;
  sourceLanguage: string | null;
  createdAt: string;
  updatedAt: string;
  servings: number | null;
  prepTimeMinutes: number | null;
  cookTimeMinutes: number | null;
  totalTimeMinutes: number | null;
  calories: number | null;
  cuisine: string | null;
  difficulty: Difficulty | null;
  minutes: number | null;
  sourceType: string;
  sourceLabel: string;
  creator: string;
  originalUrl: string | null;
  thumbnailUrl: string | null;
  ingredientCount: number;
  stepCount: number;
};
