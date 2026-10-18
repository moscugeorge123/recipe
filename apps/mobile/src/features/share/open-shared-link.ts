import { importKeyOf } from '@/features/share/url';
import { findRunningImport } from '@/tortie/data/import-engine';
import { useNav } from '@/tortie/nav-store';

/**
 * Opens the share screen for a link another app handed over. Returns false when that link is
 * already open there (a re-delivered hand-off). A link that is still importing reopens on the
 * running import instead of offering another.
 */
export function openSharedLink(url: string, title: string | null): boolean {
  const nav = useNav.getState();
  if (
    nav.shareOpen &&
    nav.shareUrl &&
    importKeyOf(nav.shareUrl) === importKeyOf(url)
  ) {
    return false;
  }
  // An incoming share starts from a clean stack: no clip viewer, cook mode or sheet
  // left open underneath it.
  nav.closeOverlays();
  nav.openShare(url, title);
  useNav.setState({ shareJobId: findRunningImport(url)?.id ?? null });
  return true;
}
