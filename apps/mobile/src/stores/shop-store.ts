import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { ShopItem, ShopState } from '@/stores/contracts';

const defaultItems: ShopItem[] = [
  {
    id: 'shop-onions',
    name: 'Onions',
    quantity: 3,
    unit: '',
    category: 'Produce',
    fromRecipeCount: 2,
    done: false,
  },
  {
    id: 'shop-lemon',
    name: 'Lemon',
    quantity: 2,
    unit: '',
    category: 'Produce',
    fromRecipeCount: 2,
    done: false,
  },
  {
    id: 'shop-spinach',
    name: 'Spinach',
    quantity: 200,
    unit: 'g',
    category: 'Produce',
    fromRecipeCount: 1,
    done: false,
  },
  {
    id: 'shop-tomatoes',
    name: 'Cherry tomatoes',
    quantity: 300,
    unit: 'g',
    category: 'Produce',
    fromRecipeCount: 1,
    done: false,
  },
  {
    id: 'shop-chicken',
    name: 'Chicken thighs',
    quantity: 6,
    unit: '',
    category: 'Meat',
    fromRecipeCount: 1,
    done: false,
  },
  {
    id: 'shop-pecorino',
    name: 'Pecorino',
    quantity: 60,
    unit: 'g',
    category: 'Dairy',
    fromRecipeCount: 1,
    done: false,
  },
  {
    id: 'shop-butter',
    name: 'Butter',
    quantity: 40,
    unit: 'g',
    category: 'Dairy',
    fromRecipeCount: 1,
    done: false,
  },
  {
    id: 'shop-lentils',
    name: 'Red lentils',
    quantity: 250,
    unit: 'g',
    category: 'Pantry',
    fromRecipeCount: 1,
    done: false,
  },
  {
    id: 'shop-coconut',
    name: 'Coconut milk',
    quantity: 400,
    unit: 'ml',
    category: 'Pantry',
    fromRecipeCount: 1,
    done: false,
  },
  {
    id: 'shop-cumin',
    name: 'Cumin seeds',
    quantity: 2,
    unit: 'tsp',
    category: 'Spices',
    fromRecipeCount: 1,
    done: false,
  },
];

function nameKey(name: string): string {
  return name.toLowerCase().split(',')[0]?.trim() ?? name.toLowerCase();
}

export const useShopStore = create<ShopState>()(
  persist(
    (set) => ({
      items: defaultItems,
      shoppingMode: false,
      addIngredients: (ings) =>
        set((state) => {
          const items = state.items.map((item) => ({ ...item }));
          ings.forEach((ingredient) => {
            const key = nameKey(ingredient.name);
            const hit = items.find((item) => nameKey(item.name) === key);
            const qty = ingredient.quantity ?? 1;
            if (hit) {
              if (hit.unit === (ingredient.unit ?? '')) {
                hit.quantity += qty;
              }
              hit.fromRecipeCount += 1;
            } else {
              items.push({
                id: `shop-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                name: ingredient.name,
                quantity: qty,
                unit: ingredient.unit ?? '',
                category: ingredient.category,
                fromRecipeCount: 1,
                done: false,
              });
            }
          });
          return { items };
        }),
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
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
