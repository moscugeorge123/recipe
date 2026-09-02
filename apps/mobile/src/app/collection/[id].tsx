import { useLocalSearchParams } from 'expo-router';

import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { CollectionDetail } from '@/features/collections/collection-detail';

export default function CollectionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  if (!id || Array.isArray(id)) {
    return (
      <Screen>
        <Text className="px-5 pt-6">Collection not found.</Text>
      </Screen>
    );
  }

  return <CollectionDetail collectionId={id} />;
}
