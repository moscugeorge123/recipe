import type { KitchenMigrationDocument } from '@/features/kitchen/migration';
import type { PendingSyncOp } from '@/features/kitchen/pending-sync';
import type {
  IngredientCategory,
  RecipeId,
  RecipeIngredientView,
} from '@/features/recipes/types';

export type CookingTheme = 'dark' | 'light';
export type InboxStatus = 'needs_review' | 'ready';
export type KitchenTab =
  'Inbox' | 'Saved' | 'Want to cook' | 'Cooked' | 'Collections';
export type ReduceMotionPref = 'system' | 'reduce' | 'full';

export type PreferencesState = {
  displayName: string;
  hasOnboarded: boolean;
  cookingTheme: CookingTheme;
  reduceMotion: ReduceMotionPref;
  units: 'metric' | 'imperial';
  tasteTags: string[];
  setDisplayName: (name: string) => void;
  completeOnboarding: () => void;
  replayOnboarding: () => void;
  setCookingTheme: (theme: CookingTheme) => void;
  setReduceMotion: (value: ReduceMotionPref) => void;
  setUnits: (units: 'metric' | 'imperial') => void;
  setTasteTags: (tags: string[]) => void;
  reset: () => void;
};

export type KitchenCollection = {
  id: string;
  name: string;
  recipeIds: RecipeId[];
};

export type RecipeNote = {
  text: string;
  cookedAt: number;
};

export type KitchenState = {
  inboxStatus: Record<RecipeId, InboxStatus>;
  savedIds: RecipeId[];
  wantIds: RecipeId[];
  cookedCounts: Record<RecipeId, number>;
  recipeNotes: Record<RecipeId, RecipeNote[]>;
  collections: KitchenCollection[];
  pantryStaples: string[];
  servingsByRecipe: Record<RecipeId, number>;
  recentSearches: string[];
  pendingSync: PendingSyncOp[];
  kitchenMigration: KitchenMigrationDocument | null;
  markInbox: (id: RecipeId, status: InboxStatus) => void;
  confirmReviewed: (id: RecipeId) => void;
  toggleSaved: (id: RecipeId) => void;
  toggleWant: (id: RecipeId) => void;
  incrementCooked: (id: RecipeId) => void;
  addRecipeNote: (id: RecipeId, text: string) => void;
  setServings: (id: RecipeId, n: number) => void;
  addRecentSearch: (q: string) => void;
  addCollection: (name: string) => void;
  markStaple: (name: string) => void;
  enqueuePending: (op: PendingSyncOp) => void;
  patchPending: (id: string, patch: Partial<PendingSyncOp>) => void;
  applyMigrationLeftovers: (patch: Partial<KitchenState>) => void;
  setKitchenMigration: (doc: KitchenMigrationDocument) => void;
};

export type ShopItem = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  category: IngredientCategory;
  fromRecipeCount: number;
  done: boolean;
};

export type ShopState = {
  items: ShopItem[];
  shoppingMode: boolean;
  addIngredients: (ings: RecipeIngredientView[], recipeTitle: string) => void;
  toggleDone: (id: string) => void;
  toggleShoppingMode: () => void;
  clearDone: () => void;
};

export type CookTimer = {
  stepIndex: number;
  label: string;
  remainingSec: number;
  totalSec: number;
  running: boolean;
} | null;

export type StartCookOptions = {
  reset?: boolean;
  sessionId?: string | null;
};

export type CookTerminalStatus = 'COMPLETED' | 'STOPPED';

export type CookSessionState = {
  recipeId: RecipeId | null;
  sessionId: string | null;
  stepIndex: number;
  startedAt: number | null;
  timer: CookTimer;
  terminalStatus: CookTerminalStatus | null;
  start: (recipeId: RecipeId, options?: StartCookOptions) => void;
  setSessionId: (sessionId: string | null) => void;
  setStep: (index: number) => void;
  setTerminalStatus: (status: CookTerminalStatus) => void;
  exit: () => void;
  startTimer: (stepIndex: number, seconds: number, label: string) => void;
  toggleTimer: () => void;
  clearTimer: () => void;
};

export type ToastPayload = {
  text: string;
  glyph: string;
  action?: string;
  onAction?: () => void;
} | null;

export type UiState = {
  captureOpen: boolean;
  toast: ToastPayload;
  openCapture: () => void;
  closeCapture: () => void;
  showToast: (toast: ToastPayload) => void;
  hideToast: () => void;
};

export const DEFAULT_PANTRY_STAPLES = [
  'olive oil',
  'salt',
  'garlic',
  'butter',
  'cumin seeds',
  'chilli flakes',
  'onion',
] as const;

export function isHave(
  name: string,
  staples: readonly string[],
  canonicalName?: string | null,
): boolean {
  const keys = new Set(
    staples
      .map((key) => key.trim().toLowerCase())
      .filter((key) => key.length > 0),
  );
  const canonical = canonicalName?.trim().toLowerCase();
  if (canonical && keys.has(canonical)) {
    return true;
  }
  return keys.has(name.trim().toLowerCase());
}

export function inboxStatusForRecipe(input: {
  confidence: number;
  warnings: unknown;
}): InboxStatus {
  const hasWarnings =
    Array.isArray(input.warnings) && input.warnings.length > 0;
  if (input.confidence < 0.7 || hasWarnings) {
    return 'needs_review';
  }
  return 'ready';
}
