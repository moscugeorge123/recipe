export interface CollectionCoverPreview {
  recipeId: string;
  title: string;
  thumbnailUrl: string | null;
}

export interface CollectionSummary {
  id: string;
  name: string;
  description: string | null;
  recipeCount: number;
  recipeIds: string[];
  coverPreviews: CollectionCoverPreview[];
  createdAt: string;
  updatedAt: string;
}
