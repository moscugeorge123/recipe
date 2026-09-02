import { screen, userEvent, waitFor } from '@testing-library/react-native';

import { RecipeNotesPanel } from '@/features/recipes/components/recipe-notes';
import { readNoteDraft } from '@/features/recipes/note-drafts';
import { renderWithProviders } from '@/test/render-with-providers';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const recipeId = '11111111-1111-4111-8111-111111111111';

describe('RecipeNotesPanel', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('keeps a local draft after a failed save and still posts on retry', async () => {
    let createCalls = 0;
    jest.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      const method = (init?.method ?? 'GET').toUpperCase();
      if (url.includes('/notes') && method === 'GET') {
        return jsonResponse({
          data: [],
          meta: { page: 1, pageSize: 0, total: 0, totalPages: 0 },
        });
      }
      if (url.includes('/notes') && method === 'POST') {
        createCalls += 1;
        if (createCalls === 1) {
          return jsonResponse(
            { error: { code: 'BAD_REQUEST', message: 'fail' } },
            500,
          );
        }
        return jsonResponse(
          {
            data: {
              id: 'note-1',
              recipeId,
              body: 'less salt',
              cookSessionId: null,
              createdAt: '2026-08-31T00:00:00.000Z',
              updatedAt: '2026-08-31T00:00:00.000Z',
            },
          },
          201,
        );
      }
      return jsonResponse({ data: [] });
    });
    const user = userEvent.setup();
    await renderWithProviders(<RecipeNotesPanel recipeId={recipeId} enabled />);

    await user.type(
      await screen.findByLabelText('New recipe note'),
      'less salt',
    );
    await waitFor(async () => {
      expect(await readNoteDraft(recipeId)).toContain('less salt');
    });
    await user.press(screen.getByRole('button', { name: 'Save note' }));
    expect(
      await screen.findByText(/Couldn’t save this note/i),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeOnTheScreen();
    expect(screen.getByLabelText('New recipe note')).toHaveProp(
      'value',
      'less salt',
    );

    await user.press(screen.getByRole('button', { name: 'Save note' }));
    expect(await screen.findByText('less salt')).toBeOnTheScreen();
  });
});
