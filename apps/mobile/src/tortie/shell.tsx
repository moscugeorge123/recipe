import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useRef, type ReactNode } from 'react';
import {
  BackHandler,
  Platform,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { useAuthLifecycle } from '@/auth/hooks/useAuth';
import { startCookTicker } from '@/tortie/cook-store';
import { useMotion } from '@/tortie/motion';
import { TAB_ORDER, useNav, type TabKey } from '@/tortie/nav-store';
import { AddRecipeSheet } from '@/tortie/screens/add-recipe';
import { CookMode } from '@/tortie/screens/cook';
import { CookbookScreen } from '@/tortie/screens/cookbook';
import { CookbookSelectionBars } from '@/tortie/screens/cookbook-select';
import { PlanSelectionBars } from '@/tortie/screens/plan-select';
import {
  CookbookFilterSheet,
  NewCollectionSheet,
} from '@/tortie/screens/cookbook-sheets';
import { RecipeEditor } from '@/tortie/screens/editor';
import { GroceryPickSheet } from '@/tortie/screens/grocery-pick';
import {
  EditGrocerySheet,
  EditPantrySheet,
  GroceriesScreen,
} from '@/tortie/screens/groceries';
import { MonthPickerSheet, PlanScreen } from '@/tortie/screens/plan';
import { ProfileScreen } from '@/tortie/screens/profile';
import { RecipeDetail, RecipeMenuSheet } from '@/tortie/screens/recipe-detail';
import { ScanCamera } from '@/tortie/screens/scan-camera';
import { SignInFlow } from '@/tortie/screens/sign-in';
import { TodayScreen } from '@/tortie/screens/today';
import { TabBar } from '@/tortie/tab-bar';
import { requestEditorClose } from '@/tortie/data/editor-draft';
import { usePlan } from '@/tortie/data/plan';
import { useGroceriesLeft } from '@/tortie/data/groceries';
import { C, EASE, SH } from '@/tortie/theme';
import { tw, useOpenProgress } from '@/tortie/ui/anim';
import { reportAppFrame } from '@/tortie/ui/keyboard';
import { ToastView } from '@/tortie/ui/toast';

SystemUI.setBackgroundColorAsync(C.bg).catch(() => undefined);

/**
 * One viewport, layered like the prototype (NAVIGATION.md §1):
 * tabs 1–2 · tab bar 20 · dim 30 · recipe 35 · profile 36 · sheets 40–43 ·
 * editor 45 · cook 50 · sign in 56 · camera 60 · toast 70.
 */
export function TortieShell() {
  useAuthLifecycle();
  const rootRef = useRef<View>(null);
  const { D } = useMotion();
  const { width } = useWindowDimensions();
  const set = useNav((s) => s.set);
  const pushed = useNav((s) => s.detailOpen || s.prof);
  const detailOpen = useNav((s) => s.detailOpen);
  const prof = useNav((s) => s.prof);
  const cam = useNav((s) => s.cam);
  const openAdd = useNav((s) => s.openAdd);
  const left = useGroceriesLeft();

  useEffect(() => {
    const bg = cam ? C.camera : C.bg;
    SystemUI.setBackgroundColorAsync(bg).catch(() => undefined);
  }, [cam]);

  useEffect(() => {
    const t = setTimeout(() => set({ mounted: true }), 60);
    const stop = startCookTicker();
    return () => {
      clearTimeout(t);
      stop();
    };
  }, [set]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () =>
      popTopLayer(),
    );
    return () => sub.remove();
  }, []);

  const pushMs = Math.round(D * 1.1);
  const pushP = useOpenProgress(pushed, pushMs);
  const detP = useOpenProgress(detailOpen, pushMs);
  const pfP = useOpenProgress(prof, pushMs);
  const layer = useAnimatedStyle(() => ({
    transform: [{ translateX: -0.26 * width * pushP.value }],
  }));
  const dim = useAnimatedStyle(() => ({ opacity: 0.14 * pushP.value }));
  // +40 keeps the left-edge shadow out of view while parked.
  const det = useAnimatedStyle(() => ({
    transform: [{ translateX: (1 - detP.value) * (width + 40) }],
  }));
  const pf = useAnimatedStyle(() => ({
    transform: [{ translateX: (1 - pfP.value) * (width + 40) }],
  }));

  return (
    <View
      ref={rootRef}
      onLayout={() => {
        rootRef.current?.measureInWindow((_x, y, _w, h) => {
          reportAppFrame(y + h);
        });
      }}
      style={{ flex: 1, backgroundColor: C.bg, overflow: 'hidden' }}
    >
      <Animated.View style={[StyleSheet.absoluteFill, layer]}>
        <TabLayer tab="today">
          <TodayScreen />
        </TabLayer>
        <TabLayer tab="cookbook">
          <CookbookScreen />
        </TabLayer>
        <TabLayer tab="plan">
          <PlanScreen />
        </TabLayer>
        <TabLayer tab="groceries">
          <GroceriesScreen />
        </TabLayer>
        <TabBar onPlus={openAdd} groceriesLeft={left} />
        <CookbookSelectionBars />
        <PlanSelectionBars />
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { zIndex: 30, backgroundColor: C.ink },
            dim,
          ]}
        />
      </Animated.View>

      <Animated.View
        pointerEvents={detailOpen ? 'auto' : 'none'}
        style={[
          StyleSheet.absoluteFill,
          { zIndex: 35, backgroundColor: C.bg, boxShadow: SH.pushed },
          det,
        ]}
      >
        <RecipeDetail />
      </Animated.View>
      <Animated.View
        pointerEvents={prof ? 'auto' : 'none'}
        style={[
          StyleSheet.absoluteFill,
          { zIndex: 36, backgroundColor: C.bg, boxShadow: SH.pushed },
          pf,
        ]}
      >
        <ProfileScreen />
      </Animated.View>

      <AddRecipeSheet />
      <RecipeMenuSheet />
      <GroceryPickSheet />
      <NewCollectionSheet />
      <EditGrocerySheet />
      <EditPantrySheet />
      <CookbookFilterSheet />
      <MonthPickerSheet />

      <RecipeEditor />
      <CookMode />
      <SignInFlow />
      <ScanCamera />

      <ToastView />
      <StatusBar style={cam ? 'light' : 'dark'} />
    </View>
  );
}

/** Tab switch: opacity D × .7, translateX ±24 over D, both EASE. Inactive tabs stay mounted. */
function TabLayer({ tab, children }: { tab: TabKey; children: ReactNode }) {
  const { D } = useMotion();
  const cur = useNav((s) => s.tab);
  const i = TAB_ORDER.indexOf(tab);
  const ai = TAB_ORDER.indexOf(cur);
  const on = i === ai;
  const a = useAnimatedStyle(() => ({
    opacity: tw(on ? 1 : 0, Math.round(D * 0.7)),
    transform: [{ translateX: tw(on ? 0 : i < ai ? -24 : 24, D, EASE) }],
  }));
  return (
    <Animated.View
      pointerEvents={on ? 'auto' : 'none'}
      style={[StyleSheet.absoluteFill, { zIndex: on ? 2 : 1 }, a]}
    >
      {children}
    </Animated.View>
  );
}

/** Android back: close the topmost layer. Returns true when something closed. */
function popTopLayer(): boolean {
  const s = useNav.getState();
  if (s.cam) return (s.closeCam(true), true);
  if (s.au) return (s.closeAuth(), true);
  if (s.cookOpen) return (s.closeCook(), true);
  if (s.edit) return (requestEditorClose(), true);
  if (s.grocPickOn) return (s.closeGroceryPick(), true);
  if (s.cal) return (s.set({ cal: false }), true);
  if (s.fs) return (s.set({ fs: false }), true);
  if (s.nc) return (s.set({ nc: false }), true);
  if (s.gedOn) return (s.set({ gedOn: false }), true);
  if (s.grocEdit) return (s.set({ grocEdit: false }), true);
  if (s.pedOn) return (s.set({ pedOn: false }), true);
  if (s.menu) return (s.closeMenu(), true);
  if (s.sel != null && (s.tab === 'cookbook' || s.tab === 'plan'))
    return (s.clearSel(), true);
  if (s.addSheet) return (s.closeAdd(), true);
  if (s.prof) return (s.closeProfile(), true);
  if (s.detailOpen) return (s.closeRecipe(), true);
  if (usePlan.getState().pick) {
    usePlan.getState().clearPick();
    s.goTab('plan');
    return true;
  }
  if (s.tab !== 'today') return (s.goTab('today'), true);
  return false;
}
