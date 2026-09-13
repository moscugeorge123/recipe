import { ChevronLeft as LucideChevronLeft } from 'lucide-react-native';

import { colors } from '@/theme/tokens';

type ChevronLeftProps = {
  size?: number;
  color?: string;
};

export function ChevronLeft({
  size = 22,
  color = colors.cocoa,
}: ChevronLeftProps) {
  return (
    <LucideChevronLeft
      size={size}
      color={color}
      strokeWidth={2.2}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}
