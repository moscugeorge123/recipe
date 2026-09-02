import { render, screen } from '@testing-library/react-native';

import { PressScale } from '@/components/ui/press-scale';
import { Text } from '@/components/ui/text';
import { PRESS_SCALE } from '@/lib/motion';

describe('motion a11y', () => {
  test('press scale is the Apple 0.95 micro-interaction', () => {
    expect(PRESS_SCALE).toBe(0.95);
  });

  test('PressScale still exposes the child label', async () => {
    await render(
      <PressScale accessibilityRole="button" accessibilityLabel="Cook">
        <Text>Cook</Text>
      </PressScale>,
    );

    expect(screen.getByRole('button', { name: 'Cook' })).toBeOnTheScreen();
  });
});
