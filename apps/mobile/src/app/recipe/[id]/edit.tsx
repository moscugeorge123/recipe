import { router, useLocalSearchParams } from 'expo-router';

import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { RecipeEditor } from '@/features/recipes/components/recipe-editor';
import { useRecipe } from '@/features/recipes/hooks/use-recipe';
import { useUiStore } from '@/stores/ui-store';

export default function EditRecipeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const recipe = useRecipe(id);
  const showToast = useUiStore((state) => state.showToast);

  if (!recipe.data) {
    return (
      <Screen className="px-5">
        <Text variant="display">
          {recipe.isLoading ? 'Loading…' : 'Recipe missing'}
        </Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <RecipeEditor
        recipe={recipe.data}
        onCancel={() => router.back()}
        onSaved={() => {
          showToast({ text: 'New revision saved', glyph: '✓' });
          router.back();
        }}
      />
    </Screen>
  );
}
