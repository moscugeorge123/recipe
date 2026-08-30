import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';

import { useCatalog } from '@/features/catalog/use-catalog';
import {
  createCookSession,
  deleteCookSession,
  getCookSession,
  listCookSessions,
  patchCookSession,
} from '@/features/cook-sessions/api';
import {
  isApiRecipeId,
  type CookSessionView,
  type CreateCookSessionBody,
  type ListCookSessionsQuery,
  type CookSessionStatus,
  type PatchCookSessionBody,
} from '@/features/cook-sessions/types';
import type { RecipeId } from '@/features/recipes/types';
import { useCookStore } from '@/stores/cook-store';

const cookSessionRoot = ['cook-sessions'] as const;

export const cookSessionKeys = {
  all: cookSessionRoot,
  list: (query: ListCookSessionsQuery) =>
    [...cookSessionRoot, 'list', query] as const,
  current: [...cookSessionRoot, 'current'] as const,
  detail: (id: string) => [...cookSessionRoot, 'detail', id] as const,
};

export function useCookSessions(query: ListCookSessionsQuery = {}) {
  return useQuery({
    queryKey: cookSessionKeys.list(query),
    queryFn: ({ signal }) => listCookSessions(query, signal),
    staleTime: 15_000,
    retry: 1,
  });
}

export function useCookSession(id: string | undefined) {
  return useQuery({
    queryKey: cookSessionKeys.detail(id ?? ''),
    queryFn: ({ signal }) => getCookSession(id as string, signal),
    enabled: !!id,
    staleTime: 15_000,
    retry: 1,
  });
}

export async function fetchInProgressCookSession(
  signal?: AbortSignal,
): Promise<CookSessionView | null> {
  const result = await listCookSessions(
    { status: 'IN_PROGRESS', page: 1, pageSize: 1 },
    signal,
  );
  return result.items[0] ?? null;
}

export function useInProgressCookSession() {
  return useQuery({
    queryKey: cookSessionKeys.current,
    queryFn: ({ signal }) => fetchInProgressCookSession(signal),
    staleTime: 15_000,
    retry: 1,
  });
}

function invalidateCookSessions(queryClient: ReturnType<typeof useQueryClient>) {
  return queryClient.invalidateQueries({ queryKey: cookSessionKeys.all });
}

export function useCreateCookSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateCookSessionBody) => createCookSession(body),
    onSuccess: () => {
      invalidateCookSessions(queryClient).catch(() => undefined);
    },
  });
}

export function usePatchCookSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: PatchCookSessionBody }) =>
      patchCookSession(id, body),
    onSuccess: () => {
      invalidateCookSessions(queryClient).catch(() => undefined);
    },
  });
}

export function useDeleteCookSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteCookSession(id),
    onSuccess: () => {
      invalidateCookSessions(queryClient).catch(() => undefined);
    },
  });
}

async function closeOrphanSession(
  sessionId: string,
  status: Extract<CookSessionStatus, 'COMPLETED' | 'STOPPED'>,
  queryClient: ReturnType<typeof useQueryClient>,
): Promise<void> {
  try {
    await patchCookSession(sessionId, { status });
  } catch {
    return;
  }
  await invalidateCookSessions(queryClient);
}

export function useStartCooking() {
  const queryClient = useQueryClient();
  const start = useCookStore((state) => state.start);
  const setSessionId = useCookStore((state) => state.setSessionId);
  const setStep = useCookStore((state) => state.setStep);

  return useCallback(
    async (recipeId: RecipeId, options?: { reset?: boolean }) => {
      const store = useCookStore.getState();
      if (
        options?.reset !== true &&
        store.terminalStatus &&
        store.recipeId === recipeId
      ) {
        return;
      }

      const hadLocalProgress =
        store.recipeId === recipeId && options?.reset !== true;
      start(recipeId, options);

      if (!isApiRecipeId(recipeId)) {
        return;
      }

      try {
        const session = await createCookSession({ recipeId });
        const current = useCookStore.getState();
        if (current.terminalStatus) {
          await closeOrphanSession(
            session.id,
            current.terminalStatus,
            queryClient,
          );
          return;
        }
        if (current.recipeId !== recipeId) {
          await closeOrphanSession(session.id, 'STOPPED', queryClient);
          return;
        }
        setSessionId(session.id);
        if (!hadLocalProgress) {
          setStep(session.currentStepIndex);
        }
        await invalidateCookSessions(queryClient);
      } catch {
        // Keep the local session so cooking still works offline.
      }
    },
    [queryClient, setSessionId, setStep, start],
  );
}

export function useFinishCooking() {
  const queryClient = useQueryClient();
  const exit = useCookStore((state) => state.exit);
  const setTerminalStatus = useCookStore((state) => state.setTerminalStatus);

  const endSession = useCallback(
    async (status: Extract<CookSessionStatus, 'COMPLETED' | 'STOPPED'>) => {
      const fromStore = useCookStore.getState().sessionId;
      const fromCache = queryClient.getQueryData<CookSessionView | null>(
        cookSessionKeys.current,
      )?.id;
      queryClient.setQueryData(cookSessionKeys.current, null);

      let sessionId = fromStore ?? fromCache ?? null;
      if (!sessionId) {
        try {
          const result = await listCookSessions({
            status: 'IN_PROGRESS',
            page: 1,
            pageSize: 1,
          });
          sessionId = result.items[0]?.id ?? null;
        } catch {
          sessionId = null;
        }
      }

      if (sessionId) {
        try {
          await patchCookSession(sessionId, { status });
        } catch {
          // Home hides from the local store even if the request fails.
        }
      }

      await invalidateCookSessions(queryClient);
    },
    [queryClient],
  );

  const markCompleted = useCallback(async () => {
    setTerminalStatus('COMPLETED');
    await endSession('COMPLETED');
  }, [endSession, setTerminalStatus]);

  const stopAndClear = useCallback(async () => {
    setTerminalStatus('STOPPED');
    const mark = endSession('STOPPED');
    exit();
    await mark;
  }, [endSession, exit, setTerminalStatus]);

  const clearLocal = useCallback(() => {
    exit();
  }, [exit]);

  return { markCompleted, stopAndClear, clearLocal };
}

export function useSyncCookStep() {
  const sessionId = useCookStore((state) => state.sessionId);
  const stepIndex = useCookStore((state) => state.stepIndex);
  const terminalStatus = useCookStore((state) => state.terminalStatus);

  useEffect(() => {
    if (!sessionId || terminalStatus) {
      return;
    }

    const handle = setTimeout(() => {
      patchCookSession(sessionId, { currentStepIndex: stepIndex }).catch(
        () => undefined,
      );
    }, 300);

    return () => clearTimeout(handle);
  }, [sessionId, stepIndex, terminalStatus]);
}

export type ActiveCook = {
  session: CookSessionView | null;
  recipeId: string | null;
  title: string | null;
  stepIndex: number;
  stepCount: number;
  isVisible: boolean;
};

export function useActiveCook(): ActiveCook {
  const catalog = useCatalog();
  const localRecipeId = useCookStore((state) => state.recipeId);
  const localStepIndex = useCookStore((state) => state.stepIndex);
  const localSessionId = useCookStore((state) => state.sessionId);
  const terminalStatus = useCookStore((state) => state.terminalStatus);
  const exit = useCookStore((state) => state.exit);
  const sessionsQuery = useInProgressCookSession();
  const session = sessionsQuery.data ?? null;

  useEffect(() => {
    if (!session || useCookStore.getState().terminalStatus) {
      return;
    }

    const local = useCookStore.getState();
    if (!local.recipeId) {
      useCookStore.setState({
        recipeId: session.recipeId,
        sessionId: session.id,
        stepIndex: session.currentStepIndex,
        startedAt: Date.parse(session.startedAt),
        timer: null,
        terminalStatus: null,
      });
      return;
    }

    if (local.recipeId === session.recipeId && !local.sessionId) {
      useCookStore.setState({ sessionId: session.id });
    }
  }, [session]);

  useEffect(() => {
    if (!sessionsQuery.isSuccess || session) {
      return;
    }

    const local = useCookStore.getState();
    if (local.terminalStatus) {
      return;
    }
    if (local.sessionId) {
      exit();
    }
  }, [exit, session, sessionsQuery.isSuccess]);

  if (terminalStatus) {
    return {
      session: null,
      recipeId: null,
      title: null,
      stepIndex: 0,
      stepCount: 0,
      isVisible: false,
    };
  }

  if (session) {
    return {
      session,
      recipeId: session.recipeId,
      title: session.recipe.title,
      stepIndex:
        session.recipeId === localRecipeId
          ? localStepIndex
          : session.currentStepIndex,
      stepCount: session.recipe.stepCount,
      isVisible: true,
    };
  }

  const showLocal =
    !!localRecipeId &&
    (!isApiRecipeId(localRecipeId) ||
      !localSessionId ||
      sessionsQuery.isLoading ||
      sessionsQuery.isError);

  if (showLocal && localRecipeId) {
    const seed = catalog.get(localRecipeId);
    return {
      session: null,
      recipeId: localRecipeId,
      title: seed?.title ?? null,
      stepIndex: localStepIndex,
      stepCount: seed?.steps.length ?? 0,
      isVisible: !!seed,
    };
  }

  return {
    session: null,
    recipeId: null,
    title: null,
    stepIndex: 0,
    stepCount: 0,
    isVisible: false,
  };
}
