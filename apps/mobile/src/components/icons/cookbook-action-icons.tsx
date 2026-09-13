import { Pencil, Plus, Trash } from 'lucide-react-native';

import { colors } from '@/theme/tokens';

type ActionIconProps = {
  size?: number;
  color?: string;
};

/** Pencil — rename cookbook. */
export function RenameCookbookIcon({
  size = 20,
  color = colors.espresso,
}: ActionIconProps) {
  return (
    <Pencil
      size={size}
      color={color}
      strokeWidth={1.75}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}

/** Plus — add recipe to cookbook. */
export function AddCookbookRecipeIcon({
  size = 20,
  color = colors.espresso,
}: ActionIconProps) {
  return (
    <Plus
      size={size}
      color={color}
      strokeWidth={1.75}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}

/** Trash — delete cookbook. */
export function DeleteCookbookIcon({
  size = 20,
  color = colors.chili,
}: ActionIconProps) {
  return (
    <Trash
      size={size}
      color={color}
      strokeWidth={1.75}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}
