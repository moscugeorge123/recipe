import { render, screen } from '@testing-library/react-native';

import { Chip } from '@/components/ui/chip';
import { colors } from '@/theme/tokens';

describe('Chip', () => {
  test('unselected uses paper fill and cocoa label', async () => {
    await render(<Chip label="Comfort" />);

    expect(screen.getByRole('button', { name: 'Comfort' })).toHaveStyle({
      backgroundColor: colors.paper,
    });
    expect(screen.getByText('Comfort')).toHaveStyle({
      color: colors.cocoa,
    });
  });

  test('selected uses cta fill and steamed-milk label', async () => {
    await render(<Chip label="Comfort" selected />);

    expect(screen.getByRole('button', { name: 'Comfort' })).toHaveStyle({
      backgroundColor: colors.cta,
    });
    expect(screen.getByText('Comfort')).toHaveStyle({
      color: colors.steamedMilk,
    });
  });
});
