import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';
import {
  ScrollView,
  TextInput,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewProps,
} from 'react-native';

import {
  revealFocusedField,
  subscribeTextInputFocused,
  useKeyboardBottomInset,
} from '@/lib/keyboard';
import { useReducedMotion } from '@/lib/motion';

type HostMeasurable = {
  measureInWindow: (
    callback: (x: number, y: number, width: number, height: number) => void,
  ) => void;
  measureLayout?: (
    relativeTo: unknown,
    onSuccess: () => void,
    onFail: () => void,
  ) => void;
};

function asMeasurable(value: unknown): HostMeasurable | null {
  if (
    value &&
    typeof value === 'object' &&
    'measureInWindow' in value &&
    typeof value.measureInWindow === 'function'
  ) {
    return value as HostMeasurable;
  }
  return null;
}

function whenInsideScrollView(
  node: HostMeasurable,
  scroll: ScrollView,
  then: () => void,
): void {
  if (typeof node.measureLayout !== 'function') {
    then();
    return;
  }
  node.measureLayout(scroll, then, () => undefined);
}

/**
 * ScrollView that keeps the focused field fully visible inside the
 * KeyboardDock-shrunk layout. Does not invent extra keyboard padding —
 * the dock already places the keyboard under the app.
 */
export const KeyboardAwareScrollView = forwardRef<ScrollView, ScrollViewProps>(
  function KeyboardAwareScrollView(
    {
      children,
      onScroll,
      keyboardShouldPersistTaps = 'handled',
      keyboardDismissMode = 'interactive',
      automaticallyAdjustKeyboardInsets = false,
      ...rest
    },
    ref,
  ) {
    const innerRef = useRef<ScrollView>(null);
    const offsetY = useRef(0);
    const session = useRef<{
      node: unknown;
      height: number;
      screenY: number;
    }>({ node: null, height: 0, screenY: 0 });
    const keyboard = useKeyboardBottomInset();
    const { height: windowHeight } = useWindowDimensions();
    const reduced = useReducedMotion();

    useImperativeHandle(ref, () => innerRef.current as ScrollView);

    const reveal = useCallback(() => {
      if (keyboard.height <= 0) {
        session.current = { node: null, height: 0, screenY: 0 };
        return;
      }

      const node = asMeasurable(TextInput.State.currentlyFocusedInput?.());
      const scrollHost = innerRef.current;
      const scroll = asMeasurable(scrollHost);
      if (!node || !scroll || !scrollHost) {
        return;
      }

      if (
        session.current.node === node &&
        session.current.height === keyboard.height &&
        session.current.screenY === keyboard.screenY
      ) {
        return;
      }

      whenInsideScrollView(node, scrollHost, () => {
        scroll.measureInWindow((_sx, sy, _sw, sh) => {
          node.measureInWindow((_ix, iy, iw, ih) => {
            if (iw <= 0 && ih <= 0) {
              return;
            }

            // KeyboardDock already reserved keyboard.height under the app,
            // so the scroll view's measured frame is the visible area.
            const visibleBottom = Math.min(sy + sh, windowHeight);
            const result = revealFocusedField({
              fieldTop: iy,
              fieldBottom: iy + ih,
              visibleTop: sy,
              visibleBottom,
              scrollY: offsetY.current,
            });

            session.current = {
              node,
              height: keyboard.height,
              screenY: keyboard.screenY,
            };
            if (Math.abs(result.scrollY - offsetY.current) < 1) {
              return;
            }
            requestAnimationFrame(() => {
              innerRef.current?.scrollTo({
                y: result.scrollY,
                animated: !reduced,
              });
            });
          });
        });
      });
    }, [keyboard.height, keyboard.screenY, reduced, windowHeight]);

    useEffect(() => {
      if (keyboard.height <= 0) {
        session.current = { node: null, height: 0, screenY: 0 };
        return;
      }
      const id = requestAnimationFrame(reveal);
      return () => cancelAnimationFrame(id);
    }, [keyboard.height, keyboard.screenY, reveal]);

    useEffect(() => subscribeTextInputFocused(reveal), [reveal]);

    const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      offsetY.current = event.nativeEvent.contentOffset.y;
      onScroll?.(event);
    };

    return (
      <ScrollView
        ref={innerRef}
        automaticallyAdjustKeyboardInsets={automaticallyAdjustKeyboardInsets}
        keyboardDismissMode={keyboardDismissMode}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        {...rest}
      >
        {children}
      </ScrollView>
    );
  },
);
