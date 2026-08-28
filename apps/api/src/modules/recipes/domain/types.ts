import type { Prisma } from '@prisma/client';

export interface ExtractedIngredient {
  name: string;
  quantity?: string | null;
  unit?: string | null;
  preparation?: string | null;
  optional?: boolean;
  category?: string | null;
  confidence: number;
  provenance?: string;
}

export interface ExtractedStep {
  stepOrder: number;
  instruction: string;
  durationMinutes?: number | null;
  temperature?: string | null;
  stage?: string | null;
  confidence: number;
  provenance?: string;
}

export interface ExtractedRecipe {
  title: string;
  description?: string | null;
  servings?: number | null;
  prepTimeMinutes?: number | null;
  cookTimeMinutes?: number | null;
  totalTimeMinutes?: number | null;
  sourceLanguage: string;
  calories?: number | null;
  cuisine?: string | null;
  nutrition?: {
    proteinGrams?: number | null;
    carbsGrams?: number | null;
    fatGrams?: number | null;
  } | null;
  ingredients: ExtractedIngredient[];
  steps: ExtractedStep[];
}

export interface NormalizedIngredient {
  name: string;
  canonicalName: string;
  quantity: Prisma.Decimal | null;
  unit: string | null;
  preparation: string | null;
  optional: boolean;
  category: string;
  confidence: number;
  provenance: Prisma.InputJsonValue;
  warnings: Prisma.InputJsonValue;
  sortOrder: number;
}

export interface NormalizedStep {
  stepOrder: number;
  instruction: string;
  durationMinutes: number | null;
  temperature: string | null;
  stage: string;
  confidence: number;
  provenance: Prisma.InputJsonValue;
  warnings: Prisma.InputJsonValue;
}

export interface NormalizedRecipe {
  title: string;
  description: string | null;
  servings: number | null;
  prepTimeMinutes: number | null;
  cookTimeMinutes: number | null;
  totalTimeMinutes: number | null;
  sourceLanguage: string;
  calories: number | null;
  cuisine: string | null;
  nutrition: Prisma.InputJsonValue | null;
  confidence: number;
  warnings: Prisma.InputJsonValue;
  ingredients: NormalizedIngredient[];
  steps: NormalizedStep[];
}

export interface ValidationWarning {
  code: string;
  message: string;
  field?: string;
}

export interface ValidationResult {
  valid: boolean;
  warnings: ValidationWarning[];
}
