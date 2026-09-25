import { create } from 'zustand';

import { motionMultiplier } from '@/tortie/motion';

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
  /** Camera scan. */
  cam: boolean;
  /** Set when the camera hands a photo back to the add sheet. */
  scanUri: string | null;

  menu: boolean;
  menuV: 'main' | 'coll';

  /** New collection sheet; `ncForRecipe` adds that recipe on create. */
  nc: boolean;
  ncForRecipe: string | null;

  /** Cookbook filter / sort sheet. */
  fs: boolean;
  /** Plan month picker. */
  cal: boolean;

  /** Edit pantry item sheet. */
  pedOn: boolean;
  pedId: string | null;

  edit: boolean;
  editMode: 'edit' | 'new';
  editId: string | null;
  editNonce: number;

  cookOpen: boolean;
  cookId: string | null;
  cookNonce: number;

  au: boolean;
  auStep: AuthStep;
  auMode: 'signup' | 'login';
  auProv: AuthProvider;

  /** Cross-screen hand-offs. */
  cookbookColl: string | null;
  grocSec: 'groc' | 'pantry';

  toast: string;
  toastOn: boolean;
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
  closeAdd: () => void;
  openCam: () => void;
  closeCam: (reopenSheet: boolean) => void;
  openMenu: () => void;
  closeMenu: () => void;
  openNewCollection: (forRecipe?: string | null) => void;
  openEditor: (id: string) => void;
  openNewRecipe: () => void;
  closeEditor: () => void;
  openCook: (id: string) => void;
  closeCook: () => void;
  openAuth: (mode: 'signup' | 'login', prov?: AuthProvider) => void;
  closeAuth: () => void;
  toastShow: (msg: string) => void;
};

let toastTimer: ReturnType<typeof setTimeout> | null = null;

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
  cam: false,
  scanUri: null,
  menu: false,
  menuV: 'main',
  nc: false,
  ncForRecipe: null,
  fs: false,
  cal: false,
  pedOn: false,
  pedId: null,
  edit: false,
  editMode: 'edit',
  editId: null,
  editNonce: 0,
  cookOpen: false,
  cookId: null,
  cookNonce: 0,
  au: false,
  auStep: 'start',
  auMode: 'signup',
  auProv: 'google',
  cookbookColl: null,
  grocSec: 'groc',
  toast: '',
  toastOn: false,
  toastNonce: 0,

  set: (p) => set(p),
  goTab: (t) => {
    if (get().tab === t) return;
    set({ tab: t });
  },
  openRecipe: (id) =>
    set((s) => ({
      detailId: id,
      detailOpen: true,
      detailNonce: s.detailNonce + 1,
    })),
  closeRecipe: () => set({ detailOpen: false, menu: false }),
  openProfile: () => set((s) => ({ prof: true, profNonce: s.profNonce + 1 })),
  closeProfile: () => set({ prof: false }),
  openAdd: () => set({ addSheet: true }),
  closeAdd: () => set({ addSheet: false }),
  openCam: () => set({ addSheet: false, cam: true }),
  closeCam: (reopen) => set({ cam: false, addSheet: reopen }),
  openMenu: () => set({ menu: true, menuV: 'main' }),
  closeMenu: () => set({ menu: false }),
  openNewCollection: (forRecipe = null) =>
    set({ nc: true, ncForRecipe: forRecipe }),
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
  openAuth: (mode, prov) =>
    set({
      au: true,
      auMode: mode,
      auStep: prov ? 'oauth' : 'start',
      auProv: prov ?? get().auProv,
    }),
  closeAuth: () => set({ au: false }),
  toastShow: (msg) => {
    if (toastTimer) clearTimeout(toastTimer);
    set((s) => ({ toast: msg, toastOn: true, toastNonce: s.toastNonce + 1 }));
    toastTimer = setTimeout(() => set({ toastOn: false }), 2400);
  },
}));

export const toast = (msg: string) => useNav.getState().toastShow(msg);

/** `setTimeout` scaled by the motion multiplier (sheet → sheet hand-offs). */
export function afterMotion(ms: number, fn: () => void) {
  return setTimeout(fn, Math.round(ms * motionMultiplier()));
}
