export type GroceryCategory =
  'Produce' | 'Meat' | 'Dairy' | 'Pantry' | 'Spices' | 'Frozen';

export type OrganizeSource = 'dictionary' | 'cache' | 'ai' | 'fallback';

export type OrganizedPantryItem = {
  rawText: string;
  name: string;
  canonicalName: string;
  category: GroceryCategory | string;
  emoji: string;
  colorToken: string;
  quantity: number | null;
  unit: string | null;
  confidence: number;
  source: OrganizeSource;
  status: 'CLASSIFIED' | 'NEEDS_REVIEW' | 'FAILED';
  locale: string;
  promptVersion: string;
};

export type UnresolvedPantryLine = {
  rawText: string;
  reason: 'budget' | 'ai_unavailable' | 'malformed' | 'low_confidence';
  retryable: boolean;
};

export type OrganizePantryResult = {
  items: OrganizedPantryItem[];
  unresolved: UnresolvedPantryLine[];
  meta: {
    promptVersion: string;
    cacheHits: number;
    dictionaryHits: number;
    aiItemCount: number;
    modelsUsed: string[];
    escalatedCount: number;
    fallbackCount: number;
    truncated: boolean;
    aiAvailable: boolean;
  };
};

export type PantryItemView = {
  id: string;
  name: string;
  canonicalName: string | null;
  rawText: string | null;
  locale: string;
  promptVersion: string | null;
  quantity: number | null;
  unit: string | null;
  category: string | null;
  emoji: string | null;
  colorToken: string | null;
  storageLocation: 'PANTRY' | 'FRIDGE' | 'FREEZER' | 'OTHER';
  expiresAt: string | null;
  classification: {
    status: string;
    canonicalName?: string;
    category?: string;
    confidence?: number;
    source?: string;
  };
  createdAt: string;
  updatedAt: string;
};

export function mergeOrganizedItems(
  current: OrganizedPantryItem[],
  retry: OrganizePantryResult,
): OrganizedPantryItem[] {
  const retried = new Set(retry.items.map((item) => item.rawText));
  const kept = current.filter((item) => !retried.has(item.rawText));
  return [...kept, ...retry.items];
}
