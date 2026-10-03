export function collectionDeleteCopy(name: string): {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
} {
  return {
    title: `Delete “${name}”?`,
    message: 'Recipes stay in your kitchen. Only this cookbook is removed.',
    confirmLabel: 'Delete cookbook',
    cancelLabel: 'Keep',
  };
}
