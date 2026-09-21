import { useEffect, useRef } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { focusRecoveryTarget } from '@/lib/recovery-focus';

type InlineErrorPanelProps = {
  message: string;
  retryLabel?: string;
  onRetry?: () => void;
  retrying?: boolean;
  testID?: string;
};

export function InlineErrorPanel({
  message,
  retryLabel = 'Retry',
  onRetry,
  retrying = false,
  testID = 'inline-error',
}: InlineErrorPanelProps) {
  const target = useRef<View>(null);

  useEffect(() => {
    focusRecoveryTarget(target.current, message);
  }, [message]);

  return (
    <View
      ref={target}
      testID={testID}
      accessible
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
      className="rounded-[24px] bg-linen px-5 py-6"
    >
      <Text variant="caption" className="pb-3">
        {message}
      </Text>
      {onRetry ? (
        <Button
          label={retrying ? 'Retrying…' : retryLabel}
          size="md"
          disabled={retrying}
          onPress={onRetry}
        />
      ) : null}
    </View>
  );
}
