import { render, screen } from '@testing-library/react-native';

import { Text, toneColors } from '@/components/ui/text';
import { colors } from '@/theme/tokens';

describe('Text', () => {
  test('default body uses ink on canvas contrast', async () => {
    await render(<Text>Evening</Text>);

    expect(screen.getByText('Evening')).toHaveStyle({
      color: colors.ink,
    });
    expect(colors.ink).toBe('#1d1d1f');
    expect(colors.canvas).toBe('#ffffff');
  });

  test('inverse tone uses on-dark against tile-1', async () => {
    await render(<Text tone="inverse">Resume</Text>);

    expect(screen.getByText('Resume')).toHaveStyle({
      color: toneColors.inverse,
    });
    expect(toneColors.inverse).toBe(colors.onDark);
    expect(colors.tile1).toBe('#272729');
    expect(colors.onDark).toBe('#ffffff');
  });

  test('kicker defaults to muted ink, not a second accent', async () => {
    await render(<Text variant="kicker">MISE</Text>);

    expect(screen.getByText('MISE')).toHaveStyle({
      color: colors.inkMuted48,
    });
  });

  test('caller style color wins over tone', async () => {
    await render(
      <Text tone="inverse" style={{ color: colors.ink }}>
        Check
      </Text>,
    );

    expect(screen.getByText('Check')).toHaveStyle({
      color: colors.ink,
    });
  });

  test('primary tone is Action Blue', async () => {
    await render(<Text tone="primary">Learn more</Text>);

    expect(screen.getByText('Learn more')).toHaveStyle({
      color: colors.primary,
    });
    expect(colors.primary).toBe('#0066cc');
  });
});
