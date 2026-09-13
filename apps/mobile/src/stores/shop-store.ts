import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { ShopState } from '@/stores/contracts';

/**
 * @deprecated Groceries persist via `/shopping-list`. Kept so old
 * `mise.shop.v1` hydrations do not crash.
 */
export const useShopStore = create<ShopState>()(
  persist(
    (set) => ({
      items: [],
      shoppingMode: false,
      addIngredients: () => undefined,
      toggleDone: (id) =>
        set((state) => ({
          items: state.items.map((item) =>
            item.id === id ? { ...item, done: !item.done } : item,
          ),
        })),
      toggleShoppingMode: () =>
        set((state) => ({ shoppingMode: !state.shoppingMode })),
      clearDone: () =>
        set((state) => ({
          items: state.items.filter((item) => !item.done),
          shoppingMode: false,
        })),
    }),
    {
      name: 'mise.shop.v1',
      version: 2,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        items: [] as ShopState['items'],
        shoppingMode: state.shoppingMode,
      }),
      migrate: () => ({
        items: [] as ShopState['items'],
        shoppingMode: false,
      }),
      merge: (persisted, current) => ({
        ...current,
        ...(typeof persisted === 'object' && persisted ? persisted : {}),
        items: [],
      }),
    },
  ),
);
