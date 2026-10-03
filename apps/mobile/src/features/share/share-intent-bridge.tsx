import { useShareIntentContext } from 'expo-share-intent';
import { useEffect } from 'react';

import { handoffFromShare } from '@/features/share/url';
import { toast, useNav } from '@/tortie/nav-store';

/**
 * Opens the share preview when another app hands over a link. Mounted above
 * the shell so a share that arrives during launch is still waiting when the
 * first frame paints. `resetOnBackground: false` keeps that hand-off alive
 * if the app is backgrounded before the preview opens.
 */
export function ShareIntentBridge() {
  const { hasShareIntent, shareIntent, resetShareIntent } =
    useShareIntentContext();

  useEffect(() => {
    if (!hasShareIntent) return;

    const handoff = handoffFromShare({
      text: shareIntent.text,
      webUrl: shareIntent.webUrl,
      meta: shareIntent.meta?.title ? { title: shareIntent.meta.title } : null,
    });
    resetShareIntent();

    if (!handoff) {
      toast('That share doesn’t include a recipe link');
      return;
    }

    useNav.getState().openShare(handoff.url, handoff.title);
  }, [hasShareIntent, shareIntent, resetShareIntent]);

  return null;
}
