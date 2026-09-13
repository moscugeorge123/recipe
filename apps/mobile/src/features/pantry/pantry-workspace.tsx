import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { TextInput } from '@/components/ui/text-input';
import { Chip } from '@/components/ui/chip';
import { ContentSkeleton } from '@/components/ui/content-skeleton';
import { EmptyStatePanel } from '@/components/ui/empty-state';
import { InlineErrorPanel } from '@/components/ui/inline-error';
import { MotionItem } from '@/components/ui/motion-item';
import { StaleIndicator } from '@/components/ui/stale-indicator';
import { Text } from '@/components/ui/text';
import type {
  GroceryCategory,
  OrganizedPantryItem,
  PantryItemView,
  UnresolvedPantryLine,
} from '@/features/pantry/types';
import { formatGroceryQty, groupByAisle } from '@/features/shopping-list/aisle';
import { colors, fonts } from '@/theme/tokens';

const CATEGORIES: (GroceryCategory | 'All')[] = [
  'All',
  'Produce',
  'Meat',
  'Dairy',
  'Pantry',
  'Spices',
  'Frozen',
];

function tokenColor(token: string | null | undefined): string {
  if (token && token in colors) {
    return colors[token as keyof typeof colors];
  }
  return colors.peach;
}

export function PantryWorkspace({
  draftText,
  onChangeDraft,
  onOrganize,
  organizing,
  preview,
  unresolved,
  onChangePreviewItem,
  onAccept,
  accepting,
  onRetryUnresolved,
  retrying,
  saved,
  category,
  onChangeCategory,
  onDeleteSaved,
  onRenameSaved,
  reducedMotion,
  savedLoading = false,
  savedError = false,
  savedFromCache = false,
  onRetrySaved,
  organizeError = null,
  onRetryOrganize,
  showComposer = true,
}: {
  draftText: string;
  onChangeDraft: (value: string) => void;
  onOrganize: () => void;
  organizing: boolean;
  preview: OrganizedPantryItem[];
  unresolved: UnresolvedPantryLine[];
  onChangePreviewItem: (
    index: number,
    patch: Partial<OrganizedPantryItem>,
  ) => void;
  onAccept: () => void;
  accepting: boolean;
  onRetryUnresolved: () => void;
  retrying: boolean;
  saved: PantryItemView[];
  category: GroceryCategory | 'All';
  onChangeCategory: (value: GroceryCategory | 'All') => void;
  onDeleteSaved: (id: string) => void;
  onRenameSaved: (id: string, name: string) => void;
  reducedMotion: boolean;
  savedLoading?: boolean;
  savedError?: boolean;
  savedFromCache?: boolean;
  onRetrySaved?: () => void;
  organizeError?: string | null;
  onRetryOrganize?: () => void;
  showComposer?: boolean;
}) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingSavedId, setEditingSavedId] = useState<string | null>(null);
  const [savedName, setSavedName] = useState('');
  const retryable = unresolved.filter((item) => item.retryable);
  const aisleGroups = groupByAisle(saved);

  return (
    <View className="gap-5">
      {showComposer ? (
        <View>
          <Text variant="caption" className="pb-2">
            Type or paste ingredients — one per line or separated by commas.
          </Text>
          <TextInput
            accessibilityLabel="Pantry ingredients"
            multiline
            value={draftText}
            onChangeText={onChangeDraft}
            placeholder={'olive oil\n2 tomatoes, salt'}
            placeholderTextColor={colors.olive}
            className="min-h-[140px] rounded-[16px] border border-crust bg-peach px-4 py-3 text-[15.5px]"
            style={{
              fontFamily: fonts.manrope600,
              color: colors.espresso,
              textAlignVertical: 'top',
            }}
          />
          <Button
            label={organizing ? 'Organizing…' : 'Organize'}
            className="mt-3"
            disabled={!draftText.trim() || organizing}
            onPress={onOrganize}
          />
          {organizeError ? (
            <View className="mt-3">
              <InlineErrorPanel
                message={organizeError}
                retryLabel="Retry"
                retrying={organizing}
                onRetry={onRetryOrganize}
              />
            </View>
          ) : null}
        </View>
      ) : null}

      {preview.length ? (
        <View>
          <Text variant="section">PREVIEW</Text>
          <Text variant="caption" className="pb-2 pt-1">
            Check names and categories, then save. Your original text stays
            until you accept.
          </Text>
          {preview.map((item, index) => (
            <MotionItem
              key={`${item.rawText}-${index}`}
              preset="pantry"
              index={index}
              reduced={reducedMotion}
              className="mb-2 rounded-[16px] border border-crust p-3"
              style={{ backgroundColor: tokenColor(item.colorToken) }}
            >
              <View className="flex-row items-center gap-3">
                <Text
                  accessibilityLabel={`${item.emoji} ${item.name}`}
                  className="text-[22px]"
                >
                  {item.emoji}
                </Text>
                <View className="flex-1">
                  {editingIndex === index ? (
                    <TextInput
                      accessibilityLabel={`Corrected name for ${item.rawText}`}
                      value={item.name}
                      onChangeText={(name) =>
                        onChangePreviewItem(index, { name })
                      }
                      className="min-h-11 text-[15.5px]"
                      style={{
                        fontFamily: fonts.manrope700,
                        color: colors.espresso,
                      }}
                    />
                  ) : (
                    <Text style={{ fontFamily: fonts.manrope700 }}>
                      {item.name}
                    </Text>
                  )}
                  <Text variant="caption">
                    {item.category} · from “{item.rawText}”
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    editingIndex === index
                      ? `Done editing ${item.name}`
                      : `Edit ${item.name}`
                  }
                  onPress={() =>
                    setEditingIndex((current) =>
                      current === index ? null : index,
                    )
                  }
                  className="h-11 justify-center"
                >
                  <Text tone="primary">
                    {editingIndex === index ? 'Done' : 'Edit'}
                  </Text>
                </Pressable>
              </View>
            </MotionItem>
          ))}
          {retryable.length ? (
            <View
              className="mt-2 rounded-[16px] p-3"
              style={{ backgroundColor: colors.honey50 }}
            >
              <Text className="text-[14px]">
                {retryable.length} line{retryable.length === 1 ? '' : 's'} still
                need a closer look. You can save these as-is or retry just those
                lines.
              </Text>
              <Button
                label={
                  retrying
                    ? 'Retrying…'
                    : `Retry ${retryable.length} line${retryable.length === 1 ? '' : 's'}`
                }
                variant="ghost"
                className="mt-2"
                disabled={retrying}
                onPress={onRetryUnresolved}
              />
            </View>
          ) : null}
          <Button
            label={accepting ? 'Saving…' : 'Accept and save'}
            className="mt-3"
            disabled={accepting}
            onPress={onAccept}
          />
        </View>
      ) : null}

      <View>
        <Text variant="section">IN YOUR PANTRY</Text>
        <View className="flex-row flex-wrap gap-2 py-3">
          {CATEGORIES.map((item) => (
            <Chip
              key={item}
              label={item}
              selected={category === item}
              onPress={() => onChangeCategory(item)}
            />
          ))}
        </View>
        {savedFromCache ? (
          <StaleIndicator
            className="pb-2"
            message="Showing last saved pantry. Retry to refresh."
          />
        ) : null}
        {savedError ? (
          <View className="pb-2">
            <InlineErrorPanel
              message={
                saved.length
                  ? 'Couldn’t refresh your pantry. Showing what we have.'
                  : 'Couldn’t load your pantry. Your list below is still editable.'
              }
              retryLabel="Retry"
              onRetry={onRetrySaved}
            />
          </View>
        ) : null}
        {savedLoading && saved.length === 0 && !savedError ? (
          <ContentSkeleton shape="list" />
        ) : saved.length === 0 && !savedError ? (
          <EmptyStatePanel title="Nothing saved yet. Organize a list and accept it." />
        ) : (
          aisleGroups.map((group) => (
            <View key={group.category} className="pt-1">
              <Text variant="section" className="pb-1 pt-3">
                {group.label.toUpperCase()}
              </Text>
              {group.items.map((item, index) => {
                const qty = formatGroceryQty(item.quantity, item.unit);
                return (
                  <MotionItem
                    key={item.id}
                    preset="pantry"
                    index={index}
                    reduced={reducedMotion}
                    className="min-h-11 flex-row items-center gap-3 border-b border-crust py-3"
                  >
                    <Text
                      accessibilityLabel={`${item.emoji ?? '🥣'} ${item.name}`}
                      className="w-8 text-center text-[22px]"
                    >
                      {item.emoji ?? '🥣'}
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Edit ${item.name}`}
                      onPress={() => {
                        setEditingSavedId(item.id);
                        setSavedName(item.name);
                      }}
                      className="min-h-11 flex-1 justify-center"
                    >
                      {editingSavedId === item.id ? (
                        <TextInput
                          accessibilityLabel={`Rename ${item.name}`}
                          value={savedName}
                          onChangeText={setSavedName}
                          onEndEditing={() => {
                            const trimmed = savedName.trim();
                            if (trimmed && trimmed !== item.name) {
                              onRenameSaved(item.id, trimmed);
                            }
                            setEditingSavedId(null);
                          }}
                          className="min-h-11 text-[15.5px]"
                          style={{
                            fontFamily: fonts.manrope700,
                            color: colors.espresso,
                          }}
                        />
                      ) : (
                        <Text
                          style={{
                            fontFamily: fonts.manrope600,
                            color: colors.espresso,
                          }}
                        >
                          {item.name}
                        </Text>
                      )}
                    </Pressable>
                    {qty ? (
                      <Text
                        variant="caption"
                        style={{ fontFamily: fonts.manrope600 }}
                      >
                        {qty}
                      </Text>
                    ) : null}
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Delete ${item.name}`}
                      onPress={() => onDeleteSaved(item.id)}
                      className="h-11 justify-center"
                    >
                      <Text style={{ color: colors.chili }}>Delete</Text>
                    </Pressable>
                  </MotionItem>
                );
              })}
            </View>
          ))
        )}
      </View>
    </View>
  );
}
