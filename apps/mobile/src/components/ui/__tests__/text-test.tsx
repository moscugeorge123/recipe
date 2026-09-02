import { render, screen } from '@testing-library/react-native';

import { Text, toneColors } from '@/components/ui/text';
import { colors } from '@/theme/tokens';

describe('Text', () => {
  test('default body uses ink', async () => {
    await render(<Text>Evening</Text>);

    expect(screen.getByText('Evening')).toHaveStyle({
      color: colors.ink,
    });
  });

  test('inverse tone uses on-dark even on the default variant', async () => {
    await render(<Text tone="inverse">Resume</Text>);

    expect(screen.getByText('Resume')).toHaveStyle({
      color: toneColors.inverse,
    });
  });

  test('kicker defaults to mute', async () => {
    await render(<Text variant="kicker">MISE</Text>);

    expect(screen.getByText('MISE')).toHaveStyle({
      color: colors.mute,
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
});
