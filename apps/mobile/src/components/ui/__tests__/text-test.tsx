import { render, screen } from '@testing-library/react-native';

import { Text, toneColors } from '@/components/ui/text';
import { colors, fonts } from '@/theme/tokens';

describe('Text', () => {
  test('default body uses espresso', async () => {
    await render(<Text>Evening</Text>);

    expect(screen.getByText('Evening')).toHaveStyle({
      color: colors.espresso,
    });
  });

  test('inverse tone uses steamed milk even on the default variant', async () => {
    await render(<Text tone="inverse">Resume</Text>);

    expect(screen.getByText('Resume')).toHaveStyle({
      color: toneColors.inverse,
    });
  });

  test('kicker defaults to paprika-600 on Manrope', async () => {
    await render(<Text variant="kicker">MISE</Text>);

    expect(screen.getByText('MISE')).toHaveStyle({
      color: colors.paprikaPressed,
      fontFamily: fonts.manrope600,
    });
    expect(fonts.manrope600).toBe('Manrope_600SemiBold');
  });

  test('section uses Manrope, not mono', async () => {
    await render(<Text variant="section">THIS WEEK</Text>);

    expect(screen.getByText('THIS WEEK')).toHaveStyle({
      fontFamily: fonts.manrope600,
    });
    expect(fonts.manrope700).toBe('Manrope_700Bold');
    expect(fonts.mono500).toBe('IBMPlexMono_500Medium');
  });

  test('caller style color wins over tone', async () => {
    await render(
      <Text tone="inverse" style={{ color: colors.espresso }}>
        Check
      </Text>,
    );

    expect(screen.getByText('Check')).toHaveStyle({
      color: colors.espresso,
    });
  });
});
