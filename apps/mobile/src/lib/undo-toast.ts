import { useUiStore } from '@/stores/ui-store';
import { tNow } from '@/i18n/format';

export function showUndoToast(text: string, onUndo: () => void): void {
  useUiStore.getState().showToast({
    text,
    glyph: '↺',
    action: tNow('editor.undo'),
    onAction: () => {
      useUiStore.getState().hideToast();
      onUndo();
    },
  });
}
