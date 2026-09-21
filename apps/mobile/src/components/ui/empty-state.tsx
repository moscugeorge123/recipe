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
      className="rounded-[24px] bg-linen px-5 py-6"
    >
      <Text variant="body" className={actionLabel ? 'pb-4' : undefined}>
        {title}
      </Text>
      {actionLabel && onAction ? (
        <Button label={actionLabel} size="md" onPress={onAction} />
      ) : null}
    </View>
  );
}
