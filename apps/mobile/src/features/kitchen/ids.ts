const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const DEMO_COLLECTION_IDS = ['sunday', 'twenty', 'mum', 'six'] as const;

export function isSeedRecipeId(id: string): boolean {
  return id.startsWith('seed:');
}

/** UUID recipes that can be uploaded to the singleton profile. */
export function isMigratableRecipeId(id: string): boolean {
  return UUID_RE.test(id) && !isSeedRecipeId(id);
}

/**
 * Sample recipes belong to nobody, so they stay out of every account's data.
 * Opt in for UI work with `EXPO_PUBLIC_DEV_SEED_RECIPES=1` in a dev build.
 */
export function includeDevSeedRecipes(): boolean {
  return (
    typeof __DEV__ !== 'undefined' &&
    __DEV__ &&
    process.env.EXPO_PUBLIC_DEV_SEED_RECIPES === '1'
  );
}
