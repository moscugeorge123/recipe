import { useQueries, type UseQueryResult } from '@tanstack/react-query';
import { useMemo } from 'react';
import { create } from 'zustand';

import { useCollections } from '@/features/collections/hooks';
import type { CollectionSummary } from '@/features/collections/types';
import { usePantryItems } from '@/features/pantry/hooks';
import { QUERY_FRESHNESS, recipeKeys } from '@/features/query-keys';
import { networkFirst, persistKeyFor } from '@/features/query-persist';
import { getRecipe } from '@/features/recipes/api';
import { useRecipeSearch } from '@/features/recipes/hooks/use-recipes';
import type { RecipeView } from '@/features/recipes/types';
import { hueOf } from '@/tortie/color';
import { useTRecipes, type TRecipe } from '@/tortie/data/recipes';
import { fmtT, plz, splitEmoji } from '@/tortie/lib/fmt';
import { useNav } from '@/tortie/nav-store';

export type QuickFilter = 'all' | 'quick' | 'veg' | 'sea' | 'slow' | 'bake';
export const FILTERS: [QuickFilter, string][] = [
  ['all', 'All'],
  ['quick', 'Under 30 min'],
  ['veg', 'Vegetarian'],
  ['sea', 'Seafood'],
  ['slow', 'Slow & weekend'],
  ['bake', 'Baking'],
];

export type RecipeSortKey = 'recent' | 'az' | 'quick' | 'cooked';
export type RF = {
  sort: RecipeSortKey;
  time: 'any' | number;
  /** Selected API difficulties (Easy · Medium · Hard). */
  lv: Partial<Record<string, boolean>>;
  saved: boolean;
  pantry: boolean;
  view: 'grid' | 'list';
};
export type CF = {
  sort: 'updated' | 'az' | 'size';
  own: 'all' | 'mine' | 'shared';
  empty: boolean;
  view: 'grid' | 'list';
};

export const RF0: RF = {
  sort: 'recent',
  time: 'any',
  lv: {},
  saved: false,
  pantry: false,
  view: 'grid',
};
export const CF0: CF = {
  sort: 'updated',
  own: 'all',
  empty: true,
  view: 'grid',
};
export const LEVELS = ['Easy', 'Medium', 'Hard'] as const;

type CbSeg = 'recipes' | 'collections';

type CookbookState = {
  filter: QuickFilter;
  q: string;
  cbSeg: CbSeg;
  /** Recipes ↔ Collections cross-fade (160ms). */
  cbFade: boolean;
  /** Grid cross-fade for quick filters (150ms) and live sheet changes (120ms). */
  gridOut: boolean;
  rf: RF;
  cf: CF;
  setQ: (q: string) => void;
  setFilter: (k: QuickFilter) => void;
  setCbSeg: (k: CbSeg) => void;
  setRF: (p: Partial<RF> | ((rf: RF) => Partial<RF>)) => void;
  setCF: (p: Partial<CF>) => void;
  resetRF: () => void;
  resetCF: () => void;
  goCollections: () => void;
  openColl: (id: string) => void;
};

let cbTimer: ReturnType<typeof setTimeout> | null = null;
let rfTimer: ReturnType<typeof setTimeout> | null = null;
let rfPending: Partial<RF> = {};

/** Cookbook filter / sort state, shared by the screen and the filter sheet. */
export const useCookbook = create<CookbookState>()((set, get) => ({
  filter: 'all',
  q: '',
  cbSeg: 'recipes',
  cbFade: false,
  gridOut: false,
  rf: RF0,
  cf: CF0,
  setQ: (q) => set({ q }),
  setFilter: (k) => {
    if (k === get().filter) return;
    set({ gridOut: true });
    setTimeout(() => set({ filter: k, gridOut: false }), 150);
  },
  setCbSeg: (k) => {
    if (k === get().cbSeg) return;
    if (useNav.getState().sel) useNav.getState().clearSel();
    if (cbTimer) clearTimeout(cbTimer);
    set({ cbFade: true });
    cbTimer = setTimeout(() => set({ cbSeg: k, cbFade: false }), 160);
  },
  setRF: (p) => {
    const eff = { ...get().rf, ...rfPending };
    rfPending = { ...rfPending, ...(typeof p === 'function' ? p(eff) : p) };
    set({ gridOut: true });
    if (rfTimer) clearTimeout(rfTimer);
    rfTimer = setTimeout(() => {
      const patch = rfPending;
      rfPending = {};
      set((s) => ({ rf: { ...s.rf, ...patch }, gridOut: false }));
    }, 120);
  },
  setCF: (p) => set((s) => ({ cf: { ...s.cf, ...p } })),
  resetRF: () => set((s) => ({ rf: { ...RF0, view: s.rf.view } })),
  resetCF: () => set((s) => ({ cf: { ...CF0, view: s.cf.view } })),
  goCollections: () => {
    set({ q: '' });
    useNav.getState().set({ cookbookColl: null });
    get().setCbSeg('collections');
  },
  openColl: (id) => {
    useNav.getState().set({ cookbookColl: id });
    set({ q: '', filter: 'all' });
    get().setCbSeg('recipes');
  },
}));

/**
 * Quick-filter mapping. The API has no diet/course tags beyond categories
 * (defaults: breakfast · lunch · dinner · sweet, plus user categories), so each chip
 * matches against a haystack of title, description, cuisine and category names/slugs:
 * - Under 30 min: known total time ≤ 30.
 * - Vegetarian: an explicit vegetarian/vegan word, or no meat/fish word at all.
 * - Seafood: a fish/shellfish word.
 * - Slow & weekend: total time ≥ 2 h, or slow/braise/weekend/Sunday/overnight/stew.
 * - Baking: bake/bread/cake/pastry-style words (a user "Baking" category matches too).
 */
const MEAT =
  /\b(chicken|beef|pork|lamb|bacon|ham|sausages?|steaks?|mince|turkey|duck|veal|chorizo|prosciutto|pancetta|salami|ribs?|meatballs?|guanciale)\b/;
const SEA =
  /\b(fish|seafood|salmon|cod|tuna|prawns?|shrimps?|branzino|bass|mussels?|clams?|crab|lobster|squid|calamari|octopus|scallops?|anchov\w*|sardines?|trout|halibut|mackerel|haddock|oysters?)\b/;
const VEG = /\b(vegetarian|vegan|veggie|meat-free|meatless|plant-based)\b/;
const SLOW = /\b(slow|braised?|braising|weekend|sunday|overnight|stew)\b/;
const BAKE =
  /\b(bak(e|ed|es|ing)|bread|loaf|sourdough|cakes?|cookies?|muffins?|brownies?|pies?|tarts?|pastry|pastries|scones?|focaccia|biscuits?|buns?|croissants?|brioche|galette)\b/;

function hay(r: TRecipe): string {
  return [r.title, r.desc, r.cuisine, ...r.categories].join(' ').toLowerCase();
}

export function matchesQuick(r: TRecipe, k: QuickFilter): boolean {
  if (k === 'all') return true;
  if (k === 'quick') return r.time > 0 && r.time <= 30;
  const h = hay(r);
  if (k === 'veg') return VEG.test(h) || (!MEAT.test(h) && !SEA.test(h));
  if (k === 'sea') return SEA.test(h);
  if (k === 'slow') return r.time >= 120 || SLOW.test(h);
  return BAKE.test(h);
}

type DetailData = (RecipeView & { fromCache?: boolean }) | undefined;
const combineDetails = (
  rs: UseQueryResult<RecipeView & { fromCache?: boolean }>[],
): DetailData[] => rs.map((r) => r.data);

/**
 * Ingredient names per recipe for ingredient search and "Cook from my pantry".
 * The list endpoint has no ingredients, so this loads the details only while one of
 * those features is in use; it shares `recipeKeys.detail` with the detail screen.
 */
export function useIngredientIndex(
  ids: string[],
  enabled: boolean,
): Map<string, string[]> {
  const data = useQueries({
    queries: (enabled ? ids.filter((id) => !id.startsWith('seed:')) : []).map(
      (id) => ({
        queryKey: recipeKeys.detail(id),
        queryFn: async ({ signal }: { signal: AbortSignal }) => {
          const res = await networkFirst(
            persistKeyFor(recipeKeys.detail(id)),
            () => getRecipe(id, signal),
          );
          return { ...res.data, fromCache: res.fromCache };
        },
        staleTime: QUERY_FRESHNESS.recipeDetail,
        retry: 1,
      }),
    ),
    combine: combineDetails,
  });
  return useMemo(() => {
    const m = new Map<string, string[]>();
    for (const d of data) {
      if (d && d.ingredients.length)
        m.set(
          d.id,
          d.ingredients.map((x) => x.name.toLowerCase()),
        );
    }
    return m;
  }, [data]);
}

/** Pantry words, prototype `pn`: first word of each item, singular, 3+ letters. */
export function usePantryWords(): string[] {
  const q = usePantryItems();
  return useMemo(
    () =>
      (q.data?.items ?? [])
        .flatMap((p) => [p.name, p.canonicalName ?? ''])
        .map((n) => n.toLowerCase().split(/[ ,]/)[0]!.replace(/s$/, ''))
        .filter((w, i, a) => w.length > 2 && a.indexOf(w) === i),
    [q.data],
  );
}

export const homeCount = (ings: string[], pn: string[]) =>
  ings.filter((x) => pn.some((w) => x.includes(w))).length;

function daysAgo(iso: string): number {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 0;
  const a = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const now = new Date();
  const b = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  return Math.max(0, Math.round((b - a) / 864e5));
}

export type BookItem = { r: TRecipe; meta: string };
export type CollTile = { hue: number; uri: string | null } | null;
export type CollItem = {
  id: string;
  n: string;
  emo: string;
  meta: string;
  tiles: CollTile[];
  count: number;
  view: CollectionSummary;
};

/** Collection display name without its leading emoji, plus the emoji. */
export function collName(c: Pick<CollectionSummary, 'name'>): {
  n: string;
  emo: string;
} {
  const [emo, n] = splitEmoji(c.name);
  return { n: n || c.name, emo };
}

/** Everything the Cookbook screen and its filter sheet render (prototype `list`/`list2`/`book`/`colls`). */
export function useCookbookView() {
  const { filter, q: rawQ, cbSeg, rf, cf } = useCookbook();
  const coll = useNav((s) => s.cookbookColl);
  const recipes = useTRecipes();
  const collections = useCollections();
  const q = rawQ.trim().toLowerCase();
  const server = useRecipeSearch(q);
  const pn = usePantryWords();
  const ids = useMemo(() => recipes.list.map((r) => r.id), [recipes.list]);
  const ingIndex = useIngredientIndex(ids, q.length > 0 || rf.pantry);

  const allColls = useMemo(
    () => collections.data?.items ?? [],
    [collections.data],
  );
  const collO = coll ? (allColls.find((c) => c.id === coll) ?? null) : null;

  const book = useMemo<BookItem[]>(() => {
    const serverIds = q
      ? new Set((server.data?.items ?? []).map((x) => x.id))
      : null;
    const lvs = Object.keys(rf.lv).filter((k) => rf.lv[k]);
    const home = (r: TRecipe) => homeCount(ingIndex.get(r.id) ?? [], pn);
    const out = recipes.list.filter((r) => {
      if (!matchesQuick(r, filter)) return false;
      if (
        q &&
        !(
          r.title.toLowerCase().includes(q) ||
          serverIds?.has(r.id) ||
          (ingIndex.get(r.id) ?? []).some((n) => n.includes(q))
        )
      )
        return false;
      if (collO && !collO.recipeIds.includes(r.id)) return false;
      if (rf.time !== 'any' && r.time > rf.time) return false;
      if (lvs.length && !lvs.includes(r.level)) return false;
      if (rf.saved && !r.saved) return false;
      if (rf.pantry) {
        const n = ingIndex.get(r.id)?.length ?? 0;
        if (!n || home(r) / n < 1 / 3) return false;
      }
      return true;
    });
    if (rf.sort === 'az') out.sort((x, y) => x.title.localeCompare(y.title));
    else if (rf.sort === 'quick') out.sort((x, y) => x.time - y.time);
    else if (rf.sort === 'cooked') out.sort((x, y) => y.cooked - x.cooked);
    return out.map((r) => ({
      r,
      meta:
        fmtT(r.time) +
        ' · ' +
        (rf.pantry
          ? `${home(r)} of ${ingIndex.get(r.id)?.length ?? r.ingCount} at home`
          : rf.sort === 'cooked'
            ? `Cooked ${r.cooked}×`
            : r.level),
    }));
  }, [recipes.list, filter, q, server.data, collO, rf, ingIndex, pn]);

  const colls = useMemo<CollItem[]>(() => {
    const byId = new Map(recipes.list.map((r) => [r.id, r]));
    const cl = allColls
      .map((c) => ({ c, ...collName(c) }))
      .filter(
        ({ c, n }) =>
          cf.own !== 'shared' &&
          (cf.empty || c.recipeIds.length > 0) &&
          (!q || n.toLowerCase().includes(q)),
      );
    if (cf.sort === 'az') cl.sort((x, y) => x.n.localeCompare(y.n));
    else if (cf.sort === 'size')
      cl.sort((x, y) => y.c.recipeIds.length - x.c.recipeIds.length);
    else
      cl.sort((x, y) =>
        (y.c.updatedAt ?? '').localeCompare(x.c.updatedAt ?? ''),
      );
    return cl.map(({ c, n, emo }) => {
      const count = c.recipeIds.length;
      const up = daysAgo(c.updatedAt);
      return {
        id: c.id,
        n,
        emo,
        count,
        view: c,
        meta:
          (count ? plz(count, 'recipe') : 'Empty') +
          (cf.sort === 'updated'
            ? ' · ' +
              (up === 0 ? 'today' : up === 1 ? 'yesterday' : up + ' days ago')
            : ''),
        tiles: [0, 1, 2, 3].map((j) => {
          const rid = c.recipeIds[j];
          if (!rid) return null;
          const cover = c.coverPreviews.find((p) => p.recipeId === rid);
          return {
            hue: hueOf(rid),
            uri: cover?.thumbnailUrl ?? byId.get(rid)?.uri ?? null,
          };
        }),
      };
    });
  }, [allColls, recipes.list, cf, q]);

  const lvCount = Object.values(rf.lv).filter(Boolean).length;
  const rCnt =
    (rf.sort !== 'recent' ? 1 : 0) +
    (rf.time !== 'any' ? 1 : 0) +
    lvCount +
    (rf.pantry ? 1 : 0);
  const cCnt =
    (cf.sort !== 'updated' ? 1 : 0) +
    (cf.own !== 'all' ? 1 : 0) +
    (!cf.empty ? 1 : 0);
  const isC = cbSeg === 'collections';

  return {
    isC,
    book,
    colls,
    collO,
    nAll: recipes.total,
    nSaved: recipes.list.filter((r) => r.saved).length,
    nColls: allColls.length,
    rCnt,
    cCnt,
    aCnt: isC ? cCnt : rCnt,
    recipesLoading: recipes.isLoading && recipes.list.length === 0,
    collsLoading: collections.isLoading && allColls.length === 0,
  };
}
