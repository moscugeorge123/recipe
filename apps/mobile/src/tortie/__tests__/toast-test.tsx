import { act, fireEvent, screen } from '@testing-library/react-native';
import { AppState } from 'react-native';

import { renderWithProviders } from '@/test/render-with-providers';
import { toast, toastDuration, useNav } from '@/tortie/nav-store';
import { ToastView } from '@/tortie/ui/toast';

beforeEach(() => {
  useNav.setState(useNav.getInitialState(), true);
});

describe('toast timing', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('durations: 2.4 s, 3.8 s for errors, longer with a button', () => {
    expect(toastDuration(false, false)).toBe(2400);
    expect(toastDuration(true, false)).toBe(3800);
    expect(toastDuration(false, true)).toBeGreaterThan(2400);
  });

  test('a toast goes after 2.4 s', () => {
    toast('Saved');
    expect(useNav.getState().toastOn).toBe(true);
    jest.advanceTimersByTime(2399);
    expect(useNav.getState().toastOn).toBe(true);
    jest.advanceTimersByTime(2);
    expect(useNav.getState().toastOn).toBe(false);
  });

  test('an error toast goes after 3.8 s', () => {
    toast('Nope', 'error');
    jest.advanceTimersByTime(3799);
    expect(useNav.getState().toastOn).toBe(true);
    jest.advanceTimersByTime(2);
    expect(useNav.getState().toastOn).toBe(false);
  });

  test('a second toast replaces the first and restarts the timer', () => {
    toast('First');
    jest.advanceTimersByTime(2000);
    toast('Second');
    jest.advanceTimersByTime(1000);
    expect(useNav.getState().toast).toBe('Second');
    expect(useNav.getState().toastOn).toBe(true);
    jest.advanceTimersByTime(1500);
    expect(useNav.getState().toastOn).toBe(false);
  });

  test('toastHide clears it at once and leaves no timer behind', () => {
    toast('Hi');
    useNav.getState().toastHide();
    expect(useNav.getState().toastOn).toBe(false);
    toast('Again');
    jest.advanceTimersByTime(1000);
    expect(useNav.getState().toastOn).toBe(true);
  });
});

describe('ToastView', () => {
  test('shows a long message on two lines and a button that runs', async () => {
    await renderWithProviders(<ToastView />);
    const run = jest.fn();
    await act(async () =>
      toast(
        'We couldn’t find that site. Check the address and try again soon please',
        'error',
        { label: 'Open', run },
      ),
    );
    const text = screen.getByText(/We couldn’t find that site/);
    expect(text.props.numberOfLines).toBe(2);
    await fireEvent.press(screen.getByLabelText('Open'));
    expect(run).toHaveBeenCalledTimes(1);
    expect(useNav.getState().toastOn).toBe(false);
  });

  test('tap dismisses', async () => {
    await renderWithProviders(<ToastView />);
    await act(async () => toast('Saved'));
    await fireEvent.press(screen.getByLabelText('Dismiss message'));
    expect(useNav.getState().toastOn).toBe(false);
  });

  test('coming back to the foreground hides an overdue toast', async () => {
    let listener: ((state: string) => void) | undefined;
    const spy = jest.spyOn(AppState, 'addEventListener').mockImplementation(((
      _: string,
      fn: (state: string) => void,
    ) => {
      listener = fn;
      return { remove: jest.fn() };
    }) as never);
    await renderWithProviders(<ToastView />);
    await act(async () => toast('Welcome, QA'));
    // The app was in the background past the deadline; its timers never ran.
    await act(async () => useNav.setState({ toastUntil: Date.now() - 1000 }));
    await act(async () => listener?.('active'));
    expect(useNav.getState().toastOn).toBe(false);
    spy.mockRestore();
  });
});
