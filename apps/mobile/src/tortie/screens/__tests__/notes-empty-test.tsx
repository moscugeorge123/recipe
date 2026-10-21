import { render, screen } from '@testing-library/react-native';

import { NOTES_EMPTY_ICON, NotesEmpty } from '../recipe-notes';

describe('NotesEmpty', () => {
  test('renders one inline row with the title and the body', async () => {
    await render(<NotesEmpty />);
    expect(screen.getByText('No notes yet')).toBeTruthy();
    expect(screen.getByText(/Jot down tweaks/)).toBeTruthy();
    expect(screen.getByText(NOTES_EMPTY_ICON)).toBeTruthy();
  });

  test('does not use the glyphs missing from the icon font', () => {
    expect(['edit_note', 'chat', 'restaurant']).not.toContain(NOTES_EMPTY_ICON);
  });
});
