import { useEffect, useRef, type ReactNode } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';

import {
  ContentSkeleton,
  SkeletonToContent,
} from '@/components/ui/content-skeleton';
import { EmptyStatePanel } from '@/components/ui/empty-state';
import { InlineErrorPanel } from '@/components/ui/inline-error';
import { MotionItem } from '@/components/ui/motion-item';
import { SectionLabel } from '@/components/ui/section-label';
import { StaleIndicator } from '@/components/ui/stale-indicator';
import { RecipeCard } from '@/features/home/recipe-card';
import { mapRecipeListItem } from '@/features/recipes/mapper';
import type { RecipeListItemView } from '@/features/recipes/types';
import { mapUserError } from '@/lib/user-error';
import { focusRecoveryTarget } from '@/lib/recovery-focus';
import { useUiStore } from '@/stores/ui-store';

type HomeRecipeSectionProps = {
  title: string;
  emptyTitle: string;
  emptyActionLabel: string;
  onEmptyPress?: () => void;
  isLoading: boolean;
  isError: boolean;
  isFetching: boolean;
  fromCache: boolean;
  error?: unknown;
  items: RecipeListItemView[];
  onRetry: () => void;
  layout: 'horizontal' | 'grid';
};

export function HomeRecipeSection({
  title,
  emptyTitle,
  emptyActionLabel,
  onEmptyPress,
  isLoading,
  isError,
  isFetching,
  fromCache,
  error,
  items,
  onRetry,
  layout,
}: HomeRecipeSectionProps) {
  const openCapture = useUiStore((state) => state.openCapture);
  const width = useWindowDimensions().width;
  const cardWidth = Math.max(150, Math.floor((width - 40 - 12) / 2));
  const contentRef = useRef<View>(null);
  const hadError = useRef(false);

  const recipes = items.map(mapRecipeListItem);
  const emptyAction = onEmptyPress ?? openCapture;
  const copy = isError
    ? mapUserError(error ?? new Error('offline'), 'home', { log: !!error })
    : null;

  useEffect(() => {
    if (isError && !items.length) {
      hadError.current = true;
    }
    if (hadError.current && items.length) {
      hadError.current = false;
      focusRecoveryTarget(contentRef.current, `${title} loaded`);
    }
  }, [isError, items.length, title]);

  let body: ReactNode;
  if (!items.length && isError && !fromCache) {
    body = (
      <InlineErrorPanel
        message={
          copy?.message ??
          'We couldn’t load this section. Check your connection and try again.'
        }
        retryLabel={copy?.actionLabel ?? 'Retry'}
        retrying={isFetching}
        onRetry={onRetry}
      />
    );
  } else if (!items.length && isLoading) {
    body = <ContentSkeleton shape={layout === 'grid' ? 'grid' : 'cards'} />;
  } else if (!items.length) {
    body = (
      <EmptyStatePanel
        title={emptyTitle}
        actionLabel={emptyActionLabel}
        onAction={emptyAction}
      />
    );
  } else if (layout === 'grid') {
    body = (
      <SkeletonToContent ready skeleton={null} testID="home-section-content">
        <View className="flex-row flex-wrap gap-3 px-5">
          {recipes.map((recipe, index) => (
            <MotionItem
              key={recipe.id}
              preset="card"
              index={index}
              style={{ width: cardWidth }}
            >
              <RecipeCard
                recipe={recipe}
                width={cardWidth}
                photoHeight={118}
                showEngagement
              />
            </MotionItem>
          ))}
        </View>
      </SkeletonToContent>
    );
  } else {
    body = (
      <SkeletonToContent ready skeleton={null} testID="home-section-content">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="gap-3 px-5"
        >
          {recipes.map((recipe, index) => (
            <MotionItem
              key={recipe.id}
              preset="card"
              index={index}
              style={{ width: 168 }}
            >
              <RecipeCard
                recipe={recipe}
                width={168}
                photoHeight={132}
                showEngagement
              />
            </MotionItem>
          ))}
        </ScrollView>
      </SkeletonToContent>
    );
  }

  return (
    <View
      ref={contentRef}
      className="pb-[26px]"
      testID={`home-section-${title}`}
    >
      <SectionLabel className="px-5 pb-3">{title}</SectionLabel>
      {fromCache ? <StaleIndicator className="px-5 pb-3" /> : null}
      {isError && items.length && copy ? (
        <View className="px-5 pb-3">
          <InlineErrorPanel
            message={copy.message}
            retryLabel={copy.actionLabel}
            retrying={isFetching}
            onRetry={onRetry}
          />
        </View>
      ) : null}
      {items.length ? body : <View className="px-5">{body}</View>}
    </View>
  );
}
