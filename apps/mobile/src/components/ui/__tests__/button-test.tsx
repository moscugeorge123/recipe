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

  test('primary uses black pill fill and white label on browse', async () => {
    await render(<Button label="Start cooking" />);

    expect(screen.getByRole('button', { name: 'Start cooking' })).toHaveStyle({
      backgroundColor: colors.canvasDark,
    });
    expect(screen.getByText('Start cooking')).toHaveStyle({
      color: colors.onDark,
    });
  });

  test('inverse uses black pill fill and white label on browse', async () => {
    await render(<Button label="Show results" variant="inverse" />);

    expect(screen.getByRole('button', { name: 'Show results' })).toHaveStyle({
      backgroundColor: colors.canvasDark,
    });
    expect(screen.getByText('Show results')).toHaveStyle({
      color: colors.onDark,
    });
  });

  test('secondary uses soft surface fill and ink label', async () => {
    await render(<Button label="Clear the list" variant="secondary" />);

    expect(screen.getByRole('button', { name: 'Clear the list' })).toHaveStyle({
      backgroundColor: colors.surfaceSoft,
    });
    expect(screen.getByText('Clear the list')).toHaveStyle({
      color: colors.ink,
    });
  });

  test('icon size uses the label as the accessible name', async () => {
    await render(<Button label="Back" size="icon" icon={<Text>‹</Text>} />);

    expect(screen.getByRole('button', { name: 'Back' })).toBeOnTheScreen();
    expect(screen.queryByText('Back')).toBeNull();
  });

  test('ghost uses ink label on an outline fill', async () => {
    await render(<Button label="Skip" variant="ghost" />);

    expect(screen.getByText('Skip')).toHaveStyle({
      color: colors.ink,
    });
  });

  test('disabled keeps 50% opacity', async () => {
    await render(<Button label="Save" disabled />);

    expect(screen.getByRole('button', { name: 'Save' })).toHaveStyle({
      opacity: 0.5,
    });
  });

  test('primary in the cook-dark shell uses a white pill and black label', async () => {
    await render(
      <CookShell theme="dark">
        <Button label="Next step" />
      </CookShell>,
    );

    expect(screen.getByRole('button', { name: 'Next step' })).toHaveStyle({
      backgroundColor: colors.canvasLight,
    });
    expect(screen.getByText('Next step')).toHaveStyle({
      color: colors.canvasDark,
    });
  });
});
