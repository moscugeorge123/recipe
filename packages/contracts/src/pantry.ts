export const PantryClassificationStatus = {
  UNCLASSIFIED: "UNCLASSIFIED",
  PENDING: "PENDING",
  CLASSIFIED: "CLASSIFIED",
  NEEDS_REVIEW: "NEEDS_REVIEW",
  FAILED: "FAILED",
} as const;

export type PantryClassificationStatus =
  (typeof PantryClassificationStatus)[keyof typeof PantryClassificationStatus];

export const PantryStorageLocation = {
  PANTRY: "PANTRY",
  FRIDGE: "FRIDGE",
  FREEZER: "FREEZER",
  OTHER: "OTHER",
} as const;

export type PantryStorageLocation =
  (typeof PantryStorageLocation)[keyof typeof PantryStorageLocation];

export const PantryClassificationSource = {
  USER: "user",
  DICTIONARY: "dictionary",
  CACHE: "cache",
  AI: "ai",
  FALLBACK: "fallback",
} as const;

export type PantryClassificationSource =
  (typeof PantryClassificationSource)[keyof typeof PantryClassificationSource];

export const GardenPlateColorToken = {
  paprikaSoft: "paprikaSoft",
  basilSoft: "basilSoft",
  honey50: "honey50",
  peach: "peach",
  linen: "linen",
  steamedMilk: "steamedMilk",
  chili50: "chili50",
} as const;

export type GardenPlateColorToken =
  (typeof GardenPlateColorToken)[keyof typeof GardenPlateColorToken];

export const GROCERY_CATEGORIES = [
  "Produce",
  "Meat",
  "Dairy",
  "Pantry",
  "Spices",
  "Frozen",
] as const;

export type GroceryCategory = (typeof GROCERY_CATEGORIES)[number];

export interface PantryClassification {
  status: PantryClassificationStatus;
  canonicalName?: string;
  category?: string;
  confidence?: number;
  source?: PantryClassificationSource | "rules";
}

export interface PantryItemShape {
  id: string;
  name: string;
  canonicalName?: string | null;
  rawText?: string | null;
  locale?: string;
  promptVersion?: string | null;
  quantity?: number | null;
  unit?: string | null;
  category?: string | null;
  emoji?: string | null;
  colorToken?: string | null;
  storageLocation: PantryStorageLocation;
  expiresAt?: string | null;
  classification: PantryClassification;
}

/**
 * Split ordinary pantry paste into items. Newlines and commas start new items;
 * numeric thousands such as `1,000 g flour` stay together.
 */
export function parsePantryText(text: string): string[] {
  const items: string[] = [];

  for (const line of text.split(/\r?\n/)) {
    const parts = line
      .split(",")
      .map((part) => part.trim())
      .filter((part) => part.length > 0);

    for (const part of parts) {
      const previous = items[items.length - 1];
      if (previous !== undefined && /^\d+$/.test(previous) && /^\d/.test(part)) {
        items[items.length - 1] = `${previous},${part}`;
      } else {
        items.push(part);
      }
    }
  }

  return items;
}

export function canonicalIngredientKey(
  name: string,
  canonicalName?: string | null,
): string {
  return (canonicalName ?? name).trim().toLowerCase();
}

/** Exact canonical match — never substring `includes`. */
export function pantryHasIngredient(
  ingredient: { name: string; canonicalName?: string | null },
  pantryKeys: readonly string[],
): boolean {
  const keys = new Set(
    pantryKeys.map((key) => key.trim().toLowerCase()).filter((key) => key.length > 0),
  );
  const canonical = ingredient.canonicalName?.trim().toLowerCase();
  if (canonical && keys.has(canonical)) {
    return true;
  }
  return keys.has(ingredient.name.trim().toLowerCase());
}
