import { render, screen } from '@testing-library/react-native';

import {
  DiscoverCompassIcon,
  GroceriesBasketIcon,
  MealPlanCalendarIcon,
  ProfilePersonIcon,
  RecipesBookmarkIcon,
} from '@/components/icons/recime-tab-icons';

describe('ReciMe tab icons', () => {
  test('renders an outline glyph for each destination', async () => {
    await render(
      <>
        <RecipesBookmarkIcon active />
        <MealPlanCalendarIcon />
        <GroceriesBasketIcon />
        <DiscoverCompassIcon />
        <ProfilePersonIcon />
      </>,
    );

    expect(
      screen.getByTestId('recime-tab-recipes', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
    expect(
      screen.getByTestId('recime-tab-plan', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
    expect(
      screen.getByTestId('recime-tab-groceries', {
        includeHiddenElements: true,
      }),
    ).toBeOnTheScreen();
    expect(
      screen.getByTestId('recime-tab-discover', {
        includeHiddenElements: true,
      }),
    ).toBeOnTheScreen();
    expect(
      screen.getByTestId('recime-tab-profile', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
  });
});
