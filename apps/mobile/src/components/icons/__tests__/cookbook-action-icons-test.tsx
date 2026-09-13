import { render, screen } from '@testing-library/react-native';

import {
  AddCookbookRecipeIcon,
  DeleteCookbookIcon,
  RenameCookbookIcon,
} from '@/components/icons/cookbook-action-icons';

describe('cookbook action icons', () => {
  test('renders rename, add, and delete glyphs', async () => {
    await render(
      <>
        <RenameCookbookIcon />
        <AddCookbookRecipeIcon />
        <DeleteCookbookIcon />
      </>,
    );

    expect(screen.root).toBeTruthy();
  });
});
