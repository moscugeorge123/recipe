import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { ContentSkeleton } from '@/components/ui/content-skeleton';
import { InlineErrorPanel } from '@/components/ui/inline-error';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { RecipeEditor } from '@/features/recipes/components/recipe-editor';
import { useRecipe } from '@/features/recipes/hooks/use-recipe';
import { mapUserError } from '@/lib/user-error';
import { useUiStore } from '@/stores/ui-store';
import { colors, fonts } from '@/theme/tokens';

function ImportWordmark() {
  return (
    <Text
      accessibilityRole="header"
      className="pt-1"
      style={{
        fontFamily: fonts.manrope800,
        fontSize: 22,
        color: colors.paprika,
      }}
    >
      Recipe
    </Text>
  );
}

export default function ReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const fetched = useRecipe(id);
  const recipe = fetched.data;
  const showToast = useUiStore((state) => state.showToast);
  const copy = fetched.isError
    ? mapUserError(fetched.error ?? new Error('offline'), 'recipe', {
        log: !!fetched.error,
      })
    : null;

  if (!recipe && fetched.isLoading) {
    return (
      <Screen className="px-5 pt-4">
        <ImportWordmark />
        <ContentSkeleton shape="detail" />
      </Screen>
    );
  }

  if (!recipe && fetched.isError) {
    return (
      <Screen className="px-5 pt-4">
        <ImportWordmark />
        <Text variant="display" className="pb-4">
          Review
        </Text>
        <InlineErrorPanel
          message={
            copy?.message ??
            'We couldn’t load this recipe. Check your connection and try again.'
          }
          retryLabel={copy?.actionLabel ?? 'Retry'}
          retrying={fetched.isFetching}
          onRetry={() => {
            void fetched.refetch();
          }}
        />
      </Screen>
    );
  }

  if (!recipe) {
    return (
      <Screen className="px-5">
        <ImportWordmark />
        <Text variant="display">Recipe missing</Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <View className="px-5">
        <ImportWordmark />
      </View>
      <RecipeEditor
        recipe={recipe}
        onCancel={() => router.back()}
        onSaved={(saved) => {
          showToast({ text: 'Recipe reviewed and saved', glyph: '✓' });
          router.replace(`/recipe/${saved.id}`);
        }}
      />
    </Screen>
  );
}
