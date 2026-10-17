import { editorDefaults, toPatchBody } from '@/features/recipes/editor-form';
import type {
  AssistRecipeDraft,
  PatchRecipeBody,
} from '@/features/recipes/schemas';
import type { Difficulty, RecipeView } from '@/features/recipes/types';
import type { TDetail } from '@/tortie/data/recipes';
import { detectMin, emoOf, parseIng, qTxt } from '@/tortie/lib/fmt';
import { useNav } from '@/tortie/nav-store';
import { useTortiePrefs } from '@/tortie/prefs-store';

/** Editor rows (prototype `ed.ings` / `ed.steps`); `src` points at the loaded recipe's row. */
export type EdIng = { k: string; txt: string; src?: number };
export type EdStep = {
  k: string;
  t: string;
  d: string;
  m: number;
  auto: boolean;
  det: number | null;
  /** Work that happens before the cooking session. */
  ahead: boolean;
  src?: number;
};
export type Draft = {
  id: string | null;
  isNew: boolean;
  title: string;
  desc: string;
  level: string;
  base: number;
  time: number;
  ings: EdIng[];
  steps: EdStep[];
};

/** API difficulties (the prototype cycles Easy · Medium · Weekend · Project). */
export const LEVELS: string[] = ['Easy', 'Medium', 'Hard'];

const isDifficulty = (value: string): value is Difficulty =>
  LEVELS.includes(value);

export const SUGG: [string, RegExp][] = [
  ['salt', /\bsalt(ed)?\b/],
  ['black pepper', /\bpepper\b/],
  ['olive oil', /\boil\b/],
  ['butter', /\bbutter\b/],
  ['sugar', /\bsugar\b/],
  ['lemon', /\blemons?\b/],
  ['garlic', /\bgarlic\b/],
  ['parsley', /\bparsley\b/],
  ['stock', /\bstock\b/],
  ['cream', /\bcream\b/],
  ['eggs', /\beggs?\b/],
  ['flour', /\bflour\b/],
  ['honey', /\bhoney\b/],
];

export const AI_CHIPS = [
  'Make it vegetarian',
  'Halve the recipe',
  'Tighten the wording',
  'Add a finishing step',
  'Make it dairy-free',
];

export const uid = () => Math.random().toString(36).slice(2, 8);

const ingTxt = (q: number | null, u: string, n: string) =>
  [qTxt(q ?? 0), u, n].filter(Boolean).join(' ');

export function makeDraft(r: TDetail): Draft {
  return {
    id: r.id,
    isNew: false,
    title: r.title,
    desc: r.desc,
    level: r.level,
    base: r.base,
    time: r.time,
    ings: r.ings.map((x, i) => ({
      k: 'i' + i,
      txt: ingTxt(x.q, x.u, x.n),
      src: i,
    })),
    steps: r.steps.map((x, i) => ({
      k: 's' + i,
      t: x.t,
      d: x.d,
      m: x.m,
      auto: false,
      det: detectMin(x.t + ' ' + x.d),
      ahead: x.ahead,
      src: i,
    })),
  };
}

/** A new recipe starts at the user's default servings (Profile → Kitchen). */
export function blankDraft(
  servings: number = useTortiePrefs.getState().defaultServings,
): Draft {
  const k = () => 'n' + uid();
  return {
    id: null,
    isNew: true,
    title: '',
    desc: '',
    level: 'Easy',
    base: Math.max(1, Math.min(12, Math.round(servings)) || 4),
    time: 30,
    ings: [{ k: k(), txt: '' }],
    steps: [
      { k: k(), t: '', d: '', m: 0, auto: false, det: null, ahead: false },
    ],
  };
}

export const isBlank = (ed: Draft) =>
  !ed.title.trim() &&
  !ed.desc.trim() &&
  !ed.ings.some((x) => x.txt.trim()) &&
  !ed.steps.some((x) => (x.t + x.d).trim());

function cmp<T extends { k: string }>(
  a: T[],
  b: T[],
  eq: (x: T, o: T) => boolean,
) {
  const bm = new Map(b.map((x) => [x.k, x]));
  const am = new Set(a.map((x) => x.k));
  let c = 0;
  a.forEach((x) => {
    const o = bm.get(x.k);
    if (!o || !eq(x, o)) c++;
  });
  b.forEach((x) => {
    if (!am.has(x.k)) c++;
  });
  if (
    a
      .map((x) => x.k)
      .filter((k) => bm.has(k))
      .join() !==
    b
      .map((x) => x.k)
      .filter((k) => am.has(k))
      .join()
  )
    c++;
  return c;
}

export function diffCount(ed: Draft, e0: Draft): number {
  let n = 0;
  (['title', 'desc', 'level', 'base', 'time'] as const).forEach((f) => {
    if (ed[f] !== e0[f]) n++;
  });
  n += cmp(
    ed.ings.filter((x) => x.txt.trim()),
    e0.ings,
    (x, o) => x.txt.trim() === o.txt.trim(),
  );
  n += cmp(
    ed.steps.filter((x) => x.t.trim() || x.d.trim()),
    e0.steps,
    (x, o) => x.t === o.t && x.d === o.d && x.m === o.m,
  );
  return n;
}

/**
 * Draft → `PATCH /recipes/:id`. Rows the user didn't touch keep their exact API
 * values; edited rows are parsed from free text (`parseIng`). Returns null with a
 * reason when the API contract can't be met.
 */
export function toRecipePatch(
  ed: Draft,
  e0: Draft,
  view: RecipeView,
  fallbackCategoryId: string | null,
): { body: PatchRecipeBody } | { error: string } {
  // Same step order as `toTDetail`, so `src` indexes line up.
  const sorted = {
    ...view,
    steps: [...view.steps].sort((a, b) => a.stepOrder - b.stepOrder),
  };
  const base = toPatchBody(editorDefaults(sorted), view.revisionNumber ?? 0);
  const orig0 = new Map(e0.ings.map((x) => [x.k, x]));
  const step0 = new Map(e0.steps.map((x) => [x.k, x]));

  const ingredients = ed.ings
    .filter((x) => x.txt.trim())
    .map((x, i) => {
      const o = orig0.get(x.k);
      const src = x.src != null ? base.ingredients[x.src] : undefined;
      if (src && o && o.txt.trim() === x.txt.trim())
        return { ...src, sortOrder: i };
      const p = parseIng(x.txt);
      const raw = (p.n || x.txt).trim();
      const cut = raw.indexOf(', ');
      const name = cut > 0 ? raw.slice(0, cut) : raw;
      const preparation = cut > 0 ? raw.slice(cut + 2) : null;
      return {
        name,
        canonicalName: name.toLowerCase(),
        emoji: emoOf(name).emo,
        colorToken: src?.colorToken ?? 'peach',
        quantity: p.q || null,
        unit: p.u || null,
        preparation,
        optional: src?.optional ?? false,
        category: src?.category ?? 'Pantry',
        sortOrder: i,
      };
    });

  const steps = ed.steps
    .filter((x) => x.t.trim() || x.d.trim())
    .map((x, i) => {
      const o = step0.get(x.k);
      const src = x.src != null ? base.steps[x.src] : undefined;
      const minutes = x.m > 0 ? Math.round(x.m) : null;
      if (src && o && o.t === x.t && o.d === x.d && o.ahead === x.ahead) {
        return {
          ...src,
          stepOrder: i + 1,
          durationMinutes: o.m === x.m ? src.durationMinutes : minutes,
        };
      }
      return {
        stepOrder: i + 1,
        title: x.t.trim() || null,
        instruction: x.d.trim() || x.t.trim(),
        durationMinutes: minutes,
        temperature: src?.temperature ?? null,
        stage: src?.stage ?? 'COOK',
        ahead: x.ahead,
      };
    });

  if (!ingredients.length || !steps.length)
    return { error: 'Add at least one ingredient and one step' };
  const categoryIds = base.categoryIds.length
    ? base.categoryIds
    : fallbackCategoryId
      ? [fallbackCategoryId]
      : [];
  if (!categoryIds.length)
    return { error: 'Couldn’t save — this recipe needs a category first' };

  return {
    body: {
      ...base,
      title: ed.title.trim() || view.title,
      description: ed.desc.trim() || null,
      servings: ed.base !== e0.base ? ed.base : base.servings,
      totalTimeMinutes: ed.time !== e0.time ? ed.time : base.totalTimeMinutes,
      ...(ed.level !== e0.level && isDifficulty(ed.level)
        ? { difficulty: ed.level }
        : {}),
      categoryIds,
      ingredients,
      steps,
    },
  };
}

/** Time-based fallback the API uses when a recipe has no extracted or edited difficulty. */
export const levelForMinutes = (m: number) =>
  m < 30 ? 'Easy' : m <= 50 ? 'Medium' : 'Hard';

let closeHandler: (() => void) | null = null;

/** Lets the mounted editor own close (discard confirm) for Android back. */
export function registerEditorClose(fn: (() => void) | null) {
  closeHandler = fn;
}

/** Close the editor like its × button: confirm first when there are unsaved changes. */
export function requestEditorClose() {
  if (closeHandler) closeHandler();
  else useNav.getState().closeEditor();
}

/** Highlight keys for the draft's scalar fields; rows use their own `k`. */
export const FIELD_MARK = {
  title: 'f:title',
  desc: 'f:desc',
  base: 'f:base',
  time: 'f:time',
  level: 'f:level',
} as const;

/** Draft → `POST /recipes/assist` recipe. Row keys are the ids Tortie echoes back. */
export function toAssistDraft(ed: Draft): AssistRecipeDraft {
  return {
    title: ed.title.trim(),
    description: ed.desc.trim(),
    servings: ed.base,
    totalMinutes: ed.time,
    difficulty: ed.level,
    ingredients: ed.ings
      .filter((x) => x.txt.trim())
      .map((x) => ({ id: x.k, text: x.txt.trim() })),
    steps: ed.steps
      .filter((x) => (x.t + x.d).trim())
      .map((x) => ({
        id: x.k,
        title: x.t,
        body: x.d,
        minutes: x.m,
        ahead: x.ahead,
      })),
  };
}

/**
 * Tortie's draft → editor draft. Rows Tortie kept reuse their key (and `src`, so untouched
 * rows still save their exact API values); new rows get fresh keys. `changed` lists every
 * field and row key that differs, for highlighting.
 */
export function fromAssistDraft(
  base: Draft,
  out: AssistRecipeDraft,
): { next: Draft; changed: string[] } {
  const changed: string[] = [];
  const ingBy = new Map(base.ings.map((x) => [x.k, x]));
  const stepBy = new Map(base.steps.map((x) => [x.k, x]));
  const level = LEVELS.includes(out.difficulty) ? out.difficulty : base.level;
  const next: Draft = {
    ...base,
    title: out.title === base.title.trim() ? base.title : out.title,
    desc: out.description === base.desc.trim() ? base.desc : out.description,
    base: out.servings,
    time: out.totalMinutes,
    level,
    ings: out.ingredients.map((x) => {
      const o = x.id ? ingBy.get(x.id) : undefined;
      if (o && o.txt.trim() === x.text) return o;
      const row = o ? { ...o, txt: x.text } : { k: 'n' + uid(), txt: x.text };
      changed.push(row.k);
      return row;
    }),
    steps: out.steps.map((x) => {
      const o = x.id ? stepBy.get(x.id) : undefined;
      if (
        o &&
        o.t === x.title &&
        o.d === x.body &&
        o.m === x.minutes &&
        o.ahead === x.ahead
      )
        return o;
      const row: EdStep = {
        k: o?.k ?? 'n' + uid(),
        t: x.title,
        d: x.body,
        m: x.minutes,
        auto: false,
        det: detectMin(x.title + ' ' + x.body),
        ahead: x.ahead,
        ...(o?.src != null ? { src: o.src } : {}),
      };
      changed.push(row.k);
      return row;
    }),
  };
  if (next.title !== base.title) changed.unshift(FIELD_MARK.title);
  if (next.desc !== base.desc) changed.unshift(FIELD_MARK.desc);
  if (next.base !== base.base) changed.unshift(FIELD_MARK.base);
  if (next.time !== base.time) changed.unshift(FIELD_MARK.time);
  if (next.level !== base.level) changed.unshift(FIELD_MARK.level);
  return { next, changed };
}
