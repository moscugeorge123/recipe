import { computeRecipeSignals } from '../../recipes/application/recipe-signals.js';

import { decodeHtmlEntities } from './open-graph.js';

/** Pages shorter than this (as text) are mostly script shells; there is nothing to judge. */
const MIN_TEXT_LENGTH = 400;
/** Enough text to judge a page; the rest is just more of the same. */
const MAX_TEXT_LENGTH = 60_000;

const STRUCTURED_RECIPE = /"@type"\s*:\s*(?:\[[^\]]*)?["']Recipe["']/i;

function visibleText(html: string): string {
  const withoutCode = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
  return decodeHtmlEntities(withoutCode.replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_TEXT_LENGTH);
}

/**
 * A cheap "does this web page read like a food recipe?" check for the link preview, so the app
 * can say so before an import is started. It reuses the keyword signals the importer's own
 * classifier starts from. It only ever leans towards "yes": `false` needs a long page with no
 * structured recipe and almost no cooking words, and `null` means there was nothing to judge.
 * The importer stays the authority on what is a recipe.
 */
export function looksLikeRecipePage(html: string): boolean | null {
  if (STRUCTURED_RECIPE.test(html)) return true;

  const text = visibleText(html);
  if (text.length < MIN_TEXT_LENGTH) return null;

  const s = computeRecipeSignals(text);
  const cooking = s.cookingVerbCount >= 2 && s.foodTermCount >= 3;
  const quantified = s.quantityCount >= 2 || s.recipeKeywordCount >= 2;
  if (cooking && quantified) return true;
  // Plenty of food words and measures with few verbs: a recipe blurb or a list of ingredients.
  if (s.foodTermCount >= 8 && s.quantityCount >= 4) return true;
  return false;
}
