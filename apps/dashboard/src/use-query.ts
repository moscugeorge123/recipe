import { useEffect, useRef, useState } from 'react';

export type QueryResult<T> =
  | { status: 'loading'; retry: () => void }
  | { status: 'error'; message: string; retry: () => void }
  | { status: 'ready'; data: T; retry: () => void };

export function useQuery<T>(loader: () => Promise<T>, key: string): QueryResult<T> {
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'error'; message: string }
    | { status: 'ready'; data: T }
  >({ status: 'loading' });

  useEffect(() => {
    let active = true;
    setState({ status: 'loading' });
    loaderRef.current()
      .then((data) => {
        if (active) setState({ status: 'ready', data });
      })
      .catch((error: unknown) => {
        if (!active) return;
        const message = error instanceof Error && error.message ? error.message : 'Request failed';
        setState({ status: 'error', message });
      });
    return () => {
      active = false;
    };
  }, [key, attempt]);

  const retry = () => setAttempt((value) => value + 1);
  if (state.status === 'ready') return { status: 'ready', data: state.data, retry };
  if (state.status === 'error') return { status: 'error', message: state.message, retry };
  return { status: 'loading', retry };
}
