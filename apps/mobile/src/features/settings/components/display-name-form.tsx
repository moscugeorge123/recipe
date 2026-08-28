import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import {
  displayNameSchema,
  type DisplayNameFormValues,
} from '@/features/settings/schemas';
import { usePreferencesStore } from '@/stores/preferences-store';

export function DisplayNameForm() {
  const displayName = usePreferencesStore((state) => state.displayName);
  const setDisplayName = usePreferencesStore((state) => state.setDisplayName);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitSuccessful },
  } = useForm<DisplayNameFormValues>({
    resolver: zodResolver(displayNameSchema),
    defaultValues: { displayName },
  });

  const onSubmit = (values: DisplayNameFormValues) => {
    setDisplayName(values.displayName);
  };

  return (
    <Card>
      <Text variant="title" className="mb-3 text-lg">
        Display name
      </Text>
      <Controller
        control={control}
        name="displayName"
        render={({ field: { onChange, onBlur, value } }) => (
          <Input
            label="Name"
            value={value}
            onBlur={onBlur}
            onChangeText={onChange}
            error={errors.displayName?.message}
            autoCapitalize="words"
            autoCorrect={false}
          />
        )}
      />
      <View className="mt-4">
        <Button label="Save" onPress={handleSubmit(onSubmit)} />
      </View>
      {isSubmitSuccessful ? (
        <Text className="mt-3 text-sm" tone="secondary">
          Name updated.
        </Text>
      ) : null}
    </Card>
  );
}
