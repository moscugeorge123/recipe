export interface ProfileBootstrapResult {
  profileId: string;
  categoriesCreated: number;
  recipeLinksCreated: number;
  revisionsCreated: number;
}

export interface IProfileBootstrapRepository {
  /** Upserts only the default user row and its categories (no recipe links). */
  ensureDefaultUser(): Promise<number>;
  ensureDefaults(): Promise<ProfileBootstrapResult>;
}
