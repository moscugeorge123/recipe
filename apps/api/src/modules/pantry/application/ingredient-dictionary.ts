import type { GroceryCategory } from '@recipe/contracts';

import { toSentenceCase } from '../../normalization/domain/casing.js';
import type { GardenPlateColorToken } from '../../normalization/domain/presentation.js';
import { INGREDIENT_ALIASES, normalizeIngredientName } from '../../normalization/domain/units.js';

export interface DictionaryEntry {
  canonicalName: string;
  displayName: string;
  category: GroceryCategory;
  emoji: string;
  colorToken: GardenPlateColorToken;
}

type DictionaryRow = [
  canonicalName: string,
  displayName: string,
  category: GroceryCategory,
  emoji: string,
  colorToken: GardenPlateColorToken,
  ...aliases: string[],
];

const ROWS: DictionaryRow[] = [
  ['olive oil', 'Olive oil', 'Pantry', '🫒', 'peach', 'ulei', 'ulei de masline', 'huile d olive', "huile d'olive", 'aceite de oliva', 'olivenol', 'olivenöl'],
  ['salt', 'Salt', 'Spices', '🧂', 'chili50', 'sare', 'sel', 'sal', 'salz'],
  ['black pepper', 'Black pepper', 'Spices', '🌶️', 'chili50', 'pepper', 'piper', 'poivre', 'pimienta', 'pfeffer'],
  ['garlic', 'Garlic', 'Produce', '🧄', 'basilSoft', 'usturoi', 'ajo', 'ail', 'knoblauch'],
  ['onion', 'Onion', 'Produce', '🧅', 'basilSoft', 'ceapa', 'cebolla', 'oignon', 'zwiebel'],
  ['butter', 'Butter', 'Dairy', '🧈', 'steamedMilk', 'unt', 'mantequilla', 'beurre'],
  ['cumin', 'Cumin', 'Spices', '🌿', 'chili50', 'cumin seeds', 'comino', 'kimion'],
  ['chilli flakes', 'Chilli flakes', 'Spices', '🌶️', 'chili50', 'chili flakes', 'red pepper flakes', 'chilli flake'],
  ['tomato', 'Tomato', 'Produce', '🍅', 'basilSoft', 'tomatoes', 'tomate', 'tomatos', 'pomodoro', 'rosie', 'rosii'],
  ['lemon', 'Lemon', 'Produce', '🍋', 'honey50', 'citron', 'limon', 'zitrone', 'lamaie'],
  ['chicken', 'Chicken', 'Meat', '🍗', 'paprikaSoft', 'chicken breast', 'chicken thigh', 'pui', 'pollo', 'poulet', 'huhn', 'chickn'],
  ['beef', 'Beef', 'Meat', '🥩', 'paprikaSoft', 'carne de vita', 'res', 'boeuf', 'rind'],
  ['pork', 'Pork', 'Meat', '🥩', 'paprikaSoft', 'porc', 'cerdo', 'schwein'],
  ['milk', 'Milk', 'Dairy', '🥛', 'steamedMilk', 'lapte', 'leche', 'lait', 'milch'],
  ['egg', 'Egg', 'Dairy', '🥚', 'steamedMilk', 'eggs', 'ou', 'oua', 'huevo', 'oeuf', 'ei'],
  ['cheese', 'Cheese', 'Dairy', '🧀', 'steamedMilk', 'queso', 'fromage', 'kase', 'cascaval'],
  ['flour', 'Flour', 'Pantry', '🌾', 'peach', 'all-purpose flour', 'faina', 'harina', 'farine', 'mehl'],
  ['sugar', 'Sugar', 'Pantry', '🍬', 'peach', 'zahar', 'azucar', 'sucre', 'zucker'],
  ['rice', 'Rice', 'Pantry', '🍚', 'peach', 'orez', 'arroz', 'riz', 'reis'],
  ['pasta', 'Pasta', 'Pantry', '🍝', 'peach', 'spaghetti', 'paste', 'pate', 'nudel'],
  ['basil', 'Basil', 'Produce', '🌿', 'basilSoft', 'albahaca', 'basilic', 'busuioc'],
  ['spinach', 'Spinach', 'Produce', '🥬', 'basilSoft', 'espinaca', 'epinard', 'spanac'],
  ['yogurt', 'Yogurt', 'Dairy', '🥛', 'steamedMilk', 'yoghurt', 'iaurt'],
  ['frozen peas', 'Frozen peas', 'Frozen', '🧊', 'honey50', 'peas'],
  ['ginger', 'Ginger', 'Produce', '🫚', 'basilSoft', 'jengibre', 'gingembre'],
];

const byKey = new Map<string, DictionaryEntry>();

function remember(key: string, entry: DictionaryEntry): void {
  const normalized = key.trim().toLowerCase();
  if (normalized) {
    byKey.set(normalized, entry);
  }
}

for (const [canonicalName, displayName, category, emoji, colorToken, ...aliases] of ROWS) {
  const entry: DictionaryEntry = { canonicalName, displayName, category, emoji, colorToken };
  remember(canonicalName, entry);
  remember(displayName, entry);
  for (const alias of aliases) {
    remember(alias, entry);
  }
}

for (const [alias, canonical] of Object.entries(INGREDIENT_ALIASES)) {
  const entry = byKey.get(canonical) ?? byKey.get(alias);
  if (entry) {
    remember(alias, entry);
  }
}

export function lookupIngredientDictionary(raw: string): DictionaryEntry | null {
  const lowered = raw.trim().toLowerCase();
  if (!lowered) {
    return null;
  }
  const direct = byKey.get(lowered);
  if (direct) {
    return direct;
  }
  const aliased = byKey.get(normalizeIngredientName(lowered));
  if (aliased) {
    return aliased;
  }
  const stripped = lowered.replace(/\b(fresh|chopped|diced|minced|ground|whole|large|small|cloves?|leaves?|seeds?)\b/g, '').replace(/\s+/g, ' ').trim();
  return byKey.get(stripped) ?? byKey.get(normalizeIngredientName(stripped)) ?? null;
}

export function dictionaryDisplayName(entry: DictionaryEntry, rawRemainder: string): string {
  if (rawRemainder.trim().toLowerCase() === entry.canonicalName) {
    return entry.displayName;
  }
  return toSentenceCase(rawRemainder);
}
