export function collectionDeleteCopy(name: string): {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
} {
  return {
    title: `Delete “${name}”?`,
    message: 'Recipes stay in your kitchen. Only this collection is removed.',
    confirmLabel: 'Delete collection',
    cancelLabel: 'Keep',
  };
}
