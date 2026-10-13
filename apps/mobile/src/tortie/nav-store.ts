import { create } from 'zustand';

import { BASE_D } from '@/tortie/theme';
import { motionMultiplier } from '@/tortie/motion';
import {
  toggleSelection,
  type GroceryPickRequest,
} from '@/tortie/data/selection';

export type TabKey = 'today' | 'cookbook' | 'plan' | 'groceries';
export const TAB_ORDER: TabKey[] = ['today', 'cookbook', 'plan', 'groceries'];

export type AuthStep = 'start' | 'pw' | 'signup' | 'oauth' | 'done';
export type AuthProvider = 'google' | 'facebook';

type Nav = {
  /** Flips true 60ms after first mount so the first stagger runs. */
  mounted: boolean;
  tab: TabKey;

  detailOpen: boolean;
  detailId: string | null;
  /** Increments every time the detail opens (scroll to top, reset to Ingredients). */
  detailNonce: number;

  prof: boolean;
  profNonce: number;
  /** Profile content hidden while switching signed-in ↔ guest. */
  pfOut: boolean;

  /** Add-a-recipe sheet. */
  addSheet: boolean;
  /** Import job the Add sheet should show on its next open (one-shot). */
  addJobId: string | null;
  /** Link shared in from another app. */
  shareOpen: boolean;
  shareUrl: string | null;
  shareTitle: string | null;
  shareNonce: number;
  /** Imports history screen. */
  imports: boolean;
  /** Camera scan. */
  cam: boolean;
  /** Set when the camera hands a photo back to the add sheet. */
  scanUri: string | null;

  menu: boolean;
  menuV: 'main' | 'coll' | 'plan';
  /** Add-to-collection sheet opened from cookbook multi-select. */
  menuBulk: boolean;
  /**
   * Multi-select ids. `null` is the mode off.
   * Cookbook stores recipe ids; the plan stores meal-plan entry ids.
   * Never an empty array — dropping the last id sets `null`.
   */
  sel: string[] | null;

  /** New collection sheet; `ncRecipeIds` are added on create. */
  nc: boolean;
  ncRecipeIds: string[];

  /** Cookbook filter / sort sheet. */
  fs: boolean;
  /** Plan month picker. */
  cal: boolean;

  /** Edit pantry item sheet. */
  pedOn: boolean;
  pedId: string | null;

  /** Shopping list edit mode. Tapping a row opens the item sheet. */
  grocEdit: boolean;
  /** Edit shopping-list item sheet. */
  gedOn: boolean;
  gedId: string | null;

  /** Add-to-groceries ingredient picker. Content stays while the sheet closes. */
  grocPickOn: boolean;
  grocPick: GroceryPickRequest | null;
  grocPickNonce: number;

  /** Recipe notes sheet. `notesStep` preselects a method step in the composer. */
  notesOn: boolean;
  notesId: string | null;
  notesStep: number | null;
  /** Opened over cook mode, so it must layer above it. */
  notesOverCook: boolean;
  notesNonce: number;

  /**
   * Step clip viewer ("Watch step"). Opens above cook mode too. `clipStep` is the step to start
   * on. `clipId` can be set before the viewer opens (`primeClip`) so the video is already loaded.
   */
  clipOn: boolean;
  clipId: string | null;
  clipStep: number;
  clipNonce: number;
  /** The step the viewer was on when it closed; cook mode follows it. */
  clipBack: { id: string; step: number; nonce: number } | null;

  edit: boolean;
  editMode: 'edit' | 'new';
  editId: string | null;
  editNonce: number;

  cookOpen: boolean;
  cookId: string | null;
  cookNonce: number;

  /** First-run tour. */
  welcome: boolean;
  welcomeNonce: number;

  au: boolean;
  auStep: AuthStep;
  auMode: 'signup' | 'login';
  auProv: AuthProvider;

  /** Cross-screen hand-offs. */
  cookbookColl: string | null;
  grocSec: 'groc' | 'pantry';

  toast: string;
  toastOn: boolean;
  /** Red error icon, shown longer. */
  toastErr: boolean;
  toastNonce: number;
};

type Actions = {
  set: (p: Partial<Nav>) => void;
  goTab: (t: TabKey) => void;
  openRecipe: (id: string) => void;
  closeRecipe: () => void;
  openProfile: () => void;
  closeProfile: () => void;
  openAdd: () => void;
  /** Opens the Add sheet on a running import's progress. */
  openAddJob: (jobId: string) => void;
  closeAdd: () => void;
  openShare: (url: string, title?: string | null) => void;
  closeShare: () => void;
  openImports: () => void;
  closeImports: () => void;
  openCam: () => void;
  closeCam: (reopenSheet: boolean) => void;
  openMenu: () => void;
  closeMenu: () => void;
  clearSel: () => void;
  toggleSel: (id: string) => void;
  /** Replace the selection with the visible ids. No-op when `ids` is empty. */
  selectIds: (ids: string[]) => void;
  openBulkCollections: () => void;
  openNewCollection: (forRecipe?: string | string[] | null) => void;
  openNotes: (
    id: string,
    opts?: { step?: number | null; overCook?: boolean },
  ) => void;
  closeNotes: () => void;
  openClip: (id: string, step: number) => void;
  /** Load a recipe's video ahead of time without opening the viewer. */
  primeClip: (id: string) => void;
  closeClip: () => void;
  /** The viewer closed on `step`; cook mode follows it. */
  clipReturned: (step: number) => void;
  openEditor: (id: string) => void;
  openNewRecipe: () => void;
  closeEditor: () => void;
  openCook: (id: string) => void;
  closeCook: () => void;
  openGroceryPick: (pick: GroceryPickRequest) => void;
  closeGroceryPick: () => void;
  openAuth: (mode: 'signup' | 'login', prov?: AuthProvider) => void;
  closeAuth: () => void;
  openWelcome: () => void;
  closeWelcome: () => void;
  toastShow: (msg: string, kind?: ToastKind) => void;
};

export type ToastKind = 'ok' | 'error';

let toastTimer: ReturnType<typeof setTimeout> | null = null;
let bulkExit: ReturnType<typeof setTimeout> | null = null;

function cancelBulkExit() {
  if (bulkExit) clearTimeout(bulkExit);
  bulkExit = null;
}

export const useNav = create<Nav & Actions>()((set, get) => ({
  mounted: false,
  tab: 'today',
  detailOpen: false,
  detailId: null,
  detailNonce: 0,
  prof: false,
  profNonce: 0,
  pfOut: false,
  addSheet: false,
  addJobId: null,
  shareOpen: false,
  shareUrl: null,
  shareTitle: null,
  shareNonce: 0,
  imports: false,
  cam: false,
  scanUri: null,
  menu: false,
  menuV: 'main',
  menuBulk: false,
  sel: null,
  nc: false,
  ncRecipeIds: [],
  fs: false,
  cal: false,
  pedOn: false,
  pedId: null,
  grocEdit: false,
  gedOn: false,
  gedId: null,
  grocPickOn: false,
  grocPick: null,
  grocPickNonce: 0,
  notesOn: false,
  notesId: null,
  notesStep: null,
  notesOverCook: false,
  notesNonce: 0,
  clipOn: false,
  clipId: null,
  clipStep: 0,
  clipNonce: 0,
  clipBack: null,
  edit: false,
  editMode: 'edit',
  editId: null,
  editNonce: 0,
  cookOpen: false,
  cookId: null,
  cookNonce: 0,
  welcome: false,
  welcomeNonce: 0,
  au: false,
  auStep: 'start',
  auMode: 'signup',
  auProv: 'google',
  cookbookColl: null,
  grocSec: 'groc',
  toast: '',
  toastOn: false,
  toastErr: false,
  toastNonce: 0,

  set: (p) => set(p),
  goTab: (t) => {
    if (get().tab === t) return;
    cancelBulkExit();
    const bulk = get().menuBulk;
    set({
      tab: t,
      sel: null,
      grocEdit: false,
      gedOn: false,
      ...(bulk ? { menu: false, menuBulk: false } : {}),
    });
  },
  openRecipe: (id) =>
    set((s) => ({
      detailId: id,
      detailOpen: true,
      detailNonce: s.detailNonce + 1,
    })),
  closeRecipe: () => set({ detailOpen: false, menu: false, menuBulk: false }),
  openProfile: () => set((s) => ({ prof: true, profNonce: s.profNonce + 1 })),
  closeProfile: () => set({ prof: false }),
  openAdd: () => set({ addSheet: true, addJobId: null }),
  openAddJob: (jobId) => set({ addSheet: true, addJobId: jobId }),
  closeAdd: () => set({ addSheet: false }),
  openShare: (url, title = null) =>
    set((s) => ({
      shareOpen: true,
      shareUrl: url,
      shareTitle: title,
      shareNonce: s.shareNonce + 1,
    })),
  closeShare: () => set({ shareOpen: false }),
  openImports: () => set({ addSheet: false, imports: true }),
  closeImports: () => set({ imports: false }),
  openCam: () => set({ addSheet: false, cam: true }),
  closeCam: (reopen) => set({ cam: false, addSheet: reopen }),
  openMenu: () => set({ menu: true, menuV: 'main', menuBulk: false }),
  closeMenu: () => {
    const bulk = get().menuBulk;
    set({ menu: false });
    if (!bulk) return;
    cancelBulkExit();
    // ~60% of base duration, so checks don't empty while the sheet is still on screen.
    const wait = Math.round(BASE_D * motionMultiplier() * 0.6);
    bulkExit = setTimeout(() => {
      bulkExit = null;
      set({ sel: null, menuBulk: false });
    }, wait);
  },
  clearSel: () => {
    cancelBulkExit();
    const bulk = get().menuBulk;
    set(bulk ? { sel: null, menu: false, menuBulk: false } : { sel: null });
  },
  toggleSel: (id) =>
    set((s) => ({ sel: s.sel ? toggleSelection(s.sel, id) : s.sel })),
  selectIds: (ids) => {
    if (!ids.length) return;
    set({ sel: [...ids] });
  },
  openBulkCollections: () => {
    cancelBulkExit();
    set({ menu: true, menuV: 'coll', menuBulk: true });
  },
  openNewCollection: (forRecipe = null) =>
    set({
      nc: true,
      ncRecipeIds:
        forRecipe == null
          ? []
          : Array.isArray(forRecipe)
            ? [...forRecipe]
            : [forRecipe],
    }),
  openNotes: (id, opts) =>
    set((s) => ({
      notesOn: true,
      notesId: id,
      notesStep: opts?.step ?? null,
      notesOverCook: opts?.overCook ?? false,
      notesNonce: s.notesNonce + 1,
    })),
  closeNotes: () => set({ notesOn: false }),
  openClip: (id, step) =>
    set((s) => ({
      clipOn: true,
      clipId: id,
      clipStep: step,
      clipNonce: s.clipNonce + 1,
    })),
  primeClip: (id) =>
    set((s) => (s.clipOn || s.clipId === id ? s : { clipId: id })),
  closeClip: () => set({ clipOn: false }),
  clipReturned: (step) =>
    set((s) =>
      s.clipId
        ? {
            clipBack: {
              id: s.clipId,
              step,
              nonce: (s.clipBack?.nonce ?? 0) + 1,
            },
          }
        : s,
    ),
  openEditor: (id) =>
    set((s) => ({
      edit: true,
      editMode: 'edit',
      editId: id,
      editNonce: s.editNonce + 1,
    })),
  openNewRecipe: () =>
    set((s) => ({
      addSheet: false,
      edit: true,
      editMode: 'new',
      editId: null,
      editNonce: s.editNonce + 1,
    })),
  closeEditor: () => set({ edit: false }),
  openCook: (id) =>
    set((s) => ({ cookOpen: true, cookId: id, cookNonce: s.cookNonce + 1 })),
  closeCook: () => set({ cookOpen: false }),
  openGroceryPick: (pick) =>
    set((s) => ({
      grocPickOn: true,
      grocPick: pick,
      grocPickNonce: s.grocPickNonce + 1,
    })),
  closeGroceryPick: () => set({ grocPickOn: false }),
  openAuth: (mode, prov) =>
    set({
      au: true,
      auMode: mode,
      auStep: prov ? 'oauth' : 'start',
      auProv: prov ?? get().auProv,
    }),
  closeAuth: () => set({ au: false }),
  openWelcome: () =>
    set((s) => ({ welcome: true, welcomeNonce: s.welcomeNonce + 1 })),
  closeWelcome: () => set({ welcome: false }),
  toastShow: (msg, kind = 'ok') => {
    if (toastTimer) clearTimeout(toastTimer);
    const err = kind === 'error';
    set((s) => ({
      toast: msg,
      toastOn: true,
      toastErr: err,
      toastNonce: s.toastNonce + 1,
    }));
    toastTimer = setTimeout(() => set({ toastOn: false }), err ? 3800 : 2400);
  },
}));

export const toast = (msg: string, kind?: ToastKind) =>
  useNav.getState().toastShow(msg, kind);

/** `setTimeout` scaled by the motion multiplier (sheet → sheet hand-offs). */
export function afterMotion(ms: number, fn: () => void) {
  return setTimeout(fn, Math.round(ms * motionMultiplier()));
}
