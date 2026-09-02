import { AccessibilityInfo } from 'react-native';
import { fireEvent, screen, userEvent } from '@testing-library/react-native';

import { ConfirmSheet } from '@/components/ui/confirm-sheet';
import { ContentSkeleton } from '@/components/ui/content-skeleton';
import { EmptyStatePanel } from '@/components/ui/empty-state';
import { InlineErrorPanel } from '@/components/ui/inline-error';
import { Toast } from '@/components/ui/toast';
import { renderWithProviders } from '@/test/render-with-providers';

describe('shared recovery primitives', () => {
  test('content skeletons keep card and detail geometry', async () => {
    await renderWithProviders(<ContentSkeleton shape="cards" />);
    expect(screen.getByTestId('content-skeleton-cards')).toBeOnTheScreen();
    expect(screen.getByLabelText('Loading recipes')).toBeOnTheScreen();
  });

  test('timeline skeleton matches revision-card geometry', async () => {
    await renderWithProviders(<ContentSkeleton shape="timeline" />);
    expect(screen.getByTestId('content-skeleton-timeline')).toBeOnTheScreen();
    expect(screen.getByLabelText('Loading revision history')).toBeOnTheScreen();
  });

  test('detail skeleton uses the recipe loading label', async () => {
    await renderWithProviders(<ContentSkeleton shape="detail" />);
    expect(screen.getByTestId('content-skeleton-detail')).toBeOnTheScreen();
    expect(screen.getByLabelText('Loading recipe')).toBeOnTheScreen();
  });

  test('empty state exposes a CTA', async () => {
    const onAction = jest.fn();
    const user = userEvent.setup();
    await renderWithProviders(
      <EmptyStatePanel
        title="No recipes yet"
        actionLabel="Add your first recipe"
        onAction={onAction}
      />,
    );
    expect(screen.getByText('No recipes yet')).toBeOnTheScreen();
    await user.press(
      screen.getByRole('button', { name: 'Add your first recipe' }),
    );
    expect(onAction).toHaveBeenCalled();
  });

  test('inline error announces and retries', async () => {
    const onRetry = jest.fn();
    const user = userEvent.setup();
    await renderWithProviders(
      <InlineErrorPanel
        message="Couldn’t load this section."
        onRetry={onRetry}
      />,
    );
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(
      'Couldn’t load this section.',
    );
    await user.press(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalled();
  });

  test('confirmation sheet requires an explicit confirm', async () => {
    const onConfirm = jest.fn();
    const onClose = jest.fn();
    const user = userEvent.setup();
    await renderWithProviders(
      <ConfirmSheet
        visible
        title="Delete “Appetizers”?"
        message="Recipes stay in your kitchen. Only this collection is removed."
        confirmLabel="Delete collection"
        cancelLabel="Keep"
        destructive
        onConfirm={onConfirm}
        onClose={onClose}
      />,
    );
    expect(
      await screen.findByText(
        'Recipes stay in your kitchen. Only this collection is removed.',
      ),
    ).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Keep' }));
    expect(onClose).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  test('undo toast restores the previous action', async () => {
    const onUndo = jest.fn();
    await renderWithProviders(
      <Toast
        toast={{
          text: 'Note deleted',
          glyph: '↺',
          action: 'Undo',
          onAction: onUndo,
        }}
      />,
    );
    expect(screen.getByText('Note deleted')).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Undo' }));
    expect(onUndo).toHaveBeenCalled();
  });
});
