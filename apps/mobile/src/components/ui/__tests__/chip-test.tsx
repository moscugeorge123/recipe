import { render, screen } from '@testing-library/react-native';

import { Chip } from '@/components/ui/chip';
import { colors } from '@/theme/tokens';

describe('Chip', () => {
  test('unselected uses muted label without espresso fill', async () => {
    await render(<Chip label="Comfort" />);

    expect(screen.getByRole('button', { name: 'Comfort' })).toHaveStyle({
      backgroundColor: 'transparent',
    });
    expect(screen.getByText('Comfort')).toHaveStyle({
      color: colors.olive,
    });
  });

  test('selected uses ink label and underline', async () => {
    await render(<Chip label="Comfort" selected />);

    expect(screen.getByRole('button', { name: 'Comfort' })).toHaveStyle({
      backgroundColor: 'transparent',
      borderBottomColor: colors.espresso,
    });
    expect(screen.getByText('Comfort')).toHaveStyle({
      color: colors.espresso,
    });
  });
});
