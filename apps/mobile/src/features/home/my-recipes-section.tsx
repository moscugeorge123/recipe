import { HomeRecipeSection } from '@/features/home/home-recipe-section';
import { useHomeRecipes } from '@/features/home/use-home-recipes';

export function MyRecipesSection() {
  const query = useHomeRecipes('engagement');

  return (
    <HomeRecipeSection
      title="MY RECIPES"
      emptyTitle="Your recipes will rank here as you favorite them and finish cooks."
      emptyActionLabel="Add a recipe"
      layout="grid"
      items={query.data?.items ?? []}
      isLoading={query.isLoading}
      isError={query.isError}
      isFetching={query.isFetching}
      fromCache={query.data?.fromCache === true}
      error={query.error}
      onRetry={() => {
        void query.refetch();
      }}
    />
  );
}
