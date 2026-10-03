export const REVISION_SOURCE_LABEL = {
  IMPORT: 'Imported',
  USER_EDIT: 'Edited',
  AI_ASSISTED: 'Assisted edit',
  RESTORE: 'Restored',
  MIGRATION: 'Migrated',
} as const;

export const RESTORE_EXPLANATION =
  'Restoring never deletes newer versions. It creates a new revision.';

export const RESTORE_CONFIRMATION =
  'Your current recipe remains in history. A new revision will be created. Nothing already in history will be deleted.';

export function formatRevisionSource(source: string): string {
  return (
    REVISION_SOURCE_LABEL[source as keyof typeof REVISION_SOURCE_LABEL] ??
    source.replaceAll('_', ' ')
  );
}

export function formatRevisionWhen(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}
