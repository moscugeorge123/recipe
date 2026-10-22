import { tNow } from '@/i18n/format';
export function collectionDeleteCopy(name: string): {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
} {
  return {
    title: tNow('collections.deleteTitle', { name }),
    message: tNow('collections.deleteMessage'),
    confirmLabel: tNow('collections.deleteConfirm'),
    cancelLabel: tNow('notes.keep'),
  };
}
