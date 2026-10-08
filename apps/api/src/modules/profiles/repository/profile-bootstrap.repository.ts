export interface ProfileBootstrapResult {
  profileId: string;
  categoriesCreated: number;
  recipeLinksCreated: number;
  revisionsCreated: number;
}

export interface IProfileBootstrapRepository {
  ensureDefaults(): Promise<ProfileBootstrapResult>;
}
