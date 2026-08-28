import { render, screen } from '@testing-library/react-native';

import { Chip } from '@/components/ui/chip';
import { colors } from '@/theme/tokens';

describe('Chip', () => {
  test('unselected uses peach fill and cocoa label', async () => {
    await render(<Chip label="Comfort" />);

    expect(screen.getByRole('button', { name: 'Comfort' })).toHaveStyle({
      backgroundColor: colors.peach,
    });
    expect(screen.getByText('Comfort')).toHaveStyle({
      color: colors.cocoa,
    });
  });

  test('selected uses espresso fill and steamed-milk label', async () => {
    await render(<Chip label="Comfort" selected />);

    expect(screen.getByRole('button', { name: 'Comfort' })).toHaveStyle({
      backgroundColor: colors.espresso,
    });
    expect(screen.getByText('Comfort')).toHaveStyle({
      color: colors.steamedMilk,
    });
  });
});
