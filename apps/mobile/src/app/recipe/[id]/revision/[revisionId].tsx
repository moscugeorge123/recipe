import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { ConfirmSheet } from '@/components/ui/confirm-sheet';
import { ContentSkeleton } from '@/components/ui/content-skeleton';
import { InlineErrorPanel } from '@/components/ui/inline-error';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import {
  useRecipeRevision,
  useRestoreRecipe,
} from '@/features/recipes/hooks/use-recipe-editor';
import { useRecipe } from '@/features/recipes/hooks/use-recipe';
import {
  RESTORE_CONFIRMATION,
  RESTORE_EXPLANATION,
} from '@/features/recipes/revision-copy';
import { mapUserError } from '@/lib/user-error';
import { useUiStore } from '@/stores/ui-store';
import { ApiError } from '@/services/api-client';

export default function RecipeRevisionScreen() {
  const { id, revisionId } = useLocalSearchParams<{
    id: string;
    revisionId: string;
  }>();
  const revision = useRecipeRevision(id ?? '', revisionId ?? '');
  const current = useRecipe(id);
  const restore = useRestoreRecipe(id ?? '');
  const showToast = useUiStore((state) => state.showToast);
  const [restoreOpen, setRestoreOpen] = useState(false);

  if (!revision.data && revision.isLoading) {
    return (
      <Screen className="px-5 pt-4">
        <ContentSkeleton shape="detail" />
      </Screen>
    );
  }

  if (!revision.data && revision.isError) {
    const copy = mapUserError(revision.error, 'recipe');
    return (
      <Screen className="px-5 pt-4">
        <Text variant="display" className="pb-4">
          Revision
        </Text>
        <InlineErrorPanel
          message={copy.message}
          retryLabel="Retry"
          retrying={revision.isFetching}
          onRetry={() => {
            void revision.refetch();
          }}
        />
      </Screen>
    );
  }

  if (!revision.data) {
    return (
      <Screen className="px-5">
        <Text variant="display">Revision missing</Text>
      </Screen>
    );
  }

  const data = revision.data;
  const runRestore = () => {
    restore.mutate(
      {
        revisionId: data.revisionId ?? revisionId,
        expectedRevisionNumber: current.data?.revisionNumber ?? 0,
      },
      {
        onSuccess: () => {
          showToast({
            text: 'Revision restored as a new version',
            glyph: '↺',
          });
          router.replace(`/recipe/${id}`);
        },
      },
    );
  };

  return (
    <Screen>
      <ScrollView contentContainerClassName="px-5 pb-10">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => router.back()}
          className="h-11 w-11 items-center justify-center"
        >
          <Text className="text-[22px]">‹</Text>
        </Pressable>
        <View className="flex-row items-center gap-2">
          <Text variant="display">
            {data.revisionNumber === 0
              ? 'Original import'
              : `Revision ${data.revisionNumber}`}
          </Text>
          {data.revisionNumber === 0 ? (
            <View className="rounded-full bg-secondary-soft px-3 py-1">
              <Text variant="kicker">ORIGINAL</Text>
            </View>
          ) : null}
        </View>
        <Text variant="caption" className="pb-2 pt-2">
          {data.summary}
        </Text>
        <Text variant="caption" className="pb-5">
          {RESTORE_EXPLANATION}
        </Text>

        <View className="rounded-[18px] border border-crust bg-bg-elevated p-4">
          <Text variant="title">{data.title}</Text>
          {data.description ? (
            <Text className="pt-2">{data.description}</Text>
          ) : null}
          <Text variant="section" className="pb-2 pt-5">
            CHANGES
          </Text>
          {data.changes.map((change) => (
            <Text key={change}>• {change}</Text>
          ))}
          <Text variant="section" className="pb-2 pt-5">
            CATEGORIES
          </Text>
          <Text>
            {data.categories?.map((category) => category.name).join(' · ') ||
              'None'}
          </Text>
          <Text variant="section" className="pb-2 pt-5">
            INGREDIENTS
          </Text>
          {data.ingredients.map((ingredient) => (
            <Text key={ingredient.id}>
              {ingredient.emoji ?? '🥣'} {ingredient.name}
            </Text>
          ))}
          <Text variant="section" className="pb-2 pt-5">
            STEPS
          </Text>
          {data.steps.map((step) => (
            <Text key={step.id} className="pb-2">
              {step.stepOrder}. {step.instruction}
            </Text>
          ))}
        </View>
        {restore.error ? (
          <Text accessibilityRole="alert" className="pt-3" tone="primary">
            {restore.error instanceof ApiError &&
            restore.error.code === 'RECIPE_REVISION_CONFLICT'
              ? 'This recipe changed elsewhere. Reload and try again—your current version stays in history.'
              : 'Could not restore. Reload the recipe and try again.'}
          </Text>
        ) : null}
        <Button
          label={restore.isPending ? 'Restoring…' : 'Restore as new revision'}
          size="lg"
          className="mt-5"
          disabled={restore.isPending}
          onPress={() => setRestoreOpen(true)}
        />
      </ScrollView>
      <ConfirmSheet
        visible={restoreOpen}
        title={
          data.revisionNumber === 0
            ? 'Restore original recipe?'
            : `Restore revision ${data.revisionNumber}?`
        }
        message={RESTORE_CONFIRMATION}
        confirmLabel="Restore"
        cancelLabel="Cancel"
        pending={restore.isPending}
        onClose={() => setRestoreOpen(false)}
        onConfirm={() => {
          setRestoreOpen(false);
          runRestore();
        }}
      />
    </Screen>
  );
}
