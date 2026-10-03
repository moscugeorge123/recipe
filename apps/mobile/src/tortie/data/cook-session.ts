import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import {
  createCookSession,
  patchCookSession,
} from '@/features/cook-sessions/api';
import {
  useCreateCookSession,
  usePatchCookSession,
} from '@/features/cook-sessions/hooks';
import { isApiRecipeId } from '@/features/cook-sessions/types';
import { cookSessionKeys, recipeKeys } from '@/features/query-keys';
import { useCook } from '@/tortie/cook-store';
import { toast } from '@/tortie/nav-store';

/** Session creation in flight per recipe, so Finish can wait for the id. */
const inflight = new Map<string, Promise<string | null>>();

/**
 * API cook sessions behind Cook mode. `POST /cook-sessions` returns the
 * in-progress session for a recipe when one exists (and stops other recipes'),
 * so opening always re-syncs `useCook.sessionId`.
 */
export function useCookSessionSync() {
  const client = useQueryClient();
  const { mutateAsync: create } = useCreateCookSession();
  const { mutate: patch } = usePatchCookSession();

  const open = useCallback(
    (recipeId: string, step: number) => {
      if (!isApiRecipeId(recipeId)) return;
      const p = create({ recipeId, currentStepIndex: Math.max(0, step) })
        .then((s) => {
          const c = useCook.getState();
          if (c.active?.id === recipeId && c.activeOn) c.setSessionId(s.id);
          return s.id;
        })
        .catch(() => null);
      inflight.set(recipeId, p);
      p.finally(() => {
        if (inflight.get(recipeId) === p) inflight.delete(recipeId);
      }).catch(() => undefined);
    },
    [create],
  );

  const step = useCallback(
    (sessionId: string, currentStepIndex: number) =>
      patch({ id: sessionId, body: { currentStepIndex } }),
    [patch],
  );

  const settle = useCallback(async () => {
    await client
      .invalidateQueries({ queryKey: cookSessionKeys.all })
      .catch(() => undefined);
  }, [client]);

  /** Marks the session COMPLETED (Profile's "meals cooked" and the recipe's cookCount). */
  const finish = useCallback(
    async (recipeId: string, sessionId: string | null) => {
      if (!isApiRecipeId(recipeId)) return;
      try {
        let id = sessionId ?? (await inflight.get(recipeId)) ?? null;
        if (!id) id = (await createCookSession({ recipeId })).id;
        let s = await patchCookSession(id, { status: 'COMPLETED' });
        if (s.status !== 'COMPLETED') {
          // Ended elsewhere (e.g. another recipe started): log a fresh one.
          const fresh = await createCookSession({ recipeId });
          s = await patchCookSession(fresh.id, { status: 'COMPLETED' });
        }
      } catch {
        toast('Couldn’t log this cook. Check your connection.');
      }
      await settle();
      await client
        .invalidateQueries({ queryKey: recipeKeys.all })
        .catch(() => undefined);
    },
    [client, settle],
  );

  /** Closing from the summary without Finish: don't leave the session in progress. */
  const stop = useCallback(
    async (recipeId: string, sessionId: string | null) => {
      if (!isApiRecipeId(recipeId)) return;
      const id = sessionId ?? (await inflight.get(recipeId)) ?? null;
      if (!id) return;
      await patchCookSession(id, { status: 'STOPPED' }).catch(() => undefined);
      await settle();
    },
    [settle],
  );

  return useMemo(
    () => ({ open, step, finish, stop }),
    [open, step, finish, stop],
  );
}
