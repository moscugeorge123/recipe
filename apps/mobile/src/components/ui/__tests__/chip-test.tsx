import { render, screen } from '@testing-library/react-native';

import { Chip } from '@/components/ui/chip';
import { colors } from '@/theme/tokens';

describe('Chip', () => {
  test('unselected uses soft surface fill and ink label', async () => {
    await render(<Chip label="Comfort" />);

    expect(screen.getByRole('button', { name: 'Comfort' })).toHaveStyle({
      backgroundColor: colors.surfaceSoft,
    });
    expect(screen.getByText('Comfort')).toHaveStyle({
      color: colors.ink,
    });
  });

  test('selected uses black fill and on-dark label', async () => {
    await render(<Chip label="Comfort" selected />);

    expect(screen.getByRole('button', { name: 'Comfort' })).toHaveStyle({
      backgroundColor: colors.canvasDark,
    });
    expect(screen.getByText('Comfort')).toHaveStyle({
      color: colors.onDark,
    });
  });
});
