import { ShareIntentProvider } from 'expo-share-intent';
import type { ReactNode } from 'react';

import { ShareIntentBridge } from '@/features/share/share-intent-bridge';

const SHARE_INTENT_OPTIONS = { resetOnBackground: false, debug: __DEV__ };

export function ShareRoot({ children }: { children: ReactNode }) {
  return (
    <ShareIntentProvider options={SHARE_INTENT_OPTIONS}>
      <ShareIntentBridge />
      {children}
    </ShareIntentProvider>
  );
}
