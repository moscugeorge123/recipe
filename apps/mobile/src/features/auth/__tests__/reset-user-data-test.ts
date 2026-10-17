import AsyncStorage from '@react-native-async-storage/async-storage';

import { resetUserData } from '@/features/auth/reset-user-data';
import { queryClient } from '@/lib/query-client';
import { useKitchenStore } from '@/stores/kitchen-store';
import { useTortiePrefs } from '@/tortie/prefs-store';

describe('resetUserData', () => {
  test('clears account data but keeps device preferences', async () => {
    useKitchenStore.setState({ savedIds: ['r1'], wantIds: ['r2'] });
    useTortiePrefs.getState().set({ defaultServings: 6 });
    queryClient.setQueryData(['recipes'], [{ id: 'r1' }]);
    await AsyncStorage.setItem('mise.query.v1:["recipes"]', '[]');
    await AsyncStorage.setItem('mise.note-draft.v1.r1', 'note');
    await AsyncStorage.setItem('mise.kitchen.migration.v1', '{}');
    await AsyncStorage.setItem('unrelated.key', 'keep');

    await resetUserData();

    expect(useKitchenStore.getState().savedIds).toEqual([]);
    expect(useKitchenStore.getState().wantIds).toEqual([]);
    expect(queryClient.getQueryData(['recipes'])).toBeUndefined();
    expect(await AsyncStorage.getItem('mise.query.v1:["recipes"]')).toBeNull();
    expect(await AsyncStorage.getItem('mise.note-draft.v1.r1')).toBeNull();
    expect(await AsyncStorage.getItem('mise.kitchen.migration.v1')).toBeNull();
    expect(await AsyncStorage.getItem('unrelated.key')).toBe('keep');
    expect(useTortiePrefs.getState().defaultServings).toBe(6);
  });
});
