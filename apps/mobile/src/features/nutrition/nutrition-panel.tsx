import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Chip } from '@/components/ui/chip';
import { ContentSkeleton } from '@/components/ui/content-skeleton';
import { CrossfadeText } from '@/components/ui/crossfade-text';
import { InlineErrorPanel } from '@/components/ui/inline-error';
import { StaleIndicator } from '@/components/ui/stale-indicator';
import { Text } from '@/components/ui/text';
import {
  useRecipeNutrition,
  useRecalculateNutrition,
} from '@/features/nutrition/hooks';
import type {
  NutritionValues,
  NutritionView,
} from '@/features/nutrition/types';
import { mapUserError } from '@/lib/user-error';
import { colors } from '@/theme/tokens';

type Basis = 'portion' | 'per100g';

type MacroRow = { key: keyof NutritionValues; label: string; suffix: string };

const PRIMARY: MacroRow[] = [
  { key: 'calories', label: 'kcal', suffix: '' },
  { key: 'proteinGrams', label: 'Protein', suffix: 'g' },
  { key: 'carbohydrateGrams', label: 'Carbs', suffix: 'g' },
  { key: 'fatGrams', label: 'Fat', suffix: 'g' },
];

const DETAILS: MacroRow[] = [
  { key: 'saturatedFatGrams', label: 'Saturated fat', suffix: 'g' },
  { key: 'fiberGrams', label: 'Fiber', suffix: 'g' },
  { key: 'sugarGrams', label: 'Sugars', suffix: 'g' },
  { key: 'sodiumMilligrams', label: 'Sodium', suffix: 'mg' },
];

function formatValue(value: number | undefined, suffix: string): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '—';
  }
  const rounded =
    suffix === '' ? Math.round(value) : Math.round(value * 10) / 10;
  return suffix ? `${rounded}${suffix}` : String(rounded);
}

function providerLabel(provider: string | null): string | null {
  if (provider === 'usda-fdc') return 'USDA FoodData Central';
  if (provider === 'fake') return 'Test catalog';
  return provider;
}

export function NutritionPanelView({
  nutrition,
  isLoading,
  isError = false,
  error,
  onRetry,
}: {
  nutrition: NutritionView | undefined;
  isLoading: boolean;
  isError?: boolean;
  error?: unknown;
  onRetry: () => void;
}) {
  const [basis, setBasis] = useState<Basis>('portion');
  const [expanded, setExpanded] = useState(false);
  const copy = isError
    ? mapUserError(error ?? new Error('offline'), 'nutrition', {
        log: !!error,
      })
    : null;
  const firstCalc =
    (isLoading && !nutrition) ||
    (nutrition?.status === 'PENDING' &&
      !nutrition.updating &&
      nutrition.perPortion == null);
  const values =
    basis === 'per100g' ? nutrition?.per100g : nutrition?.perPortion;
  const per100gAvailable = nutrition?.per100g != null;

  return (
    <View className="mt-6 rounded-[16px] bg-linen p-4">
      <View className="flex-row items-center justify-between">
        <Text variant="section">NUTRITION</Text>
        {nutrition?.updating ? (
          <Text variant="caption" style={{ color: colors.sky }}>
            Updating
          </Text>
        ) : null}
      </View>

      {nutrition?.fromCache ? (
        <StaleIndicator
          className="pt-1"
          message="Showing last calculated values."
        />
      ) : null}

      {firstCalc ? <ContentSkeleton shape="nutrition" /> : null}

      {!firstCalc && isError ? (
        <View className="mt-3">
          <InlineErrorPanel
            message={
              copy?.message ??
              'We couldn’t load nutrition. The recipe is still here.'
            }
            retryLabel="Retry nutrition"
            onRetry={onRetry}
          />
        </View>
      ) : null}

      {!firstCalc && !isError && nutrition?.status === 'UNAVAILABLE' ? (
        <View className="mt-3">
          <Text variant="caption">
            Nutrition isn&apos;t available yet. Saving and cooking are still
            open.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Calculate nutrition"
            onPress={onRetry}
            className="mt-2 min-h-11 justify-center"
          >
            <Text tone="primary">Calculate</Text>
          </Pressable>
        </View>
      ) : null}

      {!firstCalc && !isError && nutrition?.status === 'FAILED' ? (
        <View className="mt-3">
          <Text variant="caption">
            {nutrition.failureReason ??
              "We couldn't calculate nutrition for this recipe."}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retry nutrition"
            onPress={onRetry}
            className="mt-2 min-h-11 justify-center"
          >
            <Text tone="primary">Retry</Text>
          </Pressable>
        </View>
      ) : null}

      {!firstCalc &&
      !isError &&
      nutrition &&
      (nutrition.status === 'READY' ||
        nutrition.status === 'PARTIAL' ||
        nutrition.status === 'PENDING') ? (
        <View className="mt-3">
          {nutrition.status === 'PENDING' && !nutrition.updating ? (
            <Text variant="caption" className="pb-2">
              Calculating from the current ingredients…
            </Text>
          ) : null}

          <View className="flex-row gap-2">
            <Chip
              label="Per portion"
              selected={basis === 'portion'}
              onPress={() => setBasis('portion')}
            />
            <Chip
              label="Per 100g"
              selected={basis === 'per100g'}
              disabled={!per100gAvailable}
              onPress={() => {
                if (per100gAvailable) setBasis('per100g');
              }}
            />
          </View>

          <View className="mt-3 flex-row justify-between">
            {PRIMARY.map((item) => (
              <View key={item.key} className="max-w-[24%] items-center px-0.5">
                <CrossfadeText
                  value={formatValue(values?.[item.key], item.suffix)}
                  className="text-center text-[16px]"
                  testID={`nutrition-value-${item.key}`}
                  accessibilityLabel={`${item.label} ${formatValue(values?.[item.key], item.suffix)}`}
                />
                <Text variant="caption" className="text-center">
                  {item.label}
                </Text>
              </View>
            ))}
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              expanded ? 'Hide nutrition details' : 'Show nutrition details'
            }
            onPress={() => setExpanded((value) => !value)}
            className="mt-2 min-h-11 justify-center"
          >
            <Text tone="muted">{expanded ? 'Less detail' : 'More detail'}</Text>
          </Pressable>

          {expanded ? (
            <View className="gap-1">
              {DETAILS.map((item) => (
                <View
                  key={item.key}
                  className="flex-row items-center justify-between py-1"
                >
                  <Text variant="caption" className="flex-1 pr-3">
                    {item.label}
                  </Text>
                  <CrossfadeText
                    value={formatValue(values?.[item.key], item.suffix)}
                    className="text-[15.5px]"
                  />
                </View>
              ))}
            </View>
          ) : null}

          {nutrition.status === 'PARTIAL' ? (
            <Text
              variant="caption"
              className="pt-2"
              style={{ color: colors.sky }}
            >
              Based on {nutrition.coverage.matched} of{' '}
              {nutrition.coverage.total} ingredients
              {nutrition.unmatchedIngredients.length
                ? ` · skipped ${nutrition.unmatchedIngredients.join(', ')}`
                : ''}
            </Text>
          ) : nutrition.coverage.total > 0 ? (
            <Text variant="caption" className="pt-2">
              Based on {nutrition.coverage.matched} of{' '}
              {nutrition.coverage.total} ingredients
            </Text>
          ) : null}

          {providerLabel(nutrition.provider) ? (
            <Text variant="caption" className="pt-1">
              Source: {providerLabel(nutrition.provider)}
              {nutrition.calculatedAt
                ? ` · ${new Date(nutrition.calculatedAt).toLocaleDateString()}`
                : ''}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export function NutritionPanel({ recipeId }: { recipeId: string }) {
  const query = useRecipeNutrition(recipeId);
  const retry = useRecalculateNutrition(recipeId);
  const networkFail = query.isError && !query.data;

  if (recipeId.startsWith('seed:')) {
    return null;
  }

  return (
    <NutritionPanelView
      nutrition={query.data}
      isLoading={query.isLoading || retry.isPending}
      isError={networkFail}
      error={query.error}
      onRetry={() => {
        if (networkFail) {
          void query.refetch();
          return;
        }
        retry.mutate();
      }}
    />
  );
}
