import {
  createContext,
  useContext,
  useLayoutEffect,
  type ReactNode,
  type Ref,
} from 'react';
import {
  ScrollView,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewProps,
} from 'react-native';
import {
  GestureDetector,
  type NativeGesture,
} from 'react-native-gesture-handler';
import type { SharedValue } from 'react-native-reanimated';

export type SheetScrollApi = {
  native: NativeGesture;
  scrollY: SharedValue<number>;
  /** Content height, or -1 until the scroller reports it. 0 when none is mounted. */
  contentH: SharedValue<number>;
  /** Viewport height, or -1 until layout. 0 when no scroller is mounted. */
  viewH: SharedValue<number>;
  /** 1 while the scroller's native pan is tracking the touch. */
  scrollActive: SharedValue<number>;
};

export const SheetScrollCtx = createContext<SheetScrollApi | null>(null);

/** Marks this scroller as the sheet body and reports offset, size, and touches. */
export function useSheetScrollReporter() {
  const api = useContext(SheetScrollCtx);
  useLayoutEffect(() => {
    if (!api) return;
    api.contentH.value = -1;
    api.viewH.value = -1;
    return () => {
      api.scrollY.value = 0;
      api.contentH.value = 0;
      api.viewH.value = 0;
      api.scrollActive.value = 0;
    };
  }, [api]);
  return api;
}

type SheetScrollProps = ScrollViewProps & {
  children?: ReactNode;
  ref?: Ref<ScrollView>;
};

/** ScrollView that hands a downward drag to the parent `Sheet` at its top. */
export function SheetScroll({
  children,
  onScroll,
  onLayout,
  onContentSizeChange,
  bounces = false,
  overScrollMode = 'never',
  alwaysBounceVertical = false,
  scrollEventThrottle = 16,
  ref,
  ...rest
}: SheetScrollProps) {
  const api = useSheetScrollReporter();
  const scroller = (
    <ScrollView
      {...rest}
      ref={ref}
      bounces={bounces}
      overScrollMode={overScrollMode}
      alwaysBounceVertical={alwaysBounceVertical}
      scrollEventThrottle={scrollEventThrottle}
      onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
        if (api) api.scrollY.value = e.nativeEvent.contentOffset.y;
        onScroll?.(e);
      }}
      onContentSizeChange={(w, h) => {
        if (api) api.contentH.value = h;
        onContentSizeChange?.(w, h);
      }}
      onLayout={(e) => {
        if (api) api.viewH.value = e.nativeEvent.layout.height;
        onLayout?.(e);
      }}
    >
      {children}
    </ScrollView>
  );
  if (!api) return scroller;
  return (
    <GestureDetector gesture={api.native} touchAction="pan-y">
      {scroller}
    </GestureDetector>
  );
}
