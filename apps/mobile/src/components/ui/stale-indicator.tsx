import { Text } from '@/components/ui/text';

type StaleIndicatorProps = {
  message?: string;
  className?: string;
};

export function StaleIndicator({
  message = 'Showing last loaded recipes. Pull to refresh.',
  className,
}: StaleIndicatorProps) {
  return (
    <Text
      variant="caption"
      accessibilityRole="text"
      accessibilityLiveRegion="polite"
      testID="stale-indicator"
      className={className}
    >
      {message}
    </Text>
  );
}
