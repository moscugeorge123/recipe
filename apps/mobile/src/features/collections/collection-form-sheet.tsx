import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet } from '@/components/ui/sheet';
import { Text } from '@/components/ui/text';

type CollectionFormSheetProps = {
  visible: boolean;
  title: string;
  submitLabel: string;
  initialName?: string;
  pending?: boolean;
  error?: string | null;
  onSubmit: (name: string) => void;
  onClose: () => void;
};

export function CollectionFormSheet({
  visible,
  title,
  submitLabel,
  initialName = '',
  pending = false,
  error,
  onSubmit,
  onClose,
}: CollectionFormSheetProps) {
  const [name, setName] = useState(initialName);
  const wasVisible = useRef(false);

  useEffect(() => {
    if (visible && !wasVisible.current) {
      setName(initialName);
    }
    wasVisible.current = visible;
  }, [initialName, visible]);

  return (
    <Sheet visible={visible} onClose={onClose} accessibilityLabel={title}>
      <Text variant="title" className="pb-4">
        {title}
      </Text>
      <Input
        label="Collection name"
        value={name}
        onChangeText={setName}
        placeholder="Appetizers"
        autoFocus={visible}
        editable={!pending}
        error={error ?? undefined}
      />
      <View className="flex-row gap-2.5 pt-5">
        <Button
          label="Cancel"
          variant="ghost"
          className="flex-1 bg-peach"
          disabled={pending}
          onPress={onClose}
        />
        <Button
          label={submitLabel}
          variant="inverse"
          className="flex-[1.4]"
          disabled={pending || !name.trim()}
          onPress={() => onSubmit(name.trim())}
        />
      </View>
    </Sheet>
  );
}
