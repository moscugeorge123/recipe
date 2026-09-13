import { render, screen } from '@testing-library/react-native';

import { IconButton } from '@/components/ui/icon-button';
import { Text } from '@/components/ui/text';
import { colors } from '@/theme/tokens';

describe('IconButton', () => {
  test('is a round paper disc', async () => {
    await render(
      <IconButton accessibilityLabel="Back">
        <Text>‹</Text>
      </IconButton>,
    );

    const button = screen.getByRole('button', { name: 'Back' });
    expect(button).toHaveStyle({ backgroundColor: colors.paper });
    expect(button.props.className).toContain('rounded-full');
  });
});
