import Animated from 'react-native-reanimated';

import { Text, type TextTone } from '@/components/ui/text';
import { useValueCrossfade } from '@/lib/motion';
import { fonts } from '@/theme/tokens';

type CrossfadeTextProps = {
  value: string;
  className?: string;
  tone?: TextTone;
  testID?: string;
  accessibilityLabel?: string;
};

export function CrossfadeText({
  value,
  className,
  tone,
  testID,
  accessibilityLabel,
}: CrossfadeTextProps) {
  const { style } = useValueCrossfade(value);

  return (
    <Animated.View style={style}>
      <Text
        className={className}
        tone={tone}
        testID={testID}
        accessibilityLabel={accessibilityLabel}
        style={{ fontFamily: fonts.manrope700 }}
      >
        {value}
      </Text>
    </Animated.View>
  );
}
