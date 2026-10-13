import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { useT } from '@/i18n';
import { recipeLanguageName } from '@/i18n/languages';
import { recipeKeys } from '@/features/query-keys';
import { requestRecipeTranslation } from '@/features/recipes/api';
import type { RecipeTranslation } from '@/features/recipes/types';
import { C } from '@/tortie/theme';
import { Glyph } from '@/tortie/ui/icon';
import { Press } from '@/tortie/ui/press';
import { sans, T } from '@/tortie/ui/text';

/**
 * Tells the user how the recipe text they are reading relates to their recipe language: being
 * translated by Tortie right now, translated, or not translatable. Renders nothing when the
 * recipe is already in the chosen language.
 */
export function TranslationBanner({
  recipeId,
  translation,
}: {
  recipeId: string;
  translation: RecipeTranslation | null | undefined;
}) {
  const t = useT();
  const client = useQueryClient();
  const [retrying, setRetrying] = useState(false);

  if (!translation || translation.status === 'ORIGINAL') return null;

  const language = recipeLanguageName(translation.language);

  const retry = () => {
    setRetrying(true);
    requestRecipeTranslation(recipeId, translation.language)
      .catch(() => undefined)
      .finally(() => {
        setRetrying(false);
        void client.invalidateQueries({
          queryKey: recipeKeys.localized(recipeId, translation.language),
        });
      });
  };

  const box = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.white,
  } as const;

  if (translation.status === 'PENDING') {
    return (
      <View
        style={box}
        accessibilityRole="progressbar"
        accessibilityLiveRegion="polite"
      >
        <ActivityIndicator size="small" color={C.green} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <T style={sans(14, 600)}>{t('recipe.translating', { language })}</T>
          <T style={[sans(12, 400, C.ink2), { marginTop: 2 }]}>
            {t('recipe.translatingSub')}
          </T>
        </View>
      </View>
    );
  }

  if (translation.status === 'READY') {
    return (
      <View style={[box, { paddingVertical: 8 }]}>
        <Glyph name="translate" size={18} color={C.green} />
        <T style={sans(13, 600, C.ink2)}>
          {t('recipe.translated', { language })}
        </T>
      </View>
    );
  }

  const failed = translation.status === 'FAILED';
  return (
    <View style={box} accessibilityLiveRegion="polite">
      <Glyph name="error" size={20} color={C.ink2} />
      <T style={[sans(14, 600), { flex: 1 }]}>
        {t(
          failed ? 'recipe.translationFailed' : 'recipe.translationUnavailable',
        )}
      </T>
      {failed ? (
        <Press
          onPress={retry}
          disabled={retrying}
          accessibilityRole="button"
          accessibilityLabel={t('recipe.translationRetry')}
        >
          <T style={sans(14, 700, C.green)}>{t('recipe.translationRetry')}</T>
        </Press>
      ) : null}
    </View>
  );
}
