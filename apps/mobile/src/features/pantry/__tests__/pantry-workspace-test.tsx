import { useState } from 'react';
import {
  act,
  fireEvent,
  screen,
  userEvent,
} from '@testing-library/react-native';

import { PantryWorkspace } from '@/features/pantry/pantry-workspace';
import type {
  OrganizedPantryItem,
  UnresolvedPantryLine,
} from '@/features/pantry/types';
import { renderWithProviders } from '@/test/render-with-providers';

function previewItem(
  overrides: Partial<OrganizedPantryItem> = {},
): OrganizedPantryItem {
  return {
    rawText: 'gochujang',
    name: 'Gochujang',
    canonicalName: 'gochujang',
    category: 'Pantry',
    emoji: '🌶️',
    colorToken: 'peach',
    quantity: null,
    unit: null,
    confidence: 0.4,
    source: 'fallback',
    status: 'NEEDS_REVIEW',
    locale: 'en',
    promptVersion: 'ingredient-enrichment-v1',
    ...overrides,
  };
}

function Harness({
  reducedMotion = false,
  unresolved = [],
}: {
  reducedMotion?: boolean;
  unresolved?: UnresolvedPantryLine[];
}) {
  const [draft, setDraft] = useState('gochujang\nsalt');
  const [preview, setPreview] = useState<OrganizedPantryItem[]>([]);
  const [lines, setLines] = useState(unresolved);

  return (
    <PantryWorkspace
      draftText={draft}
      onChangeDraft={setDraft}
      organizing={false}
      onOrganize={() => {
        setPreview([
          previewItem(),
          previewItem({
            rawText: 'salt',
            name: 'Salt',
            canonicalName: 'salt',
            source: 'dictionary',
            status: 'CLASSIFIED',
            confidence: 0.99,
          }),
        ]);
        setLines([
          { rawText: 'gochujang', reason: 'ai_unavailable', retryable: true },
        ]);
      }}
      preview={preview}
      unresolved={lines}
      onChangePreviewItem={(index, patch) => {
        setPreview((current) =>
          current.map((item, itemIndex) =>
            itemIndex === index ? { ...item, ...patch } : item,
          ),
        );
      }}
      accepting={false}
      onAccept={() => undefined}
      retrying={false}
      onRetryUnresolved={() => {
        setPreview((current) =>
          current.map((item) =>
            item.rawText === 'gochujang'
              ? {
                  ...item,
                  name: 'Gochujang paste',
                  source: 'ai',
                  status: 'CLASSIFIED',
                }
              : item,
          ),
        );
        setLines([]);
      }}
      saved={[]}
      category="All"
      onChangeCategory={() => undefined}
      onDeleteSaved={() => undefined}
      onRenameSaved={() => undefined}
      reducedMotion={reducedMotion}
    />
  );
}

describe('PantryWorkspace', () => {
  test('keeps typed input while preview cards appear', async () => {
    const user = userEvent.setup();
    await renderWithProviders(<Harness />);

    expect(screen.getByLabelText('Pantry ingredients')).toBeTruthy();
    await user.press(screen.getByRole('button', { name: 'Organize' }));

    expect(screen.getByText('Gochujang')).toBeTruthy();
    expect(screen.getByText('Salt')).toBeTruthy();
    expect(screen.getByLabelText('Pantry ingredients').props.value).toBe(
      'gochujang\nsalt',
    );
  });

  test('retries only unresolved lines and preserves the composer', async () => {
    const user = userEvent.setup();
    await renderWithProviders(<Harness />);
    await user.press(screen.getByRole('button', { name: 'Organize' }));
    expect(screen.getByText(/still need a closer look/)).toBeTruthy();
    await user.press(screen.getByRole('button', { name: 'Retry 1 line' }));
    expect(screen.getByText('Gochujang paste')).toBeTruthy();
    expect(screen.getByLabelText('Pantry ingredients').props.value).toBe(
      'gochujang\nsalt',
    );
  });

  test('lets the user correct a preview name without losing input', async () => {
    const user = userEvent.setup();
    await renderWithProviders(<Harness />);
    await user.press(screen.getByRole('button', { name: 'Organize' }));
    await user.press(screen.getByRole('button', { name: 'Edit Gochujang' }));
    await act(() =>
      fireEvent.changeText(
        screen.getByLabelText('Corrected name for gochujang'),
        'Hot paste',
      ),
    );
    expect(
      screen.getByLabelText('Corrected name for gochujang').props.value,
    ).toBe('Hot paste');
    expect(screen.getByLabelText('Pantry ingredients').props.value).toBe(
      'gochujang\nsalt',
    );
  });

  test('exposes accessible organize, retry, and save actions with reduced motion', async () => {
    await renderWithProviders(<Harness reducedMotion />);
    expect(screen.getByRole('button', { name: 'Organize' })).toBeTruthy();
    expect(screen.getByLabelText('Pantry ingredients')).toBeTruthy();
    expect(screen.getByText('IN YOUR PANTRY')).toBeTruthy();
  });
});
