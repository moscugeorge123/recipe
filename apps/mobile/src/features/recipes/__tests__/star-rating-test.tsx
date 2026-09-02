import { screen, userEvent } from '@testing-library/react-native';
import { useState } from 'react';

import { StarRatingInput } from '@/features/recipes/components/star-rating';
import { renderWithProviders } from '@/test/render-with-providers';

function Harness() {
  const [rating, setRating] = useState<number | null>(null);
  return (
    <StarRatingInput
      rating={rating}
      onChange={(value) =>
        setRating((current) => (current === value ? null : value))
      }
    />
  );
}

describe('StarRatingInput', () => {
  test('exposes screen-reader labels and clears when the active star is tapped again', async () => {
    const user = userEvent.setup();
    await renderWithProviders(<Harness />);

    expect(screen.getByLabelText('Your rating, not set')).toBeOnTheScreen();
    await user.press(screen.getByLabelText('Rate 4 stars'));
    expect(
      screen.getByLabelText('Your rating, 4 of 5 stars'),
    ).toBeOnTheScreen();
    expect(
      screen.getByLabelText('4 stars. Double tap to clear rating'),
    ).toBeOnTheScreen();

    await user.press(
      screen.getByLabelText('4 stars. Double tap to clear rating'),
    );
    expect(screen.getByLabelText('Your rating, not set')).toBeOnTheScreen();
  });
});
