import { Pressable, View } from 'react-native';

import {
  AddCookbookRecipeIcon,
  DeleteCookbookIcon,
  RenameCookbookIcon,
} from '@/components/icons/cookbook-action-icons';
import { Sheet } from '@/components/ui/sheet';
import { Text } from '@/components/ui/text';
import { colors } from '@/theme/tokens';

type CookbookOptionsSheetProps = {
  visible: boolean;
  collectionName: string;
  onClose: () => void;
  onRename: () => void;
  onAddRecipe: () => void;
  onDelete: () => void;
  showAddRecipe?: boolean;
};

export function CookbookOptionsSheet({
  visible,
  collectionName,
  onClose,
  onRename,
  onAddRecipe,
  onDelete,
  showAddRecipe = true,
}: CookbookOptionsSheetProps) {
  return (
    <Sheet visible={visible} onClose={onClose} accessibilityLabel="Options">
      <Text variant="title" className="pb-3">
        Options
      </Text>
      <View className="gap-2.5">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Rename ${collectionName}`}
          onPress={onRename}
          className="min-h-14 flex-row items-center gap-3 rounded-full px-4"
          style={{ backgroundColor: colors.searchFill }}
        >
          <RenameCookbookIcon color={colors.espresso} />
          <Text tone="icon">Rename</Text>
        </Pressable>
        {showAddRecipe ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add recipe"
            onPress={onAddRecipe}
            className="min-h-14 flex-row items-center gap-3 rounded-full px-4"
            style={{ backgroundColor: colors.searchFill }}
          >
            <AddCookbookRecipeIcon color={colors.espresso} />
            <Text tone="icon">Add recipe</Text>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Delete ${collectionName}`}
          onPress={onDelete}
          className="min-h-14 flex-row items-center gap-3 rounded-full px-4"
          style={{ backgroundColor: colors.searchFill }}
        >
          <DeleteCookbookIcon color={colors.chili} />
          <Text style={{ color: colors.chili }}>Delete</Text>
        </Pressable>
      </View>
    </Sheet>
  );
}
