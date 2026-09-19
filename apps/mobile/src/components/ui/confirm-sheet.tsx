import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Sheet } from '@/components/ui/sheet';
import { Text } from '@/components/ui/text';

export type ConfirmSheetProps = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  pending?: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

export function ConfirmSheet({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Keep',
  destructive = false,
  pending = false,
  onConfirm,
  onClose,
}: ConfirmSheetProps) {
  return (
    <Sheet visible={visible} onClose={onClose} accessibilityLabel={title}>
      <Text variant="title" className="pb-2">
        {title}
      </Text>
      <Text variant="caption" className="pb-5">
        {message}
      </Text>
      <View className="flex-row gap-2.5">
        <Button
          label={cancelLabel}
          variant="ghost"
          className="flex-1"
          disabled={pending}
          onPress={onClose}
        />
        <Button
          label={pending ? 'Working…' : confirmLabel}
          variant={destructive ? 'destructive' : 'inverse'}
          className="flex-[1.4]"
          disabled={pending}
          onPress={onConfirm}
        />
      </View>
    </Sheet>
  );
}
