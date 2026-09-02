import { render, screen } from '@testing-library/react-native';

import { Chip } from '@/components/ui/chip';
import { colors } from '@/theme/tokens';

describe('Chip', () => {
  test('unselected uses canvas fill and hairline', async () => {
    await render(<Chip label="Comfort" />);

    expect(screen.getByRole('button', { name: 'Comfort' })).toHaveStyle({
      backgroundColor: colors.canvas,
      borderColor: colors.hairline,
    });
    expect(screen.getByText('Comfort')).toHaveStyle({
      color: colors.ink,
    });
  });

  test('selected uses a 2px Action Blue focus ring', async () => {
    await render(<Chip label="Comfort" selected />);

    expect(screen.getByRole('button', { name: 'Comfort' })).toHaveStyle({
      backgroundColor: colors.canvas,
      borderColor: colors.primaryFocus,
      borderWidth: 2,
    });
    expect(screen.getByText('Comfort')).toHaveStyle({
      color: colors.ink,
    });
  });
});
