import { View } from 'react-native';

import { DiscoverCompassIcon } from '@/components/icons/recime-tab-icons';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { colors } from '@/theme/tokens';

export default function DiscoverScreen() {
  return (
    <Screen>
      <View className="flex-1 items-center justify-center px-5">
        <DiscoverCompassIcon size={28} color={colors.paprika} />
        <Text variant="display" accessibilityRole="header" className="pt-4">
          Discover
        </Text>
        <Text variant="caption" className="pt-2 text-center">
          Nothing here yet.
        </Text>
      </View>
    </Screen>
  );
}
