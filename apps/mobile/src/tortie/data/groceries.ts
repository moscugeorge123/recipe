import { parsePantryText } from '@recipe/contracts';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

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
import { convertAmount, ingredientAmount } from '@/features/recipes/units';
import {
  formatGroceryQty,
  groceryListOrder,
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
import { useTortiePrefs, type Units } from '@/tortie/prefs-store';
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

/** Prefer the emoji the organizer stored. 🥣 is the generic placeholder, so a lexicon match replaces it. */
export function emojiFor(
  name: string,
  apiEmoji: string | null | undefined,
  fallback = '🛒',
): string {
  if (apiEmoji && apiEmoji !== '🥣' && isOneEmoji(apiEmoji)) return apiEmoji;
  const L = lexOf(name);
  if (L) return L[1];
  return apiEmoji && isOneEmoji(apiEmoji) ? apiEmoji : fallback;
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
  units: Units = 'metric',
  /** Chosen aisle. Wins over the name lexicon. */
  aisle?: number,
): TGroc {
  const amount = convertAmount(v.quantity ?? null, v.unit ?? null, units);
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
    q: formatGroceryQty(amount.quantity, amount.unit),
    src,
    a:
      aisle != null && aisle >= 0 && aisle <= 5
        ? aisle
        : aisleIndexOf(v.name, v.category),
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
  const aisles = useGroceryAisles((s) => s.by);
  const units = useTortiePrefs((s) => s.units);
  const list = useMemo(
    () =>
      groceryListOrder(q.data?.items ?? []).map((v) =>
        toTGroc(v, recipeTitle, notes[v.id], units, aisles[v.id]),
      ),
    [q.data, recipeTitle, notes, units, aisles],
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
  /** "3 + 5 = 8" when this amount was added onto a row already there. */
  sum?: string;
};
export type Pending = {
  id: string;
  raw: string;
  dest: Dest;
  t0: number;
  res?: SmartRes;
  /** API ids kept out of their group until the row joins. */
  holds?: string[];
  /** Set once classification finishes. Nothing is saved until one is accepted. */
  proposals?: Proposal[];
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

type AislePick = {
  /** Shopping-list id → design aisle index. Missing ids follow the name. */
  by: Record<string, number>;
  set: (id: string, aisle: number) => void;
  clear: (id: string) => void;
};

/** Aisle the shopper picked. The API category still loses to the name lexicon. */
export const useGroceryAisles = create<AislePick>()(
  persist(
    (set) => ({
      by: {},
      set: (id, aisle) =>
        set((s) => ({ by: { ...s.by, [id]: aisle } })),
      clear: (id) =>
        set((s) => {
          if (!(id in s.by)) return s;
          const { [id]: _gone, ...by } = s.by;
          return { by };
        }),
    }),
    {
      name: 'tortie-grocery-aisles',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ by }) => ({ by }),
    },
  ),
);

export const useGrocUi = create<GrocUi>()((set) => ({
  pending: [],
  fresh: {},
  secFade: false,
  setSec: (k) => {
    if (k === useNav.getState().grocSec) return;
    if (secT) clearTimeout(secT);
    set({ secFade: true });
    secT = setTimeout(() => {
      useNav.getState().set({ grocSec: k, grocEdit: false, gedOn: false });
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

export function editShop(
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

/** A classified ingredient waiting for the user to keep or skip it. */
export type Proposal = {
  key: string;
  res: SmartRes;
  shop?: ShoppingListWriteItem;
  pantry?: PantryWrite;
};

type Classified = { res: SmartRes; id: string; existed: boolean };

function organizeWait(raw: string): number {
  const lines = Math.max(1, parsePantryText(raw).length);
  return Math.min(25_000, 9_000 + (lines - 1) * 2_000);
}

function linesOf(raw: string): string[] {
  const lines = parsePantryText(raw);
  return lines.length ? lines : [raw];
}

function shopFromOrganized(org: OrganizedPantryItem): ShoppingListWriteItem {
  const e = emojiFor(org.name, org.emoji);
  return {
    name: cap(org.name),
    ...(org.quantity != null ? { quantity: org.quantity } : {}),
    ...(org.unit ? { unit: org.unit } : {}),
    ...(isGroceryCategory(org.category) ? { category: org.category } : {}),
    ...(isOneEmoji(e) ? { emoji: e } : {}),
  };
}

function shopFromLocal(raw: string): ShoppingListWriteItem {
  const local = parseLocal(raw);
  return { name: local.n, ...qtyParts(local.q) };
}

function resFromShop(
  v: ShoppingListItemView,
  hint?: { e?: string; q?: string; sh?: number },
): SmartRes {
  return {
    n: cap(v.name),
    e: emojiFor(v.name, v.emoji, hint?.e),
    q: formatGroceryQty(v.quantity, v.unit) || hint?.q || '',
    a: aisleIndexOf(v.name, v.category),
    sh: hint?.sh ?? shelfFor(v.name, v.category),
  };
}

function unitsSame(
  left: string | null | undefined,
  right: string | null | undefined,
): boolean {
  return (left ?? '').trim().toLowerCase() === (right ?? '').trim().toLowerCase();
}

function shopProposal(
  items: ShoppingListItemView[],
  body: ShoppingListWriteItem,
  index: number,
): Proposal {
  const hit = items.find((item) => sameName(item.name, body.name));
  const incoming = body.quantity ?? null;
  const canAdd =
    !!hit &&
    hit.quantity != null &&
    incoming != null &&
    unitsSame(hit.unit, body.unit);
  const total = canAdd ? hit.quantity! + incoming : null;
  const sum = canAdd
    ? addedLine(hit.quantity, hit.unit, incoming, body.unit, total, body.unit ?? hit.unit)
    : undefined;
  return {
    key: 's' + index,
    shop: body,
    res: {
      n: cap(body.name),
      e: emojiFor(body.name, body.emoji),
      q: formatGroceryQty(canAdd ? total : incoming, body.unit ?? hit?.unit) || '',
      a: aisleIndexOf(body.name, body.category),
      sh: shelfFor(body.name, body.category),
      ...(sum ? { sum } : {}),
    },
  };
}

function pantryProposal(
  items: PantryItemView[],
  body: PantryWrite,
  res: SmartRes,
  index: number,
): Proposal {
  const hit = items.find(
    (item) =>
      sameName(item.name, body.name) ||
      (!!body.canonicalName && item.canonicalName === body.canonicalName),
  );
  const incoming = body.quantity ?? null;
  const canAdd =
    !!hit &&
    hit.quantity != null &&
    incoming != null &&
    unitsSame(hit.unit, body.unit);
  const total = canAdd ? hit.quantity! + incoming : null;
  const sum = canAdd
    ? addedLine(hit.quantity, hit.unit, incoming, body.unit, total, body.unit ?? hit.unit)
    : undefined;
  return {
    key: 'p' + index,
    pantry: body,
    res: {
      ...res,
      q: formatGroceryQty(canAdd ? total : incoming, body.unit ?? hit?.unit) || res.q,
      ...(sum ? { sum } : {}),
    },
  };
}

function addedLine(
  previous: number | null | undefined,
  previousUnit: string | null | undefined,
  incoming: number | null | undefined,
  incomingUnit: string | null | undefined,
  next: number | null | undefined,
  nextUnit: string | null | undefined,
): string | undefined {
  if (previous == null || incoming == null || next == null || next === previous) {
    return undefined;
  }
  const before = formatGroceryQty(previous, previousUnit);
  const extra = formatGroceryQty(incoming, incomingUnit);
  const total = formatGroceryQty(next, nextUnit);
  if (!before || !extra || !total) return undefined;
  return `${before} + ${extra} = ${total}`;
}

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

  const readOrganized = useCallback(
    async (raw: string): Promise<OrganizedPantryItem[] | undefined> => {
      try {
        const items = (
          await withTimeout(organize.mutateAsync({ text: raw }), organizeWait(raw))
        ).items;
        return items.length ? items : undefined;
      } catch {
        return undefined;
      }
    },
    [organize],
  );

  const draftGroc = useCallback(
    async (raw: string): Promise<Proposal[]> => {
      const organized = await readOrganized(raw);
      const bodies = organized
        ? organized.map(shopFromOrganized)
        : linesOf(raw).map(shopFromLocal);
      const items = shopNow(client);
      return bodies.map((body, index) => shopProposal(items, body, index));
    },
    [client, readOrganized],
  );

  const draftPantry = useCallback(
    async (raw: string): Promise<Proposal[]> => {
      const organized = await readOrganized(raw);
      const rows = organized
        ? organized.map((org) => {
            const n = cap(org.name);
            const e = emojiFor(n, org.emoji);
            const sh = shelfFor(n, org.category);
            const body: PantryWrite = {
              ...org,
              name: n,
              ...(isGroceryCategory(org.category) ? {} : { category: undefined }),
              storageLocation: storageFor(sh),
            };
            const res: SmartRes = {
              n,
              e,
              q: formatGroceryQty(org.quantity, org.unit),
              a: aisleIndexOf(n, org.category),
              sh,
            };
            return { body, res };
          })
        : linesOf(raw).map((line) => {
            const local = parseLocal(line);
            const body: PantryWrite = {
              name: local.n,
              ...(isOneEmoji(local.e) ? { emoji: local.e } : {}),
              ...qtyParts(local.q),
              storageLocation: storageFor(local.sh),
            };
            const res: SmartRes = {
              n: local.n,
              e: local.e,
              q: local.q,
              a: local.a,
              sh: local.sh,
            };
            return { body, res };
          });
      const items = pantryNow(client);
      return rows.map((row, index) =>
        pantryProposal(items, row.body, row.res, index),
      );
    },
    [client, readOrganized],
  );

  const commitShop = useCallback(
    async (proposals: Proposal[]): Promise<Classified[]> => {
      const bodies = proposals.flatMap((proposal) =>
        proposal.shop ? [proposal.shop] : [],
      );
      if (!bodies.length) return [];
      const prior = new Map(shopNow(client).map((item) => [item.id, item]));
      const saved: ShoppingListItemView[] = [];
      for (let i = 0; i < bodies.length; i += 50) {
        saved.push(...(await addItems.mutateAsync(bodies.slice(i, i + 50))));
      }
      editShop(client, (items) => saved.reduce(upsert, items));
      return saved.map((v, index) => {
        const prev = prior.get(v.id);
        const body = bodies[index];
        const sum = addedLine(
          prev?.quantity,
          prev?.unit,
          body?.quantity,
          body?.unit,
          v.quantity,
          v.unit,
        );
        return {
          res: { ...resFromShop(v), ...(sum ? { sum } : {}) },
          id: v.id,
          existed: !!prev,
        };
      });
    },
    [client, addItems],
  );

  const commitPantry = useCallback(
    async (proposals: Proposal[]): Promise<Classified[]> => {
      const bodies = proposals.flatMap((proposal) =>
        proposal.pantry ? [proposal.pantry] : [],
      );
      if (!bodies.length) return [];
      const prior = new Map(pantryNow(client).map((item) => [item.id, item]));
      const saved: PantryItemView[] = [];
      for (let i = 0; i < bodies.length; i += 50) {
        saved.push(...(await savePantry.mutateAsync(bodies.slice(i, i + 50))));
      }
      return saved.flatMap((v, index) => {
        if (!v) return [];
        const prev = prior.get(v.id);
        const body = bodies[index];
        const sum = addedLine(
          prev?.quantity,
          prev?.unit,
          body?.quantity,
          body?.unit,
          v.quantity,
          v.unit,
        );
        editPantry(client, (items) => upsert(items, v));
        return [
          {
            res: {
              n: cap(v.name),
              e: emojiFor(v.name, v.emoji),
              q: formatGroceryQty(v.quantity, v.unit),
              a: aisleIndexOf(v.name, v.category),
              sh: shelfFor(v.name, v.category),
              ...(sum ? { sum } : {}),
            },
            id: v.id,
            existed: !!prev,
          },
        ];
      });
    },
    [client, savePantry],
  );

  const classifyGroc = useCallback(
    async (raw: string, write?: ShoppingListWriteItem): Promise<Classified[]> => {
      const prior = new Map(shopNow(client).map((item) => [item.id, item]));
      let bodies: ShoppingListWriteItem[];
      if (write) {
        bodies = [write];
      } else {
        const organized = await readOrganized(raw);
        bodies = organized
          ? organized.map(shopFromOrganized)
          : linesOf(raw).map(shopFromLocal);
      }
      if (!bodies.length) throw new Error('empty');
      const saved: ShoppingListItemView[] = [];
      for (let i = 0; i < bodies.length; i += 50) {
        saved.push(...(await addItems.mutateAsync(bodies.slice(i, i + 50))));
      }
      if (!saved.length) throw new Error('empty');
      editShop(client, (items) => saved.reduce(upsert, items));
      return saved.map((v, index) => {
        const prev = prior.get(v.id);
        const body = bodies[index];
        const sum = addedLine(
          prev?.quantity,
          prev?.unit,
          body?.quantity,
          body?.unit,
          v.quantity,
          v.unit,
        );
        return {
          res: { ...resFromShop(v), ...(sum ? { sum } : {}) },
          id: v.id,
          existed: !!prev,
        };
      });
    },
    [client, addItems, readOrganized],
  );

  const classifyPantry = useCallback(
    async (raw: string): Promise<Classified[]> => {
      const organized = await readOrganized(raw);
      const rows = organized
        ? organized.map((org) => {
            const n = cap(org.name);
            const e = emojiFor(n, org.emoji);
            const sh = shelfFor(n, org.category);
            const res: SmartRes = {
              n,
              e,
              q: formatGroceryQty(org.quantity, org.unit),
              a: aisleIndexOf(n, org.category),
              sh,
            };
            return { org, res, sh };
          })
        : linesOf(raw).map((line) => {
            const local = parseLocal(line);
            const res: SmartRes = {
              n: local.n,
              e: local.e,
              q: local.q,
              a: local.a,
              sh: local.sh,
            };
            return { org: undefined, res, sh: local.sh };
          });
      if (!rows.length) throw new Error('empty');
      const out: Classified[] = [];
      const bodies: PantryWrite[] = [];
      const prior = new Map<number, { quantity: number | null; unit: string | null }>();
      rows.forEach((row, index) => {
        const hit = pantryNow(client).find(
          (p) =>
            sameName(p.name, row.res.n) ||
            (!!row.org?.canonicalName && p.canonicalName === row.org.canonicalName),
        );
        if (hit) prior.set(index, { quantity: hit.quantity, unit: hit.unit });
        const e = row.res.e;
        const base = row.org
          ? {
              ...row.org,
              name: row.res.n,
              ...(isGroceryCategory(row.org.category)
                ? {}
                : { category: undefined }),
            }
          : {
              name: row.res.n,
              ...(isOneEmoji(e) ? { emoji: e } : {}),
              ...qtyParts(row.res.q),
            };
        bodies.push({ ...base, storageLocation: storageFor(row.sh) });
      });
      if (bodies.length) {
        const saved: PantryItemView[] = [];
        for (let i = 0; i < bodies.length; i += 50) {
          saved.push(...(await savePantry.mutateAsync(bodies.slice(i, i + 50))));
        }
        saved.forEach((v, index) => {
          if (!v) return;
          const prev = prior.get(index);
          const body = bodies[index];
          const sum = addedLine(
            prev?.quantity,
            prev?.unit,
            body?.quantity,
            body?.unit,
            v.quantity,
            v.unit,
          );
          editPantry(client, (items) => upsert(items, v));
          out[index] = {
            res: {
              ...rows[index]!.res,
              n: cap(v.name),
              e: emojiFor(v.name, v.emoji, rows[index]!.res.e),
              q: formatGroceryQty(v.quantity, v.unit),
              ...(sum ? { sum } : {}),
            },
            id: v.id,
            existed: !!prev,
          };
        });
      }
      return out.filter((row): row is Classified => !!row);
    },
    [client, readOrganized, savePantry],
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
      if (!opts?.write) {
        try {
          const work = dest === 'pantry' ? draftPantry(raw) : draftGroc(raw);
          const [proposals] = await Promise.all([work, sleep(smartMin())]);
          if (!useGrocUi.getState().pending.some((p) => p.id === id)) return;
          if (!proposals.length) {
            dropPending(id);
            toast('Couldn’t add ' + raw + ' — try again');
            return;
          }
          setPending(id, { proposals });
        } catch {
          dropPending(id);
          toast('Couldn’t add ' + raw + ' — try again');
        }
        return;
      }
      let rows: Classified[];
      try {
        const work = (
          dest === 'pantry'
            ? classifyPantry(raw)
            : classifyGroc(raw, opts?.write)
        ).then((found) => {
          const holds = found.filter((row) => !row.existed).map((row) => row.id);
          if (holds.length) setPending(id, { holds });
          return found;
        });
        [rows] = await Promise.all([work, sleep(smartMin())]);
      } catch {
        dropPending(id);
        toast('Couldn’t add ' + raw + ' — try again');
        return;
      }
      if (!useGrocUi.getState().pending.some((p) => p.id === id)) return;
      if (!rows.length) {
        dropPending(id);
        toast('Couldn’t add ' + raw + ' — try again');
        return;
      }
      if (rows.length === 1) setPending(id, { res: rows[0]!.res });
      await sleep(joinHold());
      for (const row of rows) {
        if (dest === 'pantry' && row.existed)
          usePantryExtras.getState().patch(row.id, { lv: 3, listed: false });
        if (dest === 'groc' && opts?.note && !row.existed)
          usePantryExtras.getState().note(row.id, opts.note);
      }
      dropPending(id);
      for (const row of rows) {
        if (!row.existed || row.res.sum) flash(row.id);
        if (row.res.sum) toast(row.res.n + ' · ' + row.res.sum);
      }
      if (rows.length > 1) {
        toast(
          rows.length +
            ' items added to ' +
            (dest === 'pantry' ? 'your pantry' : 'groceries'),
        );
      }
    },
    [classifyGroc, classifyPantry, draftGroc, draftPantry],
  );

  const finishAccepted = useCallback((rows: Classified[], dest: Dest) => {
    for (const row of rows) {
      if (dest === 'pantry' && row.existed)
        usePantryExtras.getState().patch(row.id, { lv: 3, listed: false });
      if (!row.existed || row.res.sum) flash(row.id);
      if (row.res.sum) toast(row.res.n + ' · ' + row.res.sum);
    }
  }, []);

  const acceptProposal = useCallback(
    async (pendingId: string, key: string) => {
      const group = useGrocUi.getState().pending.find((p) => p.id === pendingId);
      const proposal = group?.proposals?.find((item) => item.key === key);
      if (!group || !proposal) return;
      const rest = group.proposals?.filter((item) => item.key !== key) ?? [];
      setPending(pendingId, { proposals: rest });
      try {
        const rows =
          group.dest === 'pantry'
            ? await commitPantry([proposal])
            : await commitShop([proposal]);
        finishAccepted(rows, group.dest);
      } catch {
        const current = useGrocUi.getState().pending.find((p) => p.id === pendingId);
        setPending(pendingId, {
          proposals: [...(current?.proposals ?? []), proposal],
        });
        toast('Couldn’t add ' + proposal.res.n + ' — try again');
        return;
      }
      const left = useGrocUi.getState().pending.find((p) => p.id === pendingId);
      if (!left?.proposals?.length) dropPending(pendingId);
    },
    [commitPantry, commitShop, finishAccepted],
  );

  const acceptAll = useCallback(
    async (pendingId: string) => {
      const group = useGrocUi.getState().pending.find((p) => p.id === pendingId);
      const proposals = group?.proposals ?? [];
      if (!group || !proposals.length) return;
      setPending(pendingId, { proposals: [] });
      try {
        const rows =
          group.dest === 'pantry'
            ? await commitPantry(proposals)
            : await commitShop(proposals);
        finishAccepted(rows, group.dest);
        if (rows.length > 1 && !rows.some((row) => row.res.sum)) {
          toast(
            rows.length +
              ' items added to ' +
              (group.dest === 'pantry' ? 'your pantry' : 'groceries'),
          );
        }
        dropPending(pendingId);
      } catch {
        setPending(pendingId, { proposals });
        toast('Couldn’t add these — try again');
      }
    },
    [commitPantry, commitShop, finishAccepted],
  );

  const dismissProposal = useCallback((pendingId: string, key: string) => {
    const group = useGrocUi.getState().pending.find((p) => p.id === pendingId);
    const rest = group?.proposals?.filter((item) => item.key !== key) ?? [];
    if (!rest.length) dropPending(pendingId);
    else setPending(pendingId, { proposals: rest });
  }, []);

  const dismissAll = useCallback((pendingId: string) => {
    dropPending(pendingId);
  }, []);

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
      const units = useTortiePrefs.getState().units;
      for (const r of recipes) {
        for (const ing of partitionByPantry(r.ingredients ?? [], have).need) {
          const key = (ing.canonicalName ?? ing.name).toLowerCase();
          if (seen.has(key) || listed.some((g) => sameName(g.name, ing.name)))
            continue;
          seen.add(key);
          const amount = ingredientAmount(ing, units);
          const q = formatGroceryQty(amount.quantity, amount.unit);
          queue.push({
            raw: (q ? q + ' ' : '') + ing.name,
            write: {
              name: ing.name,
              quantity: amount.quantity,
              unit: amount.unit,
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

  return {
    addRaw,
    acceptProposal,
    acceptAll,
    dismissProposal,
    dismissAll,
    toggle,
    clearBasket,
    restock,
    fillFromPlan,
  };
}
