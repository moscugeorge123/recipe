import { render, screen } from '@testing-library/react-native';

import {
  CaptureTomato,
  ExploreFoodIcon,
  HomeFoodIcon,
  KitchenFoodIcon,
  YouFoodIcon,
} from '@/components/icons/food-tab-icons';

describe('food tab icons', () => {
  test('renders a food glyph for each tab label', async () => {
    await render(
      <>
        <HomeFoodIcon />
        <ExploreFoodIcon />
        <KitchenFoodIcon />
        <YouFoodIcon />
        <CaptureTomato />
      </>,
    );

    expect(
      screen.getByTestId('food-tab-home', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
    expect(
      screen.getByTestId('food-tab-explore', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
    expect(
      screen.getByTestId('food-tab-kitchen', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
    expect(
      screen.getByTestId('food-tab-you', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
    expect(
      screen.getByTestId('food-tab-capture', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
  });
});
