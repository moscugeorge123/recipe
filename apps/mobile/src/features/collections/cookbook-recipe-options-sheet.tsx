import { Pressable, View } from 'react-native';

import { DeleteCookbookIcon } from '@/components/icons/cookbook-action-icons';
import { Sheet } from '@/components/ui/sheet';
import { Text } from '@/components/ui/text';
import { colors } from '@/theme/tokens';

type CookbookRecipeOptionsSheetProps = {
  visible: boolean;
  recipeTitle: string;
  collectionName: string;
  onClose: () => void;
  onRemove: () => void;
};

export function CookbookRecipeOptionsSheet({
  visible,
  recipeTitle,
  collectionName,
  onClose,
  onRemove,
}: CookbookRecipeOptionsSheetProps) {
  return (
    <Sheet visible={visible} onClose={onClose} accessibilityLabel="Options">
      <Text variant="title" className="pb-3">
        Options
      </Text>
      <View className="gap-2.5">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Remove ${recipeTitle} from ${collectionName}`}
          onPress={onRemove}
          className="min-h-14 flex-row items-center gap-3 rounded-full px-4"
          style={{ backgroundColor: colors.searchFill }}
        >
          <DeleteCookbookIcon color={colors.chili} />
          <Text style={{ color: colors.chili }}>Remove</Text>
        </Pressable>
      </View>
    </Sheet>
  );
}
