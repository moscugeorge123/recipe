import { useEffect, useState } from 'react';
import { Dimensions, Keyboard, Platform } from 'react-native';

import { duration } from '@/lib/motion';

export const KEYBOARD_FOCUS_MARGIN = 16;
const RESIZE_SLACK = 48;

export type KeyboardInset = {
  height: number;
  screenY: number;
  durationMs: number;
};

export type FieldRevealInput = {
  fieldTop: number;
  fieldBottom: number;
  visibleTop: number;
  visibleBottom: number;
  scrollY: number;
  margin?: number;
};

export type FieldRevealResult = {
  scrollY: number;
  extraBottom: number;
};

const focusListeners = new Set<() => void>();

export function notifyTextInputFocused(): void {
  focusListeners.forEach((listener) => {
    listener();
  });
}

export function subscribeTextInputFocused(listener: () => void): () => void {
  focusListeners.add(listener);
  return () => {
    focusListeners.delete(listener);
  };
}

/** Visible bottom of the window above the keyboard, without double-counting Android resize. */
export function keyboardVisibleBottom(
  windowHeight: number,
  keyboardScreenY: number,
  keyboardHeight: number,
): number {
  if (keyboardHeight <= 0) {
    return windowHeight;
  }
  if (Math.abs(windowHeight - keyboardScreenY) < RESIZE_SLACK) {
    return windowHeight;
  }
  return Math.min(windowHeight, keyboardScreenY);
}

/**
 * How much to dock a frame above an overlaying keyboard.
 * `frameBottom` is the frame's bottom in the same coordinates as
 * `keyboardScreenY` (the measured app view, not a stale window height).
 * Android reports a keyboard height with the nav bar already removed, and
 * edge-to-edge views often stay full-screen while window metrics shrink —
 * the overlap of this frame is what actually covers the sheet.
 */
export function keyboardOverlayInset(
  frameBottom: number,
  keyboardScreenY: number,
  keyboardHeight: number,
  screenHeight = frameBottom,
): number {
  if (keyboardHeight <= 0) {
    return 0;
  }
  const overlap = frameBottom - keyboardScreenY;
  if (overlap <= RESIZE_SLACK) {
    // Frame already ends at the keyboard. If it is still full-screen, the
    // event parked screenY on the bottom and the reported height is all we have.
    if (screenHeight - frameBottom <= RESIZE_SLACK) {
      return keyboardHeight;
    }
    return 0;
  }
  return overlap;
}

/**
 * Scroll just enough for the focused field to sit fully in the visible area.
 * extraBottom is only the obscured amount — never a full extra screen.
 */
export function revealFocusedField(input: FieldRevealInput): FieldRevealResult {
  const margin = input.margin ?? KEYBOARD_FOCUS_MARGIN;
  const topLimit = input.visibleTop + margin;
  const bottomLimit = input.visibleBottom - margin;
  const visibleSpan = bottomLimit - topLimit;
  const fieldHeight = input.fieldBottom - input.fieldTop;

  if (visibleSpan <= 0) {
    return { scrollY: input.scrollY, extraBottom: 0 };
  }

  if (fieldHeight > visibleSpan) {
    const delta = input.fieldTop - topLimit;
    return {
      scrollY: Math.max(0, input.scrollY + delta),
      extraBottom: Math.max(0, input.fieldBottom - bottomLimit),
    };
  }

  if (input.fieldTop >= topLimit && input.fieldBottom <= bottomLimit) {
    return { scrollY: input.scrollY, extraBottom: 0 };
  }

  if (input.fieldBottom > bottomLimit) {
    const delta = input.fieldBottom - bottomLimit;
    return {
      scrollY: Math.max(0, input.scrollY + delta),
      extraBottom: delta,
    };
  }

  return {
    scrollY: Math.max(0, input.scrollY + (input.fieldTop - topLimit)),
    extraBottom: 0,
  };
}

export function useKeyboardBottomInset(): KeyboardInset {
  const [inset, setInset] = useState<KeyboardInset>(() => ({
    height: 0,
    screenY: Dimensions.get('window').height,
    durationMs: duration.sheet,
  }));

  useEffect(() => {
    if (Platform.OS === 'web') {
      const viewport =
        typeof window !== 'undefined' ? window.visualViewport : null;
      const syncViewport = () => {
        if (!viewport) {
          return;
        }
        const covered = Math.max(
          0,
          window.innerHeight - viewport.height - viewport.offsetTop,
        );
        const height = covered < 100 ? 0 : covered;
        setInset({
          height,
          screenY:
            height > 0
              ? viewport.offsetTop + viewport.height
              : window.innerHeight,
          durationMs: duration.sheet,
        });
      };
      viewport?.addEventListener('resize', syncViewport);
      viewport?.addEventListener('scroll', syncViewport);
      return () => {
        viewport?.removeEventListener('resize', syncViewport);
        viewport?.removeEventListener('scroll', syncViewport);
      };
    }

    const eventDuration = (ms: number | undefined) =>
      ms && ms > 0 ? ms : duration.sheet;
    const showEvent =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, (event) => {
      setInset({
        height: event.endCoordinates.height,
        screenY: event.endCoordinates.screenY,
        durationMs: eventDuration(event.duration),
      });
    });
    const hide = Keyboard.addListener(hideEvent, (event) => {
      setInset({
        height: 0,
        screenY: Dimensions.get('window').height,
        durationMs: eventDuration(event.duration),
      });
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return inset;
}

/** Stops the document from scrolling a full viewport when the web keyboard opens. */
export function useLockWebDocumentScroll(): void {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') {
      return;
    }

    const html = document.documentElement;
    const body = document.body;
    const prev = {
      htmlOverflow: html.style.overflow,
      bodyOverflow: body.style.overflow,
      htmlOverscroll: html.style.overscrollBehavior,
      bodyOverscroll: body.style.overscrollBehavior,
    };
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    html.style.overscrollBehavior = 'none';
    body.style.overscrollBehavior = 'none';

    const pin = () => {
      window.scrollTo(0, 0);
      html.scrollTop = 0;
      body.scrollTop = 0;
    };

    const viewport = window.visualViewport;
    viewport?.addEventListener('resize', pin);
    viewport?.addEventListener('scroll', pin);
    window.addEventListener('scroll', pin);
    pin();

    return () => {
      html.style.overflow = prev.htmlOverflow;
      body.style.overflow = prev.bodyOverflow;
      html.style.overscrollBehavior = prev.htmlOverscroll;
      body.style.overscrollBehavior = prev.bodyOverscroll;
      viewport?.removeEventListener('resize', pin);
      viewport?.removeEventListener('scroll', pin);
      window.removeEventListener('scroll', pin);
    };
  }, []);
}
