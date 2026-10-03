import { useUiStore } from '@/stores/ui-store';

export function showUndoToast(text: string, onUndo: () => void): void {
  useUiStore.getState().showToast({
    text,
    glyph: '↺',
    action: 'Undo',
    onAction: () => {
      useUiStore.getState().hideToast();
      onUndo();
    },
  });
}
