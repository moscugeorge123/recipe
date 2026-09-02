import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form';
import { useNavigation } from 'expo-router';
import {
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { ConfirmSheet } from '@/components/ui/confirm-sheet';
import { Chip } from '@/components/ui/chip';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { ApiError } from '@/services/api-client';
import { getRecipe } from '@/features/recipes/api';
import {
  clearRecipeEditorDraft,
  peekRecipeEditorDraft,
  readRecipeEditorDraft,
  rememberRecipeEditorDraft,
  type RecipeEditorDraft,
} from '@/features/recipes/editor-drafts';
import {
  EMPTY_INGREDIENT,
  EMPTY_STEP,
  editorDefaults,
  firstErrorPath,
  summarizeEditor,
  toPatchBody,
  valuesEqual,
  warningMessages,
  type RecipeEditorValues,
} from '@/features/recipes/editor-form';
import {
  useCategories,
  useSaveRecipe,
} from '@/features/recipes/hooks/use-recipe-editor';
import type { RecipeView } from '@/features/recipes/types';
import { mapUserError } from '@/lib/user-error';
import { announce } from '@/lib/announce';
import { usePopScale, useReducedMotion } from '@/lib/motion';
import { colors } from '@/theme/tokens';

const COLOR_TOKENS = [
  'paprikaSoft',
  'basilSoft',
  'honey50',
  'peach',
  'linen',
  'steamedMilk',
  'chili50',
] as const;

export type { RecipeEditorValues };

type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

type ConflictState = {
  latest: RecipeView | null;
  loading: boolean;
};

function EditorBlock({
  index,
  children,
}: {
  index: number;
  children: ReactNode;
}) {
  const cue = usePopScale(index, { skipInitial: true });
  return (
    <Animated.View
      style={cue.style}
      className="mb-3 gap-3 rounded-[18px] border border-crust bg-bg-elevated p-4"
    >
      {children}
    </Animated.View>
  );
}

function MoveButtons({
  label,
  index,
  length,
  move,
  remove,
}: {
  label: string;
  index: number;
  length: number;
  move: (from: number, to: number) => void;
  remove: (index: number) => void;
}) {
  return (
    <View className="flex-row flex-wrap justify-end">
      {[
        {
          glyph: '⤒',
          name: `Move ${label} to top`,
          hint: `Moves ${label} to the first position. Dragging is not required.`,
          disabled: index === 0,
          run: () => move(index, 0),
        },
        {
          glyph: '↑',
          name: `Move ${label} up`,
          hint: `Moves ${label} one position up. Dragging is not required.`,
          disabled: index === 0,
          run: () => move(index, index - 1),
        },
        {
          glyph: '↓',
          name: `Move ${label} down`,
          hint: `Moves ${label} one position down. Dragging is not required.`,
          disabled: index === length - 1,
          run: () => move(index, index + 1),
        },
        {
          glyph: '⤓',
          name: `Move ${label} to bottom`,
          hint: `Moves ${label} to the last position. Dragging is not required.`,
          disabled: index === length - 1,
          run: () => move(index, length - 1),
        },
      ].map((item) => (
        <Pressable
          key={item.name}
          accessibilityRole="button"
          accessibilityLabel={item.name}
          accessibilityHint={item.hint}
          accessibilityState={{ disabled: item.disabled }}
          disabled={item.disabled}
          onPress={item.run}
          className="h-11 w-11 items-center justify-center"
        >
          <Text tone={item.disabled ? 'disabled' : 'icon'}>{item.glyph}</Text>
        </Pressable>
      ))}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Remove ${label}`}
        accessibilityHint={`Removes ${label} from this recipe.`}
        onPress={() => remove(index)}
        className="h-11 w-11 items-center justify-center"
      >
        <Text style={{ color: colors.chili }}>×</Text>
      </Pressable>
    </View>
  );
}

function DraftBanner({
  draft,
  stale,
  onContinue,
  onDiscard,
}: {
  draft: RecipeEditorDraft;
  stale: boolean;
  onContinue: () => void;
  onDiscard: () => void;
}) {
  const summary = summarizeEditor(draft.values);
  return (
    <View
      testID="recipe-editor-draft-banner"
      className="mb-5 rounded-[15px] p-4"
      style={{ backgroundColor: colors.honey50 }}
    >
      <Text variant="kicker" className="pb-1">
        UNSAVED DRAFT
      </Text>
      <Text accessibilityLiveRegion="polite">
        {stale
          ? 'You have unsaved edits from an earlier version. The recipe was updated elsewhere. Your draft is still here.'
          : 'Restored unsaved edits from this device.'}
      </Text>
      <Text variant="caption" className="pt-1">
        {summary.title} · {summary.ingredientCount} ingredients ·{' '}
        {summary.stepCount} steps
      </Text>
      <View className="mt-3 flex-row flex-wrap gap-2">
        <Button
          label="Continue draft"
          variant="secondary"
          onPress={onContinue}
        />
        <Button label="Discard draft" variant="ghost" onPress={onDiscard} />
      </View>
    </View>
  );
}

function ConflictPanel({
  draft,
  conflict,
  onKeep,
  onReload,
  onRetry,
}: {
  draft: RecipeEditorValues;
  conflict: ConflictState;
  onKeep: () => void;
  onReload: () => void;
  onRetry: () => void;
}) {
  const yours = summarizeEditor(draft);
  const latest = conflict.latest;
  return (
    <View
      testID="recipe-editor-conflict"
      className="mb-3 rounded-[15px] bg-[#FDECEA] p-4"
    >
      <Text
        accessibilityRole="alert"
        accessibilityLiveRegion="assertive"
        style={{ color: colors.chili }}
      >
        This recipe changed elsewhere. Your draft is safe. Choose whether to
        keep it or load the latest version—nothing is overwritten until you
        save.
      </Text>
      <View className="mt-3 gap-2">
        <View className="rounded-[12px] bg-bg-elevated p-3">
          <Text variant="kicker">YOUR DRAFT</Text>
          <Text className="pt-1">
            {yours.title} · {yours.ingredientCount} ingredients ·{' '}
            {yours.stepCount} steps
          </Text>
        </View>
        <View className="rounded-[12px] bg-bg-elevated p-3">
          <Text variant="kicker">LATEST ON THE SERVER</Text>
          {conflict.loading ? (
            <Text className="pt-1">Loading the latest version…</Text>
          ) : latest ? (
            <Text className="pt-1">
              {latest.title} · revision {latest.revisionNumber ?? '—'} ·{' '}
              {latest.ingredients.length} ingredients · {latest.steps.length}{' '}
              steps
            </Text>
          ) : (
            <Text className="pt-1">
              Could not load the latest version. Your draft is still here.
            </Text>
          )}
        </View>
      </View>
      <View className="mt-3 gap-2">
        <Button label="Keep my draft" onPress={onKeep} />
        {latest ? (
          <Button
            label="Load latest version"
            variant="ghost"
            onPress={onReload}
          />
        ) : (
          <Button
            label="Try loading latest"
            variant="ghost"
            onPress={onRetry}
          />
        )}
      </View>
    </View>
  );
}

function discardCopy() {
  return {
    title: 'Discard unsaved edits?',
    message:
      'This removes the draft from this device. The recipe on the server is unchanged.',
  };
}

function saveLabel(status: SaveStatus): string {
  if (status === 'saving') return 'Saving…';
  if (status === 'saved') return 'Saved';
  return 'Save recipe';
}

function saveStatusCopy(status: SaveStatus, hasConflict = false): string {
  if (status === 'saving') return 'Saving';
  if (status === 'saved') return 'Saved';
  if (status === 'error')
    return hasConflict ? 'Revision conflict' : 'Save failed';
  if (status === 'dirty') return 'Unsaved draft on this device';
  return 'All fields loaded';
}

export function RecipeEditor({
  recipe,
  onSaved,
  onCancel,
}: {
  recipe: RecipeView;
  onSaved: (recipe: RecipeView) => void;
  onCancel: () => void;
}) {
  const categories = useCategories();
  const save = useSaveRecipe(recipe.id);
  const reducedMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const notices = warningMessages(recipe.warnings);
  const baseline = useRef(editorDefaults(recipe));
  const [expectedRevision, setExpectedRevision] = useState(
    recipe.revisionNumber ?? 0,
  );
  const memoryDraft = peekRecipeEditorDraft(recipe.id);
  const [phase, setPhase] = useState<'hydrating' | 'ready'>(
    memoryDraft ? 'ready' : 'hydrating',
  );
  const [recoveredDraft, setRecoveredDraft] =
    useState<RecipeEditorDraft | null>(
      memoryDraft && !valuesEqual(memoryDraft.values, baseline.current)
        ? memoryDraft
        : null,
    );
  const [viewingServer, setViewingServer] = useState(false);
  const [conflict, setConflict] = useState<ConflictState | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [status, setStatus] = useState<SaveStatus>('idle');
  const initializedCategoryFallback = useRef(false);
  const viewingServerRef = useRef(false);
  const expectedRevisionRef = useRef(expectedRevision);
  const skipRemoveGuard = useRef(false);
  const pendingDiscard = useRef<(() => void) | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);

  const requestDiscard = (onConfirm: () => void) => {
    pendingDiscard.current = onConfirm;
    setDiscardOpen(true);
  };
  const initial = useMemo(
    () =>
      memoryDraft && !valuesEqual(memoryDraft.values, baseline.current)
        ? memoryDraft.values
        : baseline.current,
    // First paint only; later recovery uses reset().
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [recipe.id],
  );
  const {
    control,
    handleSubmit,
    setValue,
    setError,
    setFocus,
    reset,
    watch,
    getValues,
    formState: { errors, isDirty },
  } = useForm<RecipeEditorValues>({ defaultValues: initial, mode: 'onBlur' });
  const ingredients = useFieldArray({ control, name: 'ingredients' });
  const steps = useFieldArray({ control, name: 'steps' });
  const selectedCategories = useWatch({ control, name: 'categoryIds' });

  useEffect(() => {
    expectedRevisionRef.current = expectedRevision;
  }, [expectedRevision]);

  useEffect(() => {
    viewingServerRef.current = viewingServer;
  }, [viewingServer]);

  useEffect(() => {
    let cancelled = false;
    if (memoryDraft) {
      setPhase('ready');
      return () => {
        cancelled = true;
      };
    }
    void readRecipeEditorDraft(recipe.id).then((draft) => {
      if (cancelled) return;
      if (draft && !valuesEqual(draft.values, baseline.current)) {
        reset(draft.values, { keepDefaultValues: true });
        setRecoveredDraft(draft);
        announce('Restored unsaved edits from this device.');
      }
      setPhase('ready');
    });
    return () => {
      cancelled = true;
    };
  }, [memoryDraft, recipe.id, reset]);

  useEffect(() => {
    if (phase !== 'ready') return;
    // Autosave needs the live form values without re-rendering the whole editor.
    // eslint-disable-next-line react-hooks/incompatible-library
    const subscription = watch((values) => {
      if (viewingServerRef.current) return;
      const next = values as RecipeEditorValues;
      if (valuesEqual(next, baseline.current)) return;
      rememberRecipeEditorDraft(recipe.id, expectedRevisionRef.current, next);
    });
    return () => subscription.unsubscribe();
  }, [phase, recipe.id, watch]);

  useEffect(() => {
    if (initializedCategoryFallback.current || !categories.data?.length) return;
    initializedCategoryFallback.current = true;
    if (selectedCategories.length === 0) {
      setValue('categoryIds', [categories.data[0]!.id]);
    }
  }, [categories.data, selectedCategories.length, setValue]);

  useEffect(() => {
    const incoming = recipe.revisionNumber ?? 0;
    if (incoming <= expectedRevisionRef.current) return;
    setConflict({ latest: recipe, loading: false });
    setSubmitError(
      'This recipe changed elsewhere. Your draft is safe—choose how to continue.',
    );
    setStatus('error');
  }, [recipe]);

  const dirty = isDirty || !!recoveredDraft;
  useEffect(() => {
    if (status === 'saving' || status === 'saved') return;
    if (submitError || conflict) {
      setStatus('error');
      return;
    }
    setStatus(dirty ? 'dirty' : 'idle');
  }, [conflict, dirty, status, submitError]);

  const discardDraft = useCallback(async () => {
    await clearRecipeEditorDraft(recipe.id);
    setRecoveredDraft(null);
    setViewingServer(false);
    setConflict(null);
    setSubmitError(null);
    reset(baseline.current);
  }, [recipe.id, reset]);

  const leaveEditor = (afterClear: boolean) => {
    skipRemoveGuard.current = true;
    if (afterClear) {
      void clearRecipeEditorDraft(recipe.id);
    }
    onCancel();
  };

  const requestLeave = () => {
    const hasDraft = !!peekRecipeEditorDraft(recipe.id) || dirty;
    if (!hasDraft) {
      leaveEditor(false);
      return;
    }
    requestDiscard(() => {
      void discardDraft().then(() => leaveEditor(true));
    });
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      if (skipRemoveGuard.current) return;
      const hasDraft = !!peekRecipeEditorDraft(recipe.id) || isDirty;
      if (!hasDraft) return;
      event.preventDefault();
      requestDiscard(() => {
        void discardDraft().then(() => {
          skipRemoveGuard.current = true;
          navigation.dispatch(event.data.action);
        });
      });
    });
    return unsubscribe;
  }, [discardDraft, isDirty, navigation, recipe.id]);

  const loadLatestRecipe = async (): Promise<RecipeView | null> => {
    setConflict((current) => ({
      latest: current?.latest ?? null,
      loading: true,
    }));
    try {
      const latest = await getRecipe(recipe.id);
      setConflict({ latest, loading: false });
      return latest;
    } catch {
      setConflict({ latest: null, loading: false });
      return null;
    }
  };

  const keepDraftAgainstLatest = () => {
    const latestNumber = conflict?.latest?.revisionNumber;
    if (typeof latestNumber === 'number') {
      setExpectedRevision(latestNumber);
    }
    setViewingServer(false);
    setConflict(null);
    setSubmitError(null);
    setStatus('dirty');
    announce('Keeping your draft. Save will create a new version.');
  };

  const reloadLatestIntoForm = () => {
    const latest = conflict?.latest;
    if (!latest) return;
    const stored = peekRecipeEditorDraft(recipe.id);
    baseline.current = editorDefaults(latest);
    setExpectedRevision(latest.revisionNumber ?? expectedRevision);
    setViewingServer(true);
    reset(baseline.current);
    setConflict(null);
    setSubmitError(null);
    if (stored && !valuesEqual(stored.values, baseline.current)) {
      setRecoveredDraft(stored);
    }
    announce('Loaded the latest version. Your draft is still on this device.');
  };

  const continueRecoveredDraft = () => {
    const draft = recoveredDraft ?? peekRecipeEditorDraft(recipe.id);
    if (!draft) return;
    setViewingServer(false);
    reset(draft.values, { keepDefaultValues: true });
    setRecoveredDraft(draft);
    announce('Continuing your unsaved draft.');
  };

  const requestDiscardDraft = () => {
    requestDiscard(() => {
      void discardDraft();
    });
  };

  const submit = handleSubmit(
    async (values) => {
      if (conflict) return;
      if (values.ingredients.length === 0) {
        setError('ingredients', { message: 'Add at least one ingredient' });
        announce('Add at least one ingredient');
        return;
      }
      if (values.steps.length === 0) {
        setError('steps', { message: 'Add at least one step' });
        announce('Add at least one step');
        return;
      }
      setSubmitError(null);
      setStatus('saving');
      const body = toPatchBody(values, expectedRevision);
      try {
        const saved = await save.mutateAsync(body);
        if (!viewingServerRef.current) {
          await clearRecipeEditorDraft(recipe.id);
        } else {
          const stored = peekRecipeEditorDraft(recipe.id);
          if (!stored || valuesEqual(stored.values, values)) {
            await clearRecipeEditorDraft(recipe.id);
          }
        }
        setRecoveredDraft(null);
        setStatus('saved');
        announce('Recipe saved');
        onSaved(saved);
      } catch (error) {
        mapUserError(error, 'recipe');
        const conflictError =
          error instanceof ApiError &&
          error.code === 'RECIPE_REVISION_CONFLICT';
        setSubmitError(
          conflictError
            ? 'This recipe changed elsewhere. Your draft is safe—choose how to continue.'
            : 'Could not save. Your draft is still here; check your connection and try again.',
        );
        setStatus('error');
        announce(
          conflictError
            ? 'This recipe changed elsewhere. Your draft is safe.'
            : 'Could not save. Your draft is still here.',
        );
        if (conflictError) {
          setConflict({ latest: null, loading: true });
          await loadLatestRecipe();
        }
      }
    },
    (formErrors) => {
      const path = firstErrorPath(formErrors);
      if (path) {
        setFocus(path);
      }
      const message =
        formErrors.title?.message ??
        formErrors.ingredients?.message ??
        formErrors.steps?.message ??
        'Check the highlighted fields';
      announce(String(message));
    },
  );

  if (phase === 'hydrating') {
    return (
      <View
        testID={
          reducedMotion ? 'recipe-editor-reduced-motion' : 'recipe-editor'
        }
        className="flex-1 items-center justify-center px-5"
      >
        <Text>Loading editor…</Text>
      </View>
    );
  }

  const recoveredIsStale =
    !!recoveredDraft && recoveredDraft.revisionNumber !== expectedRevision;

  return (
    <KeyboardAvoidingView
      testID={reducedMotion ? 'recipe-editor-reduced-motion' : 'recipe-editor'}
      className="flex-1"
      behavior="padding"
      keyboardVerticalOffset={24}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
        contentContainerClassName="px-5 pb-12"
      >
        <View className="flex-row items-center justify-between py-2">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancel editing"
            accessibilityHint="Asks before discarding unsaved edits."
            onPress={requestLeave}
            className="h-11 min-w-11 justify-center"
          >
            <Text tone="muted">Cancel</Text>
          </Pressable>
          <Text
            variant="caption"
            accessibilityLiveRegion="polite"
            testID="recipe-editor-status"
          >
            {saveStatusCopy(status, !!conflict)}
          </Text>
        </View>

        <Text variant="display">Review every field</Text>
        <Text variant="caption" className="pb-5 pt-2">
          The original import stays recoverable in revision history.
        </Text>
        {recoveredDraft ? (
          <DraftBanner
            draft={recoveredDraft}
            stale={recoveredIsStale}
            onContinue={continueRecoveredDraft}
            onDiscard={requestDiscardDraft}
          />
        ) : null}
        {notices.length > 0 ? (
          <View className="mb-5 rounded-[15px] bg-[#FFF8E1] p-4">
            <Text variant="kicker" className="pb-1">
              CHECK THESE
            </Text>
            {notices.map((notice) => (
              <Text key={notice} variant="caption">
                {notice}
              </Text>
            ))}
          </View>
        ) : null}

        <Text variant="section" className="pb-3">
          OVERVIEW
        </Text>
        <View className="gap-3">
          <Controller
            control={control}
            name="title"
            rules={{ required: 'Title is required' }}
            render={({ field }) => (
              <Input
                ref={field.ref}
                label="Title"
                value={field.value}
                onBlur={field.onBlur}
                onChangeText={field.onChange}
                error={errors.title?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="description"
            render={({ field }) => (
              <Input
                label="Description"
                value={field.value}
                onChangeText={field.onChange}
                multiline
                textAlignVertical="top"
              />
            )}
          />
          <Controller
            control={control}
            name="cuisine"
            render={({ field }) => (
              <Input
                label="Cuisine"
                value={field.value}
                onChangeText={field.onChange}
              />
            )}
          />
        </View>

        <Text variant="section" className="pb-3 pt-7">
          CATEGORIES
        </Text>
        <View className="flex-row flex-wrap gap-2">
          {categories.data?.map((category) => {
            const selected = selectedCategories.includes(category.id);
            return (
              <Chip
                key={category.id}
                label={category.name}
                selected={selected}
                onPress={() =>
                  setValue(
                    'categoryIds',
                    selected
                      ? selectedCategories.filter((id) => id !== category.id)
                      : [...selectedCategories, category.id],
                    { shouldDirty: true },
                  )
                }
              />
            );
          })}
        </View>
        {selectedCategories.length === 0 ? (
          <Text
            accessibilityRole="alert"
            className="pt-2"
            style={{ color: colors.chili }}
          >
            Choose at least one category.
          </Text>
        ) : null}

        <Text variant="section" className="pb-3 pt-7">
          TIMING & SERVINGS
        </Text>
        <View className="gap-3">
          {(
            [
              ['servings', 'Servings'],
              ['prepTimeMinutes', 'Prep minutes'],
              ['cookTimeMinutes', 'Cook minutes'],
              ['totalTimeMinutes', 'Total minutes'],
              ['calories', 'Calories'],
            ] as const
          ).map(([name, label]) => (
            <Controller
              key={name}
              control={control}
              name={name}
              rules={{
                pattern: { value: /^\d*$/, message: 'Use a whole number' },
              }}
              render={({ field }) => (
                <Input
                  ref={field.ref}
                  label={label}
                  value={field.value}
                  onChangeText={field.onChange}
                  keyboardType="number-pad"
                  error={errors[name]?.message}
                />
              )}
            />
          ))}
        </View>

        <Text variant="section" className="pb-3 pt-7">
          INGREDIENTS
        </Text>
        {ingredients.fields.map((item, index) => (
          <EditorBlock key={item.id} index={index}>
            <View className="flex-row items-center justify-between">
              <Text variant="kicker">INGREDIENT {index + 1}</Text>
              <MoveButtons
                label={`ingredient ${index + 1}`}
                index={index}
                length={ingredients.fields.length}
                move={ingredients.move}
                remove={ingredients.remove}
              />
            </View>
            {item.confidence < 0.7 ? (
              <Text
                accessibilityRole="text"
                accessibilityLabel={`Needs a look: ingredient ${index + 1}`}
                variant="caption"
                style={{ color: colors.chili }}
              >
                Needs a look
              </Text>
            ) : null}
            <Controller
              control={control}
              name={`ingredients.${index}.name`}
              rules={{ required: 'Ingredient name is required' }}
              render={({ field }) => (
                <Input
                  ref={field.ref}
                  label="Name"
                  value={field.value}
                  onChangeText={field.onChange}
                  error={errors.ingredients?.[index]?.name?.message}
                />
              )}
            />
            <View className="flex-row gap-2">
              <View className="w-20">
                <Controller
                  control={control}
                  name={`ingredients.${index}.emoji`}
                  rules={{
                    required: 'Required',
                    validate: (value) =>
                      (/\p{Extended_Pictographic}/u.test(value) &&
                        [
                          ...new Intl.Segmenter(undefined, {
                            granularity: 'grapheme',
                          }).segment(value),
                        ].length === 1) ||
                      'Use one emoji',
                  }}
                  render={({ field }) => (
                    <Input
                      ref={field.ref}
                      label="Emoji"
                      value={field.value}
                      onChangeText={field.onChange}
                      error={errors.ingredients?.[index]?.emoji?.message}
                    />
                  )}
                />
              </View>
              <View className="flex-1">
                <Controller
                  control={control}
                  name={`ingredients.${index}.canonicalName`}
                  render={({ field }) => (
                    <Input
                      label="Canonical name"
                      value={field.value}
                      onChangeText={field.onChange}
                    />
                  )}
                />
              </View>
            </View>
            <View className="flex-row gap-2">
              <View className="flex-1">
                <Controller
                  control={control}
                  name={`ingredients.${index}.quantity`}
                  render={({ field }) => (
                    <Input
                      label="Quantity"
                      value={field.value}
                      onChangeText={field.onChange}
                      keyboardType="decimal-pad"
                    />
                  )}
                />
              </View>
              <View className="flex-1">
                <Controller
                  control={control}
                  name={`ingredients.${index}.unit`}
                  render={({ field }) => (
                    <Input
                      label="Unit"
                      value={field.value}
                      onChangeText={field.onChange}
                    />
                  )}
                />
              </View>
            </View>
            <Controller
              control={control}
              name={`ingredients.${index}.preparation`}
              render={({ field }) => (
                <Input
                  label="Preparation"
                  value={field.value}
                  onChangeText={field.onChange}
                />
              )}
            />
            <Controller
              control={control}
              name={`ingredients.${index}.category`}
              render={({ field }) => (
                <Input
                  label="Shopping category"
                  value={field.value}
                  onChangeText={field.onChange}
                />
              )}
            />
            <Controller
              control={control}
              name={`ingredients.${index}.colorToken`}
              render={({ field }) => (
                <View>
                  <Text variant="caption" className="pb-2">
                    Color token
                  </Text>
                  <View className="flex-row flex-wrap gap-2">
                    {COLOR_TOKENS.map((token) => (
                      <Chip
                        key={token}
                        label={token}
                        selected={field.value === token}
                        accessibilityLabel={`Color token ${token}`}
                        onPress={() => field.onChange(token)}
                        style={{
                          backgroundColor:
                            field.value === token
                              ? colors.espresso
                              : colors[token],
                        }}
                      />
                    ))}
                  </View>
                </View>
              )}
            />
            <Controller
              control={control}
              name={`ingredients.${index}.optional`}
              render={({ field }) => (
                <Chip
                  label="Optional ingredient"
                  selected={field.value}
                  onPress={() => field.onChange(!field.value)}
                />
              )}
            />
          </EditorBlock>
        ))}
        <Button
          label="Add ingredient"
          variant="ghost"
          onPress={() => ingredients.append(EMPTY_INGREDIENT)}
        />
        {errors.ingredients?.message ? (
          <Text accessibilityRole="alert" style={{ color: colors.chili }}>
            {errors.ingredients.message}
          </Text>
        ) : null}

        <Text variant="section" className="pb-3 pt-7">
          STEPS
        </Text>
        {steps.fields.map((item, index) => (
          <EditorBlock key={item.id} index={index}>
            <View className="flex-row items-center justify-between">
              <Text variant="kicker">STEP {index + 1}</Text>
              <MoveButtons
                label={`step ${index + 1}`}
                index={index}
                length={steps.fields.length}
                move={steps.move}
                remove={steps.remove}
              />
            </View>
            {item.confidence < 0.7 ? (
              <Text
                accessibilityLabel={`Needs a look: step ${index + 1}`}
                variant="caption"
                style={{ color: colors.chili }}
              >
                Needs a look
              </Text>
            ) : null}
            <Controller
              control={control}
              name={`steps.${index}.instruction`}
              rules={{ required: 'Instruction is required' }}
              render={({ field }) => (
                <Input
                  ref={field.ref}
                  label="Instruction"
                  value={field.value}
                  onChangeText={field.onChange}
                  multiline
                  textAlignVertical="top"
                  error={errors.steps?.[index]?.instruction?.message}
                />
              )}
            />
            <View className="flex-row gap-2">
              <View className="flex-1">
                <Controller
                  control={control}
                  name={`steps.${index}.durationMinutes`}
                  render={({ field }) => (
                    <Input
                      label="Minutes"
                      value={field.value}
                      onChangeText={field.onChange}
                      keyboardType="number-pad"
                    />
                  )}
                />
              </View>
              <View className="flex-1">
                <Controller
                  control={control}
                  name={`steps.${index}.temperature`}
                  render={({ field }) => (
                    <Input
                      label="Temperature"
                      value={field.value}
                      onChangeText={field.onChange}
                    />
                  )}
                />
              </View>
            </View>
            <Controller
              control={control}
              name={`steps.${index}.stage`}
              render={({ field }) => (
                <Input
                  label="Stage"
                  value={field.value}
                  onChangeText={field.onChange}
                />
              )}
            />
          </EditorBlock>
        ))}
        <Button
          label="Add step"
          variant="ghost"
          onPress={() => steps.append(EMPTY_STEP)}
        />
        {errors.steps?.message ? (
          <Text accessibilityRole="alert" style={{ color: colors.chili }}>
            {errors.steps.message}
          </Text>
        ) : null}
      </ScrollView>
      <View
        className="border-t border-crust bg-bg px-5 pt-3"
        style={{
          paddingBottom: Math.max(insets.bottom, 16),
        }}
      >
        {conflict ? (
          <ConflictPanel
            draft={getValues()}
            conflict={conflict}
            onKeep={keepDraftAgainstLatest}
            onReload={reloadLatestIntoForm}
            onRetry={() => {
              void loadLatestRecipe();
            }}
          />
        ) : submitError ? (
          <View
            className="mb-3 rounded-[15px] p-4"
            style={{ backgroundColor: colors.chili50 }}
          >
            <Text
              accessibilityRole="alert"
              accessibilityLiveRegion="assertive"
              style={{ color: colors.chili }}
            >
              {submitError}
            </Text>
          </View>
        ) : null}
        <Button
          label={saveLabel(status)}
          size="lg"
          accessibilityState={{ busy: status === 'saving' }}
          accessibilityHint="Saves a new revision. Unsaved drafts stay on this device if saving fails."
          disabled={
            status === 'saving' || selectedCategories.length === 0 || !!conflict
          }
          onPress={submit}
        />
      </View>
      <ConfirmSheet
        visible={discardOpen}
        title={discardCopy().title}
        message={discardCopy().message}
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        destructive
        onClose={() => {
          pendingDiscard.current = null;
          setDiscardOpen(false);
        }}
        onConfirm={() => {
          const next = pendingDiscard.current;
          pendingDiscard.current = null;
          setDiscardOpen(false);
          next?.();
        }}
      />
    </KeyboardAvoidingView>
  );
}
