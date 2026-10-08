export const RevisionSource = {
  IMPORT: "IMPORT",
  USER_EDIT: "USER_EDIT",
  AI_ASSISTED: "AI_ASSISTED",
  RESTORE: "RESTORE",
  MIGRATION: "MIGRATION",
} as const;

export type RevisionSource =
  (typeof RevisionSource)[keyof typeof RevisionSource];

export interface RevisionRef {
  id: string;
  userRecipeId: string;
  revisionNumber: number;
  source: RevisionSource;
  createdAt: string;
}

export interface CreateRevisionRequest<TSnapshot> {
  userRecipeId: string;
  expectedRevisionNumber?: number;
  source: RevisionSource;
  snapshot: TSnapshot;
}

export interface RevisionResponse<TSnapshot> extends RevisionRef {
  snapshot: TSnapshot;
}
