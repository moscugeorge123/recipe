import { useEffect, useRef, useState } from 'react';
import { View, type TextInput as RNTextInput } from 'react-native';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet } from '@/components/ui/sheet';
import { Text } from '@/components/ui/text';
import { duration } from '@/lib/motion';

const NAME_MAX = 50;

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
  const inputRef = useRef<RNTextInput>(null);
  const trimmed = name.trim();
  const canCreate = trimmed.length > 0;

  useEffect(() => {
    if (visible && !wasVisible.current) {
      setName(initialName);
    }
    wasVisible.current = visible;
  }, [initialName, visible]);

  useEffect(() => {
    if (!visible) {
      return undefined;
    }

    // Wait for Modal + sheet enter; autoFocus alone often skips the soft keyboard.
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, duration.fast);

    return () => {
      clearTimeout(timer);
    };
  }, [visible]);

  return (
    <Sheet visible={visible} onClose={onClose} accessibilityLabel={title}>
      <Text variant="title" className="pb-4">
        {`${name.length}/${NAME_MAX}`}
      </Text>
      <Input
        ref={inputRef}
        label="Cookbook name"
        value={name}
        onChangeText={(value) => setName(value.slice(0, NAME_MAX))}
        placeholder="e.g. Weeknight Dinner"
        maxLength={NAME_MAX}
        showSoftInputOnFocus
        editable={!pending}
        error={error ?? undefined}
      />
      <View className="flex-row gap-2.5 pt-5">
        <Button
          label="Cancel"
          variant="ghost"
          className="flex-1"
          disabled={pending}
          onPress={onClose}
        />
        <Button
          label={submitLabel}
          variant="primary"
          className="flex-[1.4]"
          disabled={pending || !canCreate}
          onPress={() => onSubmit(trimmed)}
        />
      </View>
    </Sheet>
  );
}
