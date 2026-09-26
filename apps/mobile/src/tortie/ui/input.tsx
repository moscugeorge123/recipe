import {
  createContext,
  useContext,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type Ref,
  type RefObject,
} from 'react';
import {
  Dimensions,
  ScrollView,
  TextInput,
  View,
  type ScrollViewProps,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { revealFocusedField } from '@/lib/keyboard';
import { onKeyboardHide, useKeyboard } from '@/tortie/ui/keyboard';

type Measurable = Pick<View, 'measureInWindow'>;
type Target = () => Measurable | null;
type Host = {
  focus: (key: object, t: Target) => void;
  blur: (key: object) => void;
  run: () => void;
};

const HostCtx = createContext<Host | null>(null);
const BoxCtx = createContext<RefObject<View | null> | null>(null);
const SheetBlurCtx = createContext<Set<() => void> | null>(null);

/**
 * Blurs any focused `Input` under `children` when `open` goes from true to
 * false, so closing a sheet dismisses the keyboard.
 */
export function BlurWhenClosed({
  open,
  children,
}: {
  open: boolean;
  children: ReactNode;
}) {
  const [blurs] = useState(() => new Set<() => void>());
  const wasOpen = useRef(open);
  useEffect(() => {
    if (wasOpen.current && !open) blurs.forEach((blur) => blur());
    wasOpen.current = open;
  }, [open, blurs]);
  return (
    <SheetBlurCtx.Provider value={blurs}>{children}</SheetBlurCtx.Provider>
  );
}

type KeyboardScrollProps = ScrollViewProps & {
  ref?: Ref<ScrollView>;
  /** The scroller itself is docked above the keyboard (a `Sheet` with `avoidKeyboard`). */
  lifted?: boolean;
  /** Height of a bar docked on the keyboard that covers the scroller's bottom edge. */
  bottomObscured?: number;
};

/**
 * ScrollView for any screen that holds an `Input`. While a field is focused it
 * scrolls just enough to show the field's whole box above the keyboard (and any
 * `bottomObscured` bar), and pads the content by the keyboard height so
 * everything below can still be scrolled into view.
 */
export function KeyboardScroll({
  ref,
  lifted = false,
  bottomObscured = 0,
  children,
  onScroll,
  onLayout,
  scrollEventThrottle = 16,
  keyboardShouldPersistTaps = 'handled',
  ...rest
}: KeyboardScrollProps) {
  const { h } = useKeyboard();
  const self = useRef<ScrollView | null>(null);
  const y = useRef(0);
  const live = useRef({ h, lifted, bottomObscured });
  const active = useRef<{ key: object; t: Target } | null>(null);
  const frame = useRef(0);
  useImperativeHandle(ref, () => self.current as ScrollView, []);

  const host = useMemo<Host>(() => {
    const reveal = () => {
      const sv = self.current;
      const node = (sv?.getNativeScrollRef?.() ?? sv) as Measurable | null;
      const target = active.current?.t();
      if (!sv || !node || !target) return;
      node.measureInWindow((_sx, sy, _sw, sh) => {
        target.measureInWindow((_fx, fy, _fw, fh) => {
          const cur = live.current;
          const kbTop =
            cur.lifted || cur.h <= 0
              ? Infinity
              : Dimensions.get('window').height - cur.h;
          const next = revealFocusedField({
            fieldTop: fy,
            fieldBottom: fy + fh,
            visibleTop: sy,
            visibleBottom: Math.min(sy + sh, kbTop) - cur.bottomObscured,
            scrollY: y.current,
          }).scrollY;
          if (Math.abs(next - y.current) > 1) {
            sv.scrollTo({ y: next, animated: true });
          }
        });
      });
    };
    const run = () => {
      if (!active.current) return;
      cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(reveal);
    };
    return {
      focus: (key, t) => {
        active.current = { key, t };
        run();
      },
      blur: (key) => {
        if (active.current?.key === key) active.current = null;
      },
      run,
    };
  }, []);

  useEffect(() => {
    live.current = { h, lifted, bottomObscured };
    host.run();
  }, [h, lifted, bottomObscured, host]);

  return (
    <HostCtx.Provider value={host}>
      <ScrollView
        {...rest}
        ref={self}
        scrollEventThrottle={scrollEventThrottle}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        onScroll={(e) => {
          y.current = e.nativeEvent.contentOffset.y;
          onScroll?.(e);
        }}
        onLayout={(e) => {
          host.run();
          onLayout?.(e);
        }}
      >
        {children}
        {!lifted && h > 0 ? <View style={{ height: h }} /> : null}
      </ScrollView>
    </HostCtx.Provider>
  );
}

/**
 * Marks the box a focused `Input` must keep fully visible — the whole pill or
 * row, not just the text line. Use when the decoration is a plain `View`.
 */
export function RevealBox({
  style,
  children,
}: {
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const ref = useRef<View>(null);
  return (
    <BoxCtx.Provider value={ref}>
      <View ref={ref} collapsable={false} style={style}>
        {children}
      </View>
    </BoxCtx.Provider>
  );
}

type InputProps = TextInputProps & {
  ref?: Ref<TextInput>;
  /** Box to reveal instead of the nearest `RevealBox` (e.g. an `Animated.View` row). */
  revealRef?: RefObject<View | null>;
};

/**
 * The app's only text field: a `TextInput` that reports focus to its
 * `KeyboardScroll` and blurs itself when the keyboard closes.
 */
export function Input({
  ref,
  revealRef,
  onFocus,
  onBlur,
  onContentSizeChange,
  ...rest
}: InputProps) {
  const host = useContext(HostCtx);
  const box = useContext(BoxCtx);
  const sheetBlurs = useContext(SheetBlurCtx);
  const self = useRef<TextInput | null>(null);
  useImperativeHandle(ref, () => self.current as TextInput, []);
  useEffect(
    () =>
      onKeyboardHide(() => {
        if (self.current?.isFocused()) self.current.blur();
      }),
    [],
  );
  useEffect(() => {
    if (!sheetBlurs) return;
    const blur = () => {
      if (self.current?.isFocused()) self.current.blur();
    };
    sheetBlurs.add(blur);
    return () => {
      sheetBlurs.delete(blur);
    };
  }, [sheetBlurs]);
  return (
    <TextInput
      {...rest}
      ref={self}
      onFocus={(e) => {
        host?.focus(
          self,
          () => revealRef?.current ?? box?.current ?? self.current,
        );
        onFocus?.(e);
      }}
      onBlur={(e) => {
        host?.blur(self);
        onBlur?.(e);
      }}
      onContentSizeChange={(e) => {
        if (self.current?.isFocused()) host?.run();
        onContentSizeChange?.(e);
      }}
    />
  );
}
