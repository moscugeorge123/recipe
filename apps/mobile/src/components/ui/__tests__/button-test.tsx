import { render, screen, userEvent } from '@testing-library/react-native';
import { Text } from 'react-native';

import { Button } from '@/components/ui/button';
import { CookShell } from '@/theme/cook-shell';
import { colors } from '@/theme/tokens';

describe('Button', () => {
  test('renders the label', async () => {
    await render(<Button label="Save" onPress={() => undefined} />);

    expect(screen.getByRole('button', { name: 'Save' })).toBeOnTheScreen();
  });

  test('calls onPress when pressed', async () => {
    const onPress = jest.fn();
    const user = userEvent.setup();

    await render(<Button label="Save" onPress={onPress} />);
    await user.press(screen.getByRole('button', { name: 'Save' }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  test('does not call onPress when disabled', async () => {
    const onPress = jest.fn();
    const user = userEvent.setup();

    await render(<Button label="Save" disabled onPress={onPress} />);
    await user.press(screen.getByRole('button', { name: 'Save' }));

    expect(onPress).not.toHaveBeenCalled();
  });

  test('primary uses Rausch fill and white label', async () => {
    await render(<Button label="Start cooking" />);

    expect(screen.getByRole('button', { name: 'Start cooking' })).toHaveStyle({
      backgroundColor: colors.paprika,
    });
    expect(screen.getByText('Start cooking')).toHaveStyle({
      color: colors.onPrimary,
    });
  });

  test('inverse uses canvas fill, ink outline, and ink label', async () => {
    await render(<Button label="Show results" variant="inverse" />);

    expect(screen.getByRole('button', { name: 'Show results' })).toHaveStyle({
      backgroundColor: colors.cream,
      borderColor: colors.espresso,
    });
    expect(screen.getByText('Show results')).toHaveStyle({
      color: colors.espresso,
    });
  });

  test('secondary uses canvas fill, ink outline, and ink label', async () => {
    await render(<Button label="Clear the list" variant="secondary" />);

    expect(screen.getByRole('button', { name: 'Clear the list' })).toHaveStyle({
      backgroundColor: colors.cream,
      borderColor: colors.espresso,
    });
    expect(screen.getByText('Clear the list')).toHaveStyle({
      color: colors.espresso,
    });
  });

  test('icon size uses the label as the accessible name', async () => {
    await render(
      <Button label="Back" size="icon" icon={<Text>‹</Text>} />,
    );

    expect(screen.getByRole('button', { name: 'Back' })).toBeOnTheScreen();
    expect(screen.queryByText('Back')).toBeNull();
  });

  test('ghost uses ink label on a transparent fill', async () => {
    await render(<Button label="Skip" variant="ghost" />);

    expect(screen.getByText('Skip')).toHaveStyle({
      color: colors.espresso,
    });
  });

  test('disabled primary uses the Rausch disabled fill', async () => {
    await render(<Button label="Save" disabled />);

    expect(screen.getByRole('button', { name: 'Save' })).toHaveStyle({
      backgroundColor: colors.paprikaSoft,
    });
  });

  test('primary in the cook-dark shell stays Rausch with white label', async () => {
    await render(
      <CookShell theme="dark">
        <Button label="Next step" />
      </CookShell>,
    );

    expect(screen.getByRole('button', { name: 'Next step' })).toHaveStyle({
      backgroundColor: colors.paprika,
    });
    expect(screen.getByText('Next step')).toHaveStyle({
      color: colors.onPrimary,
    });
  });
});
