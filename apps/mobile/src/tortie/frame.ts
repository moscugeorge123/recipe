import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Maps the 390×844 design canvas onto real safe areas.
 * Design: 50px status bar, tab content at 58, pushed-screen buttons at 54,
 * tab bar 66 tall plus the system bottom inset, sheets 34px bottom padding.
 */
export function useFrame() {
  const insets = useSafeAreaInsets();
  // Only pad when the app actually draws under the status bar. A fixed
  // minimum stacks on top of an already-inset window and leaves a gap.
  const status = insets.top;
  const tabBarPad = insets.bottom;
  const tabBarH = 66 + tabBarPad;
  return {
    status,
    /** Top of tab content (design 58). */
    top: status + 8,
    /** Top of floating buttons on pushed screens (design 54). */
    pushTop: status + 4,
    tabBarH,
    tabBarPad,
    /** Bottom padding of tab scroll content (design 124). */
    tabContentBottom: tabBarH + 36,
    /** Sheet bottom padding (design 34). */
    sheetBottom: Math.max(34, insets.bottom),
    bottom: insets.bottom,
  };
}
