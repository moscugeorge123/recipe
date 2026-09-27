import { useMemo } from 'react';

import { useRecipe } from '@/features/recipes/hooks/use-recipe';
import { useRecipes } from '@/features/recipes/hooks/use-recipes';
import { difficultyFromMinutes } from '@/features/recipes/mapper';
import type {
  RecipeListItemView,
  RecipeStepView,
  RecipeView,
} from '@/features/recipes/types';
import {
  ingredientAmount,
  preferUnits,
  stepHeat,
} from '@/features/recipes/units';
import { hueOf } from '@/tortie/color';
import { emoOf, fmtIngQty, hasKey, ingKeys, lexOf } from '@/tortie/lib/fmt';
import { useTortiePrefs, type Units } from '@/tortie/prefs-store';

/** Design-shaped recipe summary (maps the prototype's RECIPES entries). */
export type TRecipe = {
  id: string;
  title: string;
  desc: string;
  /** Total minutes. */
  time: number;
  /** API difficulty (Easy · Medium · Hard). */
  level: string;
  /** Base servings. */
  base: number;
  hue: number;
  /** Tag pill: first category, else cuisine, else source. */
  tag: string;
  /** Placeholder caption subject: "photo · {photo}". */
  photo: string;
  uri: string | null;
  saved: boolean;
  cooked: number;
  createdAt: string;
  ingCount: number;
  stepCount: number;
  categories: string[];
  cuisine: string;
  sourceLabel: string;
  originalUrl: string | null;
};

export type TIng = {
  q: number | null;
  u: string;
  n: string;
  emo: string;
  tint: string;
};
export type TStep = {
  /** Short title (first sentence of the instruction). */
  t: string;
  /** Remaining instruction text. */
  d: string;
  /** Timer minutes (0 = no timer). */
  m: number;
  /** Phase label from the step stage. */
  ph: string;
  heat: string;
  tip: string;
  /** Indexes into `ings` mentioned by this step. */
  need: number[];
};
export type TDetail = TRecipe & {
  ings: TIng[];
  steps: TStep[];
  view: RecipeView;
};

type AnyRecipe = RecipeView | RecipeListItemView;

/** Real total time only; the detail mapper's `minutes` defaults to 30 when the API has none. 0 = unknown. */
function minutesOf(r: AnyRecipe): number {
  const sum = (r.prepTimeMinutes ?? 0) + (r.cookTimeMinutes ?? 0);
  return r.totalTimeMinutes ?? (sum > 0 ? sum : 0);
}

function photoWord(title: string): string {
  const w = title
    .toLowerCase()
    .replace(/[^a-z\s&-]/g, '')
    .split(/\s+/)
    .filter((x) => x.length > 3 && !['with', 'and', 'the', 'from'].includes(x));
  return w[w.length - 1] ?? 'your dish';
}

export function toTRecipe(r: AnyRecipe): TRecipe {
  const cats = (r.categories ?? []).map((c) => c.name);
  const cuisine = r.cuisine ?? '';
  return {
    id: r.id,
    title: r.title,
    desc: r.description ?? '',
    time: minutesOf(r),
    level: r.difficulty ?? difficultyFromMinutes(minutesOf(r) || 30),
    base: Math.max(1, r.servings ?? 2),
    hue: hueOf(r.id),
    tag: cats[0] ?? (cuisine || r.sourceLabel || 'Recipe'),
    photo: photoWord(r.title),
    uri: r.thumbnailUrl ?? null,
    saved: !!r.isFavorite,
    cooked: r.cookCount ?? 0,
    createdAt: r.createdAt ?? '',
    ingCount:
      'ingredients' in r && Array.isArray(r.ingredients) && r.ingredients.length
        ? r.ingredients.length
        : (r.ingredientCount ?? 0),
    stepCount:
      'steps' in r && Array.isArray(r.steps) && r.steps.length
        ? r.steps.length
        : (r.stepCount ?? 0),
    categories: cats,
    cuisine,
    sourceLabel: r.sourceLabel ?? '',
    originalUrl: r.originalUrl ?? null,
  };
}

const STAGE: Record<string, string> = {
  PREP: 'Prep',
  COOK: 'Cooking',
  FINISH: 'Finish',
  SERVE: 'Serve',
};

function splitStep(text: string): [string, string] {
  const s = text.trim();
  const m = s.match(/^(.{6,80}?[.!?])\s+(.+)$/s);
  if (m) return [m[1]!.replace(/[.!?]$/, ''), m[2]!];
  return [s.replace(/[.!?]$/, ''), ''];
}

/** Amounts, heat and in-text measurements follow `units` (Profile → Units). */
export function toTDetail(v: RecipeView, units: Units = 'metric'): TDetail {
  const base = toTRecipe(v);
  const ings: TIng[] = v.ingredients.map((x) => {
    const n = [x.name, x.preparation].filter(Boolean).join(', ');
    const e = emoOf(x.name);
    const emo = lexOf(x.name)
      ? e.emo
      : x.emoji && x.emoji !== '🥣'
        ? x.emoji
        : e.emo;
    const amount = ingredientAmount(x, units);
    return { q: amount.quantity, u: amount.unit ?? '', n, emo, tint: e.tint };
  });
  const steps: TStep[] = [...v.steps]
    .sort((a, b) => a.stepOrder - b.stepOrder)
    .map((s: RecipeStepView) => {
      const [t, d] = splitStep(preferUnits(s.instruction, units));
      const tx = s.instruction.toLowerCase();
      const refs = (s.ingredientRefs ?? []).filter((i) => i < ings.length);
      const need = refs.length
        ? refs
        : ings
            .map((g, i) => (ingKeys(g.n).some((k) => hasKey(tx, k)) ? i : -1))
            .filter((i) => i >= 0);
      return {
        t,
        d,
        m: s.durationSeconds
          ? Math.max(1, Math.round(s.durationSeconds / 60))
          : 0,
        ph: STAGE[s.stage] ?? '',
        heat: stepHeat(s, units),
        tip: '',
        need,
      };
    });
  return { ...base, ings, steps, view: v };
}

/** "115 g" / "¼ cup" for an ingredient row, scaled for servings. */
export function ingQty(x: TIng, scale = 1): string {
  return fmtIngQty(x.q, x.u, scale);
}

export type RecipeSort = 'latest' | 'engagement';

/** All recipes in the cookbook (API list, newest first). */
export function useTRecipes(sort: RecipeSort = 'latest') {
  const q = useRecipes(1, 100, { sort });
  const list = useMemo(() => (q.data?.items ?? []).map(toTRecipe), [q.data]);
  return {
    list,
    total: q.data?.meta.total ?? list.length,
    isLoading: q.isLoading,
    isError: q.isError,
    refetch: q.refetch,
  };
}

/** One recipe with ingredients and steps (falls back to the list preview while loading). */
export function useTRecipe(id: string | null | undefined) {
  const q = useRecipe(id ?? undefined);
  const units = useTortiePrefs((s) => s.units);
  const r = useMemo(
    () => (q.data ? toTDetail(q.data as RecipeView, units) : null),
    [q.data, units],
  );
  return {
    r,
    view: (q.data as RecipeView | undefined) ?? undefined,
    isLoading: q.isLoading,
  };
}

/** Quantity scaled for servings, prototype formatting. */
export { fmtQ } from '@/tortie/lib/fmt';
