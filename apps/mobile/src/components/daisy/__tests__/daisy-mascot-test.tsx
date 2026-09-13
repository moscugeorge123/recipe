import { render, screen } from '@testing-library/react-native';

import { daisy } from '@/components/daisy/colors';
import { DaisyFoodGlyph } from '@/components/daisy/foods';
import { DaisyMascot } from '@/components/daisy/daisy-mascot';
import { DAISY_FOODS, DAISY_PHASES } from '@/components/daisy/phase';
import { usePreferencesStore } from '@/stores/preferences-store';

describe('daisy colors', () => {
  test('uses orange brand paprika, mango, and white paper', () => {
    expect(daisy.fur).toBe('#F4A36E');
    expect(daisy.furDeep).toBe('#F97316');
    expect(daisy.cream).toBe('#FFFFFF');
    expect(daisy.spark).toBe('#F97316');
    expect(daisy.highlight).toBe('#FFFFFF');
    expect(daisy.pillBg).toBe('#F8F7F2');
  });
});

describe('DaisyFoodGlyph', () => {
  test.each([...DAISY_FOODS])('renders the %s glyph', async (id) => {
    await render(<DaisyFoodGlyph id={id} />);
  });
});

describe('DaisyMascot', () => {
  beforeEach(() => {
    usePreferencesStore.getState().reset();
  });

  test('is decorative and hides chips while idle', async () => {
    await render(<DaisyMascot phase="idle" />);

    const mascot = screen.getByTestId('daisy-mascot', {
      includeHiddenElements: true,
    });
    expect(mascot).toBeOnTheScreen();
    expect(mascot).toHaveProp('importantForAccessibility', 'no');
    expect(screen.queryByTestId('daisy-cards')).toBeNull();
  });

  test.each([...DAISY_PHASES])('renders the %s pose', async (phase) => {
    await render(<DaisyMascot phase={phase} />);

    expect(
      screen.getByTestId('daisy-mascot', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
  });

  test('shows ingredient chips while analyzing', async () => {
    await render(<DaisyMascot phase="analyzing" />);

    expect(
      screen.getByTestId('daisy-cards', { includeHiddenElements: true }),
    ).toBeTruthy();
    expect(
      screen.getByTestId('daisy-card-beef', { includeHiddenElements: true }),
    ).toBeTruthy();
    expect(
      screen.getByTestId('daisy-card-onion', { includeHiddenElements: true }),
    ).toBeTruthy();
    expect(
      screen.getByTestId('daisy-card-carrot', { includeHiddenElements: true }),
    ).toBeTruthy();
  });

  test('shows the fly-in card while importing', async () => {
    await render(<DaisyMascot phase="importing" />);

    expect(
      screen.getByTestId('daisy-import-card', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
    expect(screen.queryByTestId('daisy-cards')).toBeNull();
  });

  test('hides chips on the face variant', async () => {
    await render(<DaisyMascot phase="analyzing" variant="face" />);

    expect(screen.queryByTestId('daisy-cards')).toBeNull();
  });

  test('hides chips when reduced motion is preferred', async () => {
    usePreferencesStore.getState().setReduceMotion('reduce');

    await render(<DaisyMascot phase="analyzing" reducedMotion />);

    expect(
      screen.getByTestId('daisy-mascot', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
    expect(screen.queryByTestId('daisy-cards')).toBeNull();
  });
});
