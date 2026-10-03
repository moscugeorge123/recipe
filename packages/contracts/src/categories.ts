export const DefaultCategorySlug = {
  BREAKFAST: "breakfast",
  LUNCH: "lunch",
  DINNER: "dinner",
  SWEET: "sweet",
} as const;

export type DefaultCategorySlug =
  (typeof DefaultCategorySlug)[keyof typeof DefaultCategorySlug];

export const DEFAULT_CATEGORIES = [
  { slug: DefaultCategorySlug.BREAKFAST, name: "Breakfast", sortOrder: 0 },
  { slug: DefaultCategorySlug.LUNCH, name: "Lunch", sortOrder: 1 },
  { slug: DefaultCategorySlug.DINNER, name: "Dinner", sortOrder: 2 },
  { slug: DefaultCategorySlug.SWEET, name: "Sweet", sortOrder: 3 },
] as const;

export interface CategorySummary {
  id: string;
  slug: string;
  name: string;
  sortOrder: number;
}
