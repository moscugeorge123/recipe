import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { useCatalog } from '@/features/catalog/use-catalog';
import { useKitchenMigration } from '@/features/kitchen/use-kitchen-migration';

export function KitchenSyncBanner() {
  const catalog = useCatalog();
  const { migration, retry } = useKitchenMigration();
  const failed = migration?.status === 'failed';
  const message = failed
    ? 'Some kitchen data still needs to move to your account.'
    : catalog.syncLabel;

  if (!message) {
    return null;
  }

  return (
    <View className="mx-5 mb-3 rounded-[16px] border border-crust bg-linen p-3">
      <Text variant="caption">{message}</Text>
      {failed || catalog.isApiError ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Retry kitchen sync"
          className="min-h-11 justify-center"
          onPress={() => {
            void retry();
            void catalog.refetch();
          }}
        >
          <Text tone="primary">Retry</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
