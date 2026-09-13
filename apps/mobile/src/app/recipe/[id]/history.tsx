import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';

import { Button } from '@/components/ui/button';
import { ContentSkeleton } from '@/components/ui/content-skeleton';
import { IconButton } from '@/components/ui/icon-button';
import { MotionItem } from '@/components/ui/motion-item';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { useRecipeRevisions } from '@/features/recipes/hooks/use-recipe-editor';
import {
  formatRevisionSource,
  formatRevisionWhen,
  RESTORE_EXPLANATION,
} from '@/features/recipes/revision-copy';
import { colors } from '@/theme/tokens';

export default function RecipeHistoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const history = useRecipeRevisions(id ?? '');

  return (
    <Screen>
      <ScrollView
        testID="recipe-history-scroll"
        contentContainerClassName="px-5 pb-10"
        refreshControl={
          <RefreshControl
            refreshing={!!history.isFetching && !history.isLoading}
            onRefresh={() => {
              void history.refetch();
            }}
            tintColor={colors.paprika}
            accessibilityLabel="Refresh revision history"
          />
        }
      >
        <IconButton
          accessibilityLabel="Back"
          onPress={() => router.back()}
        >
          <ChevronLeft size={22} color={colors.espresso} strokeWidth={2.2} />
        </IconButton>
        <Text variant="display">Revision history</Text>
        <Text variant="caption" className="pb-5 pt-2">
          {RESTORE_EXPLANATION}
        </Text>
        {history.isLoading && !history.data ? (
          <ContentSkeleton shape="timeline" />
        ) : null}
        {history.isError && !history.data ? (
          <View className="rounded-[18px] border border-crust bg-bg-elevated p-4">
            <Text accessibilityRole="alert">
              Could not load history. Check your connection and try again.
            </Text>
            <Button
              label="Retry"
              variant="ghost"
              className="mt-2"
              onPress={() => {
                void history.refetch();
              }}
            />
          </View>
        ) : null}
        {!history.isLoading &&
        !history.isError &&
        history.data?.length === 0 ? (
          <Text variant="caption">No revisions yet for this recipe.</Text>
        ) : null}
        {history.data?.map((revision, index) => (
          <MotionItem key={revision.id} preset="timeline" index={index}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                revision.isOriginal
                  ? `Open original import, revision ${revision.revisionNumber}`
                  : `Open revision ${revision.revisionNumber}, ${formatRevisionSource(revision.source)}`
              }
              onPress={() =>
                router.push(`/recipe/${id}/revision/${revision.id}`)
              }
              className="mb-3 min-h-11 rounded-[18px] border border-crust bg-bg-elevated p-4"
              testID={`revision-timeline-${revision.id}`}
            >
              <View className="flex-row flex-wrap items-center justify-between gap-2">
                <Text variant="title" className="flex-1 pr-2">
                  {revision.isOriginal
                    ? 'Original import'
                    : `Revision ${revision.revisionNumber}`}
                </Text>
                {revision.isOriginal ? (
                  <View className="rounded-full bg-secondary-soft px-3 py-1">
                    <Text variant="kicker">ORIGINAL</Text>
                  </View>
                ) : null}
              </View>
              <Text variant="caption" className="pt-2">
                {revision.summary}
              </Text>
              <Text variant="caption" className="pt-1">
                {formatRevisionWhen(revision.createdAt)} ·{' '}
                {formatRevisionSource(revision.source)}
              </Text>
            </Pressable>
          </MotionItem>
        ))}
      </ScrollView>
    </Screen>
  );
}
