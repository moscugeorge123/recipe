import AsyncStorage from '@react-native-async-storage/async-storage';

import { mondayOfWeek } from '@/features/meal-plan/types';
import { localTodayIso } from '@/features/meal-plan/week';
import { useMealPlanWeekStore } from '@/stores/meal-plan-week-store';

describe('useMealPlanWeekStore', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    useMealPlanWeekStore.getState().reset();
  });

  test('persists a Monday week start', () => {
    expect(useMealPlanWeekStore.getState().weekStart).toBe(
      mondayOfWeek(localTodayIso()),
    );

    useMealPlanWeekStore.getState().setWeekStart('2026-09-12');
    expect(useMealPlanWeekStore.getState().weekStart).toBe('2026-09-07');

    useMealPlanWeekStore.getState().shiftWeek(1);
    expect(useMealPlanWeekStore.getState().weekStart).toBe('2026-09-14');
  });
});
