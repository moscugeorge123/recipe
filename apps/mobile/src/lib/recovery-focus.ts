import { AccessibilityInfo, findNodeHandle, type View } from 'react-native';

import { announce } from '@/lib/announce';

export function focusRecoveryTarget(
  target: View | null,
  message?: string,
): void {
  if (message) {
    announce(message);
  }
  const handle = target ? findNodeHandle(target) : null;
  if (handle == null) {
    return;
  }
  AccessibilityInfo.setAccessibilityFocus(handle);
}
