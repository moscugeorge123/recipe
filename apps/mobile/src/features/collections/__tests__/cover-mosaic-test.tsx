import { fireEvent, screen } from '@testing-library/react-native';
import { View } from 'react-native';

import { CoverMosaic } from '@/features/collections/cover-mosaic';
import { renderWithProviders } from '@/test/render-with-providers';

function tile(id: string) {
  return { recipeId: id, thumbnailUrl: null as string | null };
}

async function renderMosaic(covers: ReturnType<typeof tile>[]) {
  const result = await renderWithProviders(
    <View style={{ width: 160 }}>
      <CoverMosaic covers={covers} />
    </View>,
  );
  fireEvent(screen.getByTestId('cover-mosaic'), 'layout', {
    nativeEvent: { layout: { width: 160, height: 160, x: 0, y: 0 } },
  });
  return result;
}

describe('CoverMosaic', () => {
  test('uses a shortened cover for one recipe', async () => {
    await renderMosaic([tile('a')]);
    expect(screen.getByLabelText('Cookbook cover with 1 recipe')).toBeOnTheScreen();
    expect(screen.getByTestId('cover-mosaic')).toHaveStyle({
      aspectRatio: 1 / 0.86,
    });
  });

  test('keeps two-recipe mosaics the same height as a single cover', async () => {
    await renderMosaic([tile('a'), tile('b')]);
    expect(
      screen.getByLabelText('Cookbook cover with 2 recipes'),
    ).toBeOnTheScreen();
    expect(screen.getByTestId('cover-mosaic')).toHaveStyle({
      aspectRatio: 1 / 0.86,
    });
  });

  test('places three recipes as two on top and one below', async () => {
    await renderMosaic([tile('a'), tile('b'), tile('c')]);
    expect(
      screen.getByLabelText('Cookbook cover with 3 recipes'),
    ).toBeOnTheScreen();
    expect(screen.getByTestId('cover-mosaic')).toHaveStyle({
      aspectRatio: 1 / 0.86,
    });
  });

  test('uses a four-square grid for four or more recipes', async () => {
    await renderMosaic([tile('a'), tile('b'), tile('c'), tile('d'), tile('e')]);
    expect(
      screen.getByLabelText('Cookbook cover with 4 recipes'),
    ).toBeOnTheScreen();
    expect(screen.getByTestId('cover-mosaic')).toHaveStyle({
      aspectRatio: 1 / 0.86,
    });
  });
});
