import Svg, { Path } from 'react-native-svg';

import { colors } from '@/theme/tokens';

type ChevronLeftProps = {
  size?: number;
  color?: string;
};

export function ChevronLeft({
  size = 22,
  color = colors.charcoal,
}: ChevronLeftProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      accessibilityElementsHidden
      importantForAccessibility="no"
    >
      <Path
        d="M15 18l-6-6 6-6"
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
