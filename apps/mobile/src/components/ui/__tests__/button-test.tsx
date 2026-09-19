import { render, screen, userEvent } from '@testing-library/react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
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

  test('primary uses cta fill and white label', async () => {
    await render(<Button label="Start cooking" />);

    expect(screen.getByRole('button', { name: 'Start cooking' })).toHaveStyle({
      backgroundColor: colors.cta,
    });
    expect(screen.getByText('Start cooking')).toHaveStyle({
      color: colors.onPrimary,
    });
  });

  test('inverse uses espresso fill and steamed-milk label', async () => {
    await render(<Button label="Show results" variant="inverse" />);

    expect(screen.getByRole('button', { name: 'Show results' })).toHaveStyle({
      backgroundColor: colors.espresso,
    });
    expect(screen.getByText('Show results')).toHaveStyle({
      color: colors.steamedMilk,
    });
  });

  test('secondary uses basil-600 fill and white label', async () => {
    await render(<Button label="Clear the list" variant="secondary" />);

    expect(screen.getByRole('button', { name: 'Clear the list' })).toHaveStyle({
      backgroundColor: colors.basil600,
    });
    expect(screen.getByText('Clear the list')).toHaveStyle({
      color: colors.onPrimary,
    });
  });

  test('icon size uses the label as the accessible name', async () => {
    await render(<Button label="Back" size="icon" icon={<Text>‹</Text>} />);

    expect(screen.getByRole('button', { name: 'Back' })).toBeOnTheScreen();
    expect(screen.queryByText('Back')).toBeNull();
  });

  test('ghost icon size uses a paper disc', async () => {
    await render(
      <Button label="Back" size="icon" variant="ghost" icon={<Text>‹</Text>} />,
    );

    expect(screen.getByRole('button', { name: 'Back' })).toHaveStyle({
      backgroundColor: colors.paper,
    });
  });

  test('ghost uses black label on a transparent fill', async () => {
    await render(<Button label="Skip" variant="ghost" />);

    expect(screen.getByText('Skip')).toHaveStyle({
      color: colors.espresso,
    });
  });

  test('primary disabled uses ctaDisabled fill', async () => {
    await render(<Button label="Save" disabled />);

    expect(screen.getByRole('button', { name: 'Save' })).toHaveStyle({
      backgroundColor: colors.ctaDisabled,
    });
  });

  test('non-primary disabled keeps 50% opacity', async () => {
    await render(<Button label="Skip" variant="ghost" disabled />);

    expect(screen.getByRole('button', { name: 'Skip' })).toHaveStyle({
      opacity: 0.5,
    });
  });

  test('link uses paprika label on a transparent fill with icon and text', async () => {
    await render(
      <Button label="Add to groceries" variant="link" icon={<Text>🛒</Text>} />,
    );

    expect(
      screen.getByRole('button', { name: 'Add to groceries' }),
    ).toBeOnTheScreen();
    expect(screen.getByText('Add to groceries')).toHaveStyle({
      color: colors.paprikaPressed,
    });
    expect(screen.getByText('🛒')).toBeOnTheScreen();
  });

  test('link disabled keeps 50% opacity', async () => {
    await render(<Button label="Add to groceries" variant="link" disabled />);

    expect(
      screen.getByRole('button', { name: 'Add to groceries' }),
    ).toHaveStyle({
      opacity: 0.5,
    });
  });

  test('primary stays a black pill in the cook shell', async () => {
    await render(
      <CookShell>
        <Button label="Next step" />
      </CookShell>,
    );

    expect(screen.getByRole('button', { name: 'Next step' })).toHaveStyle({
      backgroundColor: colors.cta,
    });
    expect(screen.getByText('Next step')).toHaveStyle({
      color: colors.onPrimary,
    });
  });
});
