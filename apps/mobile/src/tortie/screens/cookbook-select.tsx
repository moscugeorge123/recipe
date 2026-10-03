import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Platform,
  Share,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  type NativeSyntheticEvent,
  type NativeTouchEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import * as Clipboard from 'expo-clipboard';

import { hapticSelection } from '@/lib/haptics';
import { announce } from '@/lib/announce';
import { useCookbookView } from '@/tortie/data/cookbook';
import { presentGroceryPick } from '@/tortie/data/grocery-pick';
import { useTRecipes } from '@/tortie/data/recipes';
import {
  allVisibleSelected,
  shareSelectionToast,
} from '@/tortie/data/selection';
import { useFrame } from '@/tortie/frame';
import { useMotion } from '@/tortie/motion';
import { toast, useNav } from '@/tortie/nav-store';
import { C, CSS_EASE, EASE, SPRING } from '@/tortie/theme';
import { tw } from '@/tortie/ui/anim';
import { Glyph } from '@/tortie/ui/icon';
import { Press } from '@/tortie/ui/press';
import { em, sans, serif, T } from '@/tortie/ui/text';

const LONG_PRESS_MS = 460;

let lpTimer: ReturnType<typeof setTimeout> | null = null;
let lpConsumed = false;

/** Start the 460ms long-press. A second press, or a press while selecting, does not arm it. */
export function lpStart(id: string) {
  if (lpTimer) clearTimeout(lpTimer);
  lpTimer = null;
  lpConsumed = false;
  const s = useNav.getState();
  if (s.sel && (s.tab === 'cookbook' || s.tab === 'plan')) return;
  lpTimer = setTimeout(() => {
    lpTimer = null;
    lpConsumed = true;
    useNav.getState().set({ sel: [id] });
    hapticSelection().catch(() => undefined);
  }, LONG_PRESS_MS);
}

export function lpEnd() {
  if (lpTimer) clearTimeout(lpTimer);
  lpTimer = null;
  // The click that follows pointerup is swallowed. If that click never comes
  // (the finger left the card), drop the flag on the next turn.
  if (!lpConsumed) return;
  setTimeout(() => {
    lpConsumed = false;
  }, 0);
}

/** True when the following click belongs to a long-press that already entered selection. */
export function consumeLongPress(): boolean {
  if (!lpConsumed) return false;
  lpConsumed = false;
  return true;
}

export function onRecipeCardPress(id: string, open: (id: string) => void) {
  if (consumeLongPress()) return;
  const s = useNav.getState();
  if (s.sel && (s.tab === 'cookbook' || s.tab === 'plan')) {
    s.toggleSel(id);
    return;
  }
  open(id);
}

export function onRecipeSelectAction(id: string) {
  const s = useNav.getState();
  if (s.sel && (s.tab === 'cookbook' || s.tab === 'plan')) s.toggleSel(id);
  else s.set({ sel: [id] });
}

/** Suppress the browser callout / selection on recipe cards. */
export const cardWebStyle: ViewStyle | undefined =
  Platform.OS === 'web'
    ? ({
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
      } as ViewStyle)
    : undefined;

export function useRecipeLongPress(id: string) {
  const size = useRef({ w: 0, h: 0 });
  const origin = useRef({ x: 0, y: 0 });
  const mine = useRef(false);
  useEffect(
    () => () => {
      if (mine.current) lpEnd();
    },
    [],
  );
  return {
    onLayout: (e: LayoutChangeEvent) => {
      size.current = {
        w: e.nativeEvent.layout.width,
        h: e.nativeEvent.layout.height,
      };
    },
    onPressIn: (e: GestureResponderEvent) => {
      const { pageX, pageY, locationX, locationY } = e.nativeEvent;
      origin.current = { x: pageX - locationX, y: pageY - locationY };
      mine.current = true;
      lpStart(id);
    },
    onPressOut: () => {
      mine.current = false;
      lpEnd();
    },
    onTouchMove: (e: NativeSyntheticEvent<NativeTouchEvent>) => {
      const { pageX, pageY } = e.nativeEvent;
      const o = origin.current;
      const s = size.current;
      if (!s.w) return;
      if (
        pageX < o.x ||
        pageY < o.y ||
        pageX > o.x + s.w ||
        pageY > o.y + s.h
      ) {
        lpEnd();
      }
    },
    onTouchCancel: () => {
      mine.current = false;
      lpEnd();
    },
    onContextMenu:
      Platform.OS === 'web'
        ? (e: { preventDefault: () => void }) => {
            e.preventDefault();
          }
        : undefined,
  };
}

/** Photo tile: selected scale .94, press replaces it with .94→.97, ring fades in 200ms. */
export function SelectTile({
  selected,
  pressed,
  style,
  children,
}: {
  selected: boolean;
  pressed: boolean;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const scale = useSharedValue(1);
  const ring = useSharedValue(selected ? 1 : 0);
  useEffect(() => {
    scale.value = withTiming(pressed ? 0.97 : selected ? 0.94 : 1, {
      duration: 240,
      easing: EASE,
    });
  }, [pressed, selected, scale]);
  useEffect(() => {
    ring.value = withTiming(selected ? 1 : 0, {
      duration: 200,
      easing: CSS_EASE,
    });
  }, [selected, ring]);
  const box = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  const ringStyle = useAnimatedStyle(() => ({ opacity: ring.value }));
  return (
    <Animated.View style={[{ borderRadius: 16 }, style, box]}>
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius: 16,
            boxShadow: '0 0 0 3px #f8faf5, 0 0 0 5.5px #32533c',
          },
          ringStyle,
        ]}
      />
      {children}
    </Animated.View>
  );
}

/** 28×28 selection check. Grid sits on the photo; list sits in a 44×44 slot. */
export function SelMark({ on, grid }: { on: boolean; grid: boolean }) {
  const { reduced } = useMotion();
  const scale = useSharedValue(0);
  useEffect(() => {
    scale.value = withTiming(on ? 1 : 0, {
      duration: 320,
      easing: reduced ? EASE : SPRING,
    });
  }, [on, reduced, scale]);
  const box = useAnimatedStyle(() => ({
    backgroundColor: tw(
      on ? C.green : grid ? 'rgba(25,28,25,.2)' : 'transparent',
      200,
      CSS_EASE,
    ),
    borderColor: tw(on ? C.green : grid ? C.bg : C.lineStrong, 200, CSS_EASE),
  }));
  const mark = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  return (
    <Animated.View
      style={[
        {
          width: 28,
          height: 28,
          borderRadius: 14,
          borderWidth: 2,
          alignItems: 'center',
          justifyContent: 'center',
          ...(grid ? { boxShadow: '0 1px 4px rgba(0,0,0,.18)' } : null),
        },
        box,
      ]}
    >
      <Animated.View style={mark}>
        <Glyph name="check" size={18} color={C.bg} />
      </Animated.View>
    </Animated.View>
  );
}

const ACTS = [
  ['library_add', 'Add to collection'],
  ['add_shopping_cart', 'Add to groceries'],
  ['ios_share', 'Share'],
] as const;

/**
 * Selection chrome over the cookbook. Always mounted; slides off screen
 * (or fades, under reduced motion) when the mode is off.
 */
export function CookbookSelectionBars() {
  const f = useFrame();
  const { m, reduced } = useMotion();
  const ms = Math.round(520 * m);
  const sel = useNav((s) => s.sel);
  const tab = useNav((s) => s.tab);
  const active = sel != null && tab === 'cookbook';
  const v = useCookbookView();
  const recipes = useTRecipes();
  const client = useQueryClient();
  const busy = useRef(false);
  const [topH, setTopH] = useState(160);
  const visible = v.book.map((b) => b.r.id);
  const n = sel?.length ?? 0;
  const all = !!sel && allVisibleSelected(sel, visible);
  const prevN = useRef<number | null>(null);

  useEffect(() => {
    const count = sel?.length ?? null;
    if (count != null && count !== prevN.current) announce(`${count} selected`);
    prevN.current = count;
  }, [sel]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const s = useNav.getState();
      const selecting = s.sel != null && s.tab === 'cookbook';
      if (!selecting && !s.menuBulk) return;
      if (s.fs) {
        e.preventDefault();
        s.set({ fs: false });
        return;
      }
      if (s.nc) {
        e.preventDefault();
        s.set({ nc: false });
        return;
      }
      if (s.menu) {
        e.preventDefault();
        s.closeMenu();
        return;
      }
      if (selecting) {
        e.preventDefault();
        s.clearSel();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const top = useAnimatedStyle(() => ({
    opacity: reduced ? tw(active ? 1 : 0, ms) : 1,
    transform: [{ translateY: reduced ? 0 : tw(active ? 0 : -topH, ms) }],
  }));
  const bot = useAnimatedStyle(() => ({
    opacity: reduced ? tw(active ? 1 : 0, ms) : 1,
    transform: [{ translateY: reduced ? 0 : tw(active ? 0 : f.tabBarH, ms) }],
  }));

  const onGroceries = async () => {
    const ids = useNav.getState().sel;
    if (!ids?.length || busy.current) return;
    busy.current = true;
    try {
      const opened = await presentGroceryPick(client, ids);
      if (opened) useNav.getState().clearSel();
    } finally {
      busy.current = false;
    }
  };

  const onShare = () => {
    const ids = useNav.getState().sel;
    if (!ids?.length) return;
    const byId = new Map(recipes.list.map((r) => [r.id, r]));
    const message = ids
      .map((id) => {
        const r = byId.get(id);
        return r?.originalUrl || r?.title || '';
      })
      .filter(Boolean)
      .join('\n');
    toast(shareSelectionToast(ids.length));
    useNav.getState().clearSel();
    if (!message) return;
    Share.share({ message }).catch(() => {
      Clipboard.setStringAsync(message).catch(() => undefined);
    });
  };

  const onAct = (label: (typeof ACTS)[number][1]) => {
    if (label === 'Add to collection') useNav.getState().openBulkCollections();
    else if (label === 'Add to groceries') void onGroceries();
    else onShare();
  };

  const hidden = !active;
  return (
    <>
      <Animated.View
        pointerEvents={hidden ? 'none' : 'auto'}
        accessibilityElementsHidden={hidden}
        importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'}
        onLayout={(e) => setTopH(e.nativeEvent.layout.height)}
        style={[
          {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 21,
            paddingTop: f.status,
            paddingHorizontal: 12,
            paddingBottom: 10,
            backgroundColor: C.bg,
            boxShadow: '0 1px 0 #e1e3de, 0 10px 24px -14px rgba(44,52,45,.3)',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
          },
          top,
        ]}
      >
        <Press
          onPress={() => useNav.getState().clearSel()}
          accessibilityLabel="Cancel selection"
          scale={0.9}
          ms={200}
          easing={CSS_EASE}
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Glyph name="close" size={24} color={C.ink} />
        </Press>
        <T
          numberOfLines={1}
          style={[
            serif(22, 500, C.ink, { letterSpacing: em(22, -0.01) }),
            { flex: 1, minWidth: 0 },
          ]}
        >
          {n} selected
        </T>
        <Press
          onPress={() => {
            if (all) useNav.getState().clearSel();
            else if (visible.length) useNav.getState().selectIds(visible);
          }}
          style={{
            height: 44,
            paddingHorizontal: 12,
            borderRadius: 99,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <T style={sans(14, 700, C.green)}>
            {all ? 'Deselect all' : 'Select all'}
          </T>
        </Press>
      </Animated.View>
      <Animated.View
        pointerEvents={hidden ? 'none' : 'auto'}
        accessibilityElementsHidden={hidden}
        importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'}
        style={[
          {
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 22,
            height: f.tabBarH,
            paddingHorizontal: 10,
            paddingBottom: f.tabBarPad,
            backgroundColor: C.bg,
            borderTopWidth: 1,
            borderTopColor: C.line,
          },
          bot,
        ]}
      >
        <View style={{ flex: 1, flexDirection: 'row' }}>
          {ACTS.map(([icon, label]) => (
            <Press
              key={label}
              onPress={() => onAct(label)}
              scale={0.92}
              ms={200}
              easing={CSS_EASE}
              accessibilityLabel={label}
              style={{
                flex: 1,
                minWidth: 0,
                alignItems: 'center',
                paddingTop: 12,
                gap: 4,
              }}
            >
              <Glyph name={icon} size={24} color={C.green} />
              <T style={[sans(11, 600, C.ink), { textAlign: 'center' }]}>
                {label}
              </T>
            </Press>
          ))}
        </View>
      </Animated.View>
    </>
  );
}
