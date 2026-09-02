import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';

type EmptyStatePanelProps = {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  testID?: string;
};

export function EmptyStatePanel({
  title,
  actionLabel,
  onAction,
  testID = 'empty-state',
}: EmptyStatePanelProps) {
  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="summary"
      className="rounded-[20px] border border-crust bg-linen p-[18px]"
    >
      <Text variant="caption" className={actionLabel ? 'pb-3' : undefined}>
        {title}
      </Text>
      {actionLabel && onAction ? (
        <Button label={actionLabel} size="md" onPress={onAction} />
      ) : null}
    </View>
  );
}
