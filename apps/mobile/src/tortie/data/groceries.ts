import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { create } from 'zustand';

import { pantryKeysFrom, partitionByPantry } from '@/features/pantry/match';
import {
  usePantryItems,
  pantryKeys,
  useOrganizePantry,
  useSavePantryItems,
} from '@/features/pantry/hooks';
import type {
  OrganizedPantryItem,
  PantryItemView,
} from '@/features/pantry/types';
import { QUERY_FRESHNESS, recipeKeys } from '@/features/query-keys';
import { getRecipe } from '@/features/recipes/api';
import { isOneEmoji } from '@/features/recipes/emoji';
import {
  formatGroceryQty,
  isGroceryCategory,
} from '@/features/shopping-list/aisle';
import {
  shoppingListKeys,
  useAddShoppingItems,
  useClearDone,
  usePatchShoppingItem,
  useShoppingList,
} from '@/features/shopping-list/hooks';
import type {
  ShoppingListItemView,
  ShoppingListListPage,
  ShoppingListWriteItem,
} from '@/features/shopping-list/types';
import {
  usePantryExtras,
  type PantryExtras,
  type PantryUnit,
} from '@/tortie/data/pantry-extras';
import { useTRecipes } from '@/tortie/data/recipes';
import { lexOf, parseLocal } from '@/tortie/lib/fmt';
import { motionMultiplier } from '@/tortie/motion';
import { toast, useNav } from '@/tortie/nav-store';

/** Design grocery row (prototype `groc[]`: {id,n,q,src,a,e,done}). */
export type TGroc = {
  id: string;
  n: string;
  q: string;
  src: string;
  /** Index into AISLES. */
  a: number;
  e: string;
  done: boolean;
  view: ShoppingListItemView;
};

/** The API stores a generic 🥣 placeholder; a lexicon match is more specific. */
export function emojiFor(
  name: string,
  apiEmoji: string | null | undefined,
  fallback = '🛒',
): string {
  const L = lexOf(name);
  if (L) return L[1];
  return apiEmoji && apiEmoji !== '🥣' ? apiEmoji : fallback;
}

const CAT_AISLE: Record<string, number> = {
  Produce: 0,
  Meat: 1,
  Dairy: 2,
  Pantry: 3,
  Spices: 3,
  Frozen: 5,
};

/** Design aisle for an item: name lexicon first, then the API category. */
export function aisleIndexOf(
  name: string,
  category: string | null | undefined,
): number {
  const L = lexOf(name);
  if (L) return L[2];
  return category && category in CAT_AISLE ? CAT_AISLE[category]! : 5;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function toTGroc(
  v: ShoppingListItemView,
  recipeTitle?: (id: string) => string | undefined,
  note?: string,
): TGroc {
  const src =
    note ??
    (v.source === 'RECIPE' && v.sourceRecipeId
      ? (recipeTitle?.(v.sourceRecipeId)?.split(' ').slice(0, 2).join(' ') ??
        'From a recipe')
      : v.source === 'MEAL_PLAN'
        ? 'From your plan'
        : 'Added by you');
  return {
    id: v.id,
    n: cap(v.name),
    q: formatGroceryQty(v.quantity, v.unit),
    src,
    a: aisleIndexOf(v.name, v.category),
    e: emojiFor(v.name, v.emoji),
    done: v.done,
    view: v,
  };
}

export function useTGroceries(
  recipeTitle?: (id: string) => string | undefined,
) {
  const q = useShoppingList();
  const notes = usePantryExtras((s) => s.notes);
  const list = useMemo(
    () =>
      (q.data?.items ?? []).map((v) => toTGroc(v, recipeTitle, notes[v.id])),
    [q.data, recipeTitle, notes],
  );
  return { list, isLoading: q.isLoading };
}

/** Recipe title lookup for grocery source lines. */
export function useRecipeTitle() {
  const { list } = useTRecipes();
  return useMemo(() => {
    const m = new Map(list.map((r) => [r.id, r.title]));
    return (id: string) => m.get(id);
  }, [list]);
}

/** Unchecked count for the tab badge. */
export function useGroceriesLeft(): number {
  const q = useShoppingList();
  return (q.data?.items ?? []).filter((i) => !i.done).length;
}

/* ───────────── Pantry ───────────── */

/** Design pantry tile (prototype `pantry[]`: {id,n,e,sh,lv,listed,items,packs,amt,unit}). */
export type TPantry = PantryExtras & {
  id: string;
  n: string;
  e: string;
  sh: number;
  view: PantryItemView;
};

const CAT_SHELF: Record<string, number> = {
  Produce: 1,
  Meat: 0,
  Dairy: 0,
  Pantry: 2,
  Spices: 3,
  Frozen: 4,
};

/** Shelf for a freshly classified item (lexicon, then API category, then Cupboard). */
export function shelfFor(name: string, category?: string | null): number {
  const L = lexOf(name);
  if (L) return L[3];
  return category && category in CAT_SHELF ? CAT_SHELF[category]! : 2;
}

/** Shelf of a stored item: FRIDGE / FREEZER from the API, otherwise the room-temperature shelf the name implies. */
export function shelfOf(v: PantryItemView): number {
  if (v.storageLocation === 'FRIDGE') return 0;
  if (v.storageLocation === 'FREEZER') return 4;
  const s = shelfFor(v.name, v.category);
  return s >= 1 && s <= 3 ? s : 2;
}

export const storageFor = (sh: number): PantryItemView['storageLocation'] =>
  sh === 0 ? 'FRIDGE' : sh === 4 ? 'FREEZER' : 'PANTRY';

const UNITS: PantryUnit[] = ['g', 'kg', 'ml', 'l'];

/** API quantity/unit → the prototype's `qP` split (items · packs · amount). */
export function extrasFromApi(
  quantity: number | null,
  unit: string | null,
): PantryExtras {
  const u = (unit ?? '').trim().toLowerCase();
  const base: PantryExtras = {
    lv: 3,
    items: 1,
    packs: 0,
    amt: null,
    unit: 'g',
    listed: false,
  };
  if (quantity == null) return base;
  if ((UNITS as string[]).includes(u))
    return { ...base, amt: quantity, unit: u as PantryUnit };
  if (/^pack/.test(u)) return { ...base, items: 0, packs: quantity };
  return { ...base, items: quantity };
}

export function toTPantry(
  v: PantryItemView,
  over?: Partial<PantryExtras>,
): TPantry {
  return {
    ...extrasFromApi(v.quantity, v.unit),
    ...over,
    id: v.id,
    n: cap(v.name),
    e: emojiFor(v.name, v.emoji),
    sh: shelfOf(v),
    view: v,
  };
}

export function useTPantry() {
  const q = usePantryItems();
  const by = usePantryExtras((s) => s.by);
  const list = useMemo(
    () => (q.data?.items ?? []).map((v) => toTPantry(v, by[v.id])),
    [q.data, by],
  );
  return { list, isLoading: q.isLoading };
}

/* ───────────── Smart-add queue + section state ───────────── */

export type Dest = 'groc' | 'pantry';
export type SmartRes = {
  n: string;
  e: string;
  q: string;
  a: number;
  sh: number;
};
export type Pending = {
  id: string;
  raw: string;
  dest: Dest;
  t0: number;
  res?: SmartRes;
  /** API id kept out of its group until the row joins (only for items that weren't there before). */
  hold?: string;
};

type GrocUi = {
  pending: Pending[];
  /** Ids that just joined their group ("#eef6ec" flash). */
  fresh: Record<string, true>;
  /** List ↔ Pantry cross-fade in progress. */
  secFade: boolean;
  setSec: (k: Dest) => void;
};

let secT: ReturnType<typeof setTimeout> | null = null;

export const useGrocUi = create<GrocUi>()((set) => ({
  pending: [],
  fresh: {},
  secFade: false,
  setSec: (k) => {
    if (k === useNav.getState().grocSec) return;
    if (secT) clearTimeout(secT);
    set({ secFade: true });
    secT = setTimeout(() => {
      useNav.getState().set({ grocSec: k });
      set({ secFade: false });
    }, 160);
  },
}));

const reducedNow = () => motionMultiplier() <= 0.01;
/** Minimum "thinking" time so the staged caption reads (MOTION.md smart add). */
export const smartMin = () => (reducedNow() ? 500 : 1900);
const joinHold = () => (reducedNow() ? 200 : 1150);
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, j) => setTimeout(() => j(new Error('timeout')), ms)),
  ]);
}

const upd = (fn: (s: GrocUi) => Partial<GrocUi>) => useGrocUi.setState(fn);
const setPending = (id: string, p: Partial<Pending>) =>
  upd((s) => ({
    pending: s.pending.map((x) => (x.id === id ? { ...x, ...p } : x)),
  }));
const dropPending = (id: string) =>
  upd((s) => ({ pending: s.pending.filter((x) => x.id !== id) }));

function flash(id: string) {
  upd((s) => ({ fresh: { ...s.fresh, [id]: true } }));
  setTimeout(
    () =>
      upd((s) => {
        const { [id]: _gone, ...fresh } = s.fresh;
        return { fresh };
      }),
    1300,
  );
}

const SHOP_KEY = shoppingListKeys.list();
const PANTRY_KEY = pantryKeys.list();

const shopNow = (c: QueryClient) =>
  c.getQueryData<ShoppingListListPage>(SHOP_KEY)?.items ?? [];
const pantryNow = (c: QueryClient) =>
  c.getQueryData<{ items: PantryItemView[] }>(PANTRY_KEY)?.items ?? [];

function editShop(
  c: QueryClient,
  fn: (items: ShoppingListItemView[]) => ShoppingListItemView[],
) {
  c.setQueryData<ShoppingListListPage>(SHOP_KEY, (cur) =>
    cur ? { ...cur, items: fn(cur.items) } : cur,
  );
}
/** Optimistic edit of the cached pantry list. */
export function editPantry(
  c: QueryClient,
  fn: (items: PantryItemView[]) => PantryItemView[],
) {
  c.setQueryData<{ items: PantryItemView[] }>(PANTRY_KEY, (cur) =>
    cur ? { ...cur, items: fn(cur.items) } : cur,
  );
}
const upsert = <T extends { id: string }>(items: T[], v: T) =>
  items.some((x) => x.id === v.id)
    ? items.map((x) => (x.id === v.id ? v : x))
    : [...items, v];

/** "500 g" → { quantity: 500, unit: 'g' }; "2" → { quantity: 2 }. */
function qtyParts(q: string): { quantity?: number; unit?: string } {
  const m = q.trim().match(/^(\d+(?:[.,]\d+)?)\s*(.*)$/);
  if (!m) return {};
  const n = parseFloat(m[1]!.replace(',', '.'));
  return m[2] ? { quantity: n, unit: m[2] } : { quantity: n };
}

const sameName = (a: string, b: string) =>
  a.trim().toLowerCase() === b.trim().toLowerCase();

const PLAN_NOTE = 'From your plan';

/** The create endpoint accepts `storageLocation`; the mobile write type doesn't list it. */
type PantryWrite = Partial<OrganizedPantryItem> & {
  name: string;
  storageLocation?: PantryItemView['storageLocation'];
};

/**
 * Grocery & pantry actions. Smart add keeps the prototype choreography:
 * pending row → resolves after BOTH the API classification and the minimum wait →
 * joins its group 1150ms later with a 1300ms highlight.
 */
export function useGroceryActions() {
  const client = useQueryClient();
  const addItems = useAddShoppingItems();
  const patchItem = usePatchShoppingItem();
  const clearDone = useClearDone();
  const organize = useOrganizePantry();
  const savePantry = useSavePantryItems();

  const classifyGroc = useCallback(
    async (raw: string, write?: ShoppingListWriteItem) => {
      const L = parseLocal(raw);
      const before = new Set(shopNow(client).map((x) => x.id));
      const body: ShoppingListWriteItem = write ?? {
        name: L.n,
        ...qtyParts(L.q),
      };
      const [v] = await addItems.mutateAsync([body]);
      if (!v) throw new Error('empty');
      editShop(client, (items) => upsert(items, v));
      const res: SmartRes = {
        n: cap(v.name),
        e: emojiFor(v.name, v.emoji, L.e),
        q: formatGroceryQty(v.quantity, v.unit) || L.q,
        a: aisleIndexOf(v.name, v.category),
        sh: L.sh,
      };
      return { res, id: v.id, existed: before.has(v.id) };
    },
    [client, addItems],
  );

  const classifyPantry = useCallback(
    async (raw: string) => {
      const L = parseLocal(raw);
      let org: OrganizedPantryItem | undefined;
      try {
        org = (await withTimeout(organize.mutateAsync({ text: raw }), 9000))
          .items[0];
      } catch {
        org = undefined;
      }
      const n = org?.name ? cap(org.name) : L.n;
      const e = emojiFor(n, org?.emoji, L.e);
      const sh = shelfFor(n, org?.category);
      const q = org ? formatGroceryQty(org.quantity, org.unit) : L.q;
      const res: SmartRes = { n, e, q, a: aisleIndexOf(n, org?.category), sh };
      const hit = pantryNow(client).find(
        (p) =>
          sameName(p.name, n) ||
          (!!org?.canonicalName && p.canonicalName === org.canonicalName),
      );
      if (hit) return { res, id: hit.id, existed: true };
      const base = org
        ? {
            ...org,
            name: n,
            ...(isGroceryCategory(org.category) ? {} : { category: undefined }),
          }
        : { name: n, ...(isOneEmoji(e) ? { emoji: e } : {}), ...qtyParts(L.q) };
      const body: PantryWrite = { ...base, storageLocation: storageFor(sh) };
      const [v] = await savePantry.mutateAsync([body]);
      if (!v) throw new Error('empty');
      editPantry(client, (items) => upsert(items, v));
      return { res, id: v.id, existed: false };
    },
    [client, organize, savePantry],
  );

  const addRaw = useCallback(
    async (
      rawIn: string,
      dest: Dest,
      opts?: { write?: ShoppingListWriteItem; note?: string },
    ) => {
      const raw = String(rawIn).trim();
      if (!raw) return;
      const id = 'u' + Date.now() + Math.random().toString(36).slice(2, 6);
      upd((s) => ({
        pending: [...s.pending, { id, raw, dest, t0: Date.now() }],
      }));
      let out: { res: SmartRes; id: string; existed: boolean };
      try {
        const work = (
          dest === 'pantry'
            ? classifyPantry(raw)
            : classifyGroc(raw, opts?.write)
        ).then((r) => {
          if (!r.existed) setPending(id, { hold: r.id });
          return r;
        });
        [out] = await Promise.all([work, sleep(smartMin())]);
      } catch {
        dropPending(id);
        toast('Couldn’t add ' + raw + ' — try again');
        return;
      }
      if (!useGrocUi.getState().pending.some((p) => p.id === id)) return;
      setPending(id, { res: out.res });
      await sleep(joinHold());
      if (dest === 'pantry' && out.existed)
        usePantryExtras.getState().patch(out.id, { lv: 3, listed: false });
      if (dest === 'groc' && opts?.note && !out.existed)
        usePantryExtras.getState().note(out.id, opts.note);
      dropPending(id);
      flash(out.id);
    },
    [classifyGroc, classifyPantry],
  );

  const toggle = useCallback(
    (g: TGroc) => {
      const next = !g.done;
      client.cancelQueries({ queryKey: SHOP_KEY }).catch(() => undefined);
      editShop(client, (items) =>
        items.map((x) => (x.id === g.id ? { ...x, done: next } : x)),
      );
      patchItem.mutate(
        { id: g.id, body: { done: next } },
        {
          onError: () => {
            editShop(client, (items) =>
              items.map((x) => (x.id === g.id ? { ...x, done: !next } : x)),
            );
            toast('Couldn’t update your list. Try again.');
          },
        },
      );
    },
    [client, patchItem],
  );

  /** "Clear basket": checked rows move into the pantry, then the API clears them. */
  const clearBasket = useCallback(async () => {
    const dn = shopNow(client).filter((g) => g.done);
    if (!dn.length) return;
    const pan = pantryNow(client);
    const ex = usePantryExtras.getState();
    const toSave: PantryWrite[] = [];
    for (const g of dn) {
      const hit = pan.find(
        (p) =>
          sameName(p.name, g.name) ||
          (!!g.canonicalName && p.canonicalName === g.canonicalName),
      );
      if (hit) {
        ex.patch(hit.id, { lv: 3, listed: false });
        continue;
      }
      if (toSave.some((x) => sameName(x.name, g.name))) continue;
      toSave.push({
        name: g.name,
        ...(g.emoji && isOneEmoji(g.emoji) ? { emoji: g.emoji } : {}),
        ...(isGroceryCategory(g.category) ? { category: g.category } : {}),
        ...(g.quantity != null ? { quantity: g.quantity } : {}),
        ...(g.unit ? { unit: g.unit } : {}),
        storageLocation: storageFor(shelfFor(g.name, g.category)),
      });
    }
    editShop(client, (items) => items.filter((x) => !x.done));
    toast(`${dn.length} items moved to your pantry`);
    try {
      for (let i = 0; i < toSave.length; i += 50)
        await savePantry.mutateAsync(toSave.slice(i, i + 50));
      await clearDone.mutateAsync();
    } catch {
      client
        .invalidateQueries({ queryKey: shoppingListKeys.all })
        .catch(() => undefined);
      toast('Couldn’t clear the basket. Try again.');
    }
  }, [client, savePantry, clearDone]);

  /** Low tile cart button: add to the list once; afterwards it jumps to the list. */
  const restock = useCallback(
    (p: TPantry) => {
      if (p.listed) {
        useGrocUi.getState().setSec('groc');
        return;
      }
      const ex = usePantryExtras.getState();
      ex.patch(p.id, { listed: true });
      toast(p.e + ' ' + p.n + ' added to your list');
      addItems
        .mutateAsync([
          { name: p.n, ...(isOneEmoji(p.e) ? { emoji: p.e } : {}) },
        ])
        .then(([v]) => {
          if (!v) return;
          editShop(client, (items) => upsert(items, v));
          ex.note(v.id, 'Running low');
          flash(v.id);
        })
        .catch(() => {
          ex.patch(p.id, { listed: false });
          toast('Couldn’t add ' + p.n + ' — try again');
        });
    },
    [client, addItems],
  );

  /** Empty list: this week's planned recipes → smart-add queue, 380ms apart. */
  const fillFromPlan = useCallback(
    async (recipeIds: string[]) => {
      if (!recipeIds.length) {
        toast('Nothing planned this week yet');
        return;
      }
      let recipes;
      try {
        recipes = await Promise.all(
          recipeIds.map((id) =>
            client.fetchQuery({
              queryKey: recipeKeys.detail(id),
              queryFn: ({ signal }) => getRecipe(id, signal),
              staleTime: QUERY_FRESHNESS.recipeDetail,
            }),
          ),
        );
      } catch {
        toast('Couldn’t load this week’s recipes — try again');
        return;
      }
      const have = pantryKeysFrom({ items: pantryNow(client) });
      const listed = shopNow(client);
      const seen = new Set<string>();
      const queue: { raw: string; write: ShoppingListWriteItem }[] = [];
      for (const r of recipes) {
        for (const ing of partitionByPantry(r.ingredients ?? [], have).need) {
          const key = (ing.canonicalName ?? ing.name).toLowerCase();
          if (seen.has(key) || listed.some((g) => sameName(g.name, ing.name)))
            continue;
          seen.add(key);
          const q = formatGroceryQty(ing.quantity, ing.unit);
          queue.push({
            raw: (q ? q + ' ' : '') + ing.name,
            write: {
              name: ing.name,
              quantity: ing.quantity,
              unit: ing.unit,
              ...(isGroceryCategory(ing.category)
                ? { category: ing.category }
                : {}),
              ...(ing.emoji && isOneEmoji(ing.emoji)
                ? { emoji: ing.emoji }
                : {}),
              sourceRecipeId: r.id,
            },
          });
        }
      }
      if (!queue.length) {
        toast('This week’s ingredients are already covered');
        return;
      }
      queue.forEach((it, i) =>
        setTimeout(
          () =>
            void addRaw(it.raw, 'groc', { write: it.write, note: PLAN_NOTE }),
          i * 380,
        ),
      );
    },
    [client, addRaw],
  );

  return { addRaw, toggle, clearBasket, restock, fillFromPlan };
}
