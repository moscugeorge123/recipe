import {
  Bookmark,
  Calendar,
  Compass,
  ShoppingBasket,
  User,
} from 'lucide-react-native';

import { colors } from '@/theme/tokens';

type TabIconProps = {
  size?: number;
  active?: boolean;
  color?: string;
};

function strokeColor({ active, color }: TabIconProps): string {
  if (color) {
    return color;
  }
  return active ? colors.paprika : colors.tabInactive;
}

/** Outline bookmark — Recipes. */
export function RecipesBookmarkIcon({
  size = 26,
  active = false,
  color,
}: TabIconProps) {
  return (
    <Bookmark
      testID="recime-tab-recipes"
      size={size}
      color={strokeColor({ active, color })}
      strokeWidth={1.75}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}

/** Outline calendar — Meal Plan. */
export function MealPlanCalendarIcon({
  size = 26,
  active = false,
  color,
}: TabIconProps) {
  return (
    <Calendar
      testID="recime-tab-plan"
      size={size}
      color={strokeColor({ active, color })}
      strokeWidth={1.75}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}

/** Outline basket — Groceries. */
export function GroceriesBasketIcon({
  size = 26,
  active = false,
  color,
}: TabIconProps) {
  return (
    <ShoppingBasket
      testID="recime-tab-groceries"
      size={size}
      color={strokeColor({ active, color })}
      strokeWidth={1.75}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}

/** Outline compass — Discover. */
export function DiscoverCompassIcon({
  size = 26,
  active = false,
  color,
}: TabIconProps) {
  return (
    <Compass
      testID="recime-tab-discover"
      size={size}
      color={strokeColor({ active, color })}
      strokeWidth={1.75}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}

/** Outline person — Profile. */
export function ProfilePersonIcon({
  size = 26,
  active = false,
  color,
}: TabIconProps) {
  return (
    <User
      testID="recime-tab-profile"
      size={size}
      color={strokeColor({ active, color })}
      strokeWidth={1.75}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}
