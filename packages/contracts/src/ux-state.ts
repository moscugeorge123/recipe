/**
 * Minimum async-state contract for upcoming list/detail journeys.
 *
 * - `loading`: retain the screen shell and show a non-blocking skeleton/progress affordance.
 * - `empty`: explain that no data exists and offer a relevant primary action.
 * - `error`: preserve navigation, show a safe message, and expose `retry` when retryable.
 * - `ready`: render the current data; background refresh must not replace it with a blank screen.
 */
export type AsyncUxState<T> =
  | { status: "loading" }
  | { status: "empty"; title: string; actionLabel?: string }
  | { status: "error"; message: string; retryable: boolean }
  | { status: "ready"; data: T; refreshing?: boolean };

export interface RetryAction {
  label: "Retry";
  execute(): void | Promise<void>;
}
