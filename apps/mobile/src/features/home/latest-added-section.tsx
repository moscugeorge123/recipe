import { HomeRecipeSection } from '@/features/home/home-recipe-section';
import { useHomeRecipes } from '@/features/home/use-home-recipes';

export function LatestAddedSection() {
  const query = useHomeRecipes('latest');

  return (
    <HomeRecipeSection
      title="LAST UPLOADED"
      emptyTitle="You haven’t added any recipes yet. Capture a link, photo or note to get started."
      emptyActionLabel="Add your first recipe"
      layout="horizontal"
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
