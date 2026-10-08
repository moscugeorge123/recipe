import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createRecipeNote,
  deleteRecipeNote,
  listRecipeNotes,
  patchRecipeNote,
} from '@/features/recipes/api';
import { QUERY_FRESHNESS, recipeKeys } from '@/features/query-keys';
import { networkFirst, persistKeyFor } from '@/features/query-persist';
import type { RecipeNoteDto } from '@/features/recipes/schemas';

export function useRecipeNotes(recipeId: string | undefined, enabled: boolean) {
  const client = useQueryClient();

  const query = useQuery({
    queryKey: recipeKeys.notes(recipeId ?? ''),
    queryFn: async ({ signal }) => {
      const result = await networkFirst(
        persistKeyFor(recipeKeys.notes(recipeId as string)),
        () => listRecipeNotes(recipeId as string, signal),
      );
      return result.data;
    },
    enabled: !!recipeId && enabled,
    staleTime: QUERY_FRESHNESS.notes,
    retry: 1,
    placeholderData: (previous) => previous,
  });

  const create = useMutation({
    mutationFn: (input: { body: string; cookSessionId?: string | null }) =>
      createRecipeNote(recipeId as string, input),
    onSuccess: (note) => {
      client.setQueryData<RecipeNoteDto[]>(
        recipeKeys.notes(recipeId as string),
        (current) => [note, ...(current ?? [])],
      );
    },
  });

  const update = useMutation({
    mutationFn: (input: {
      noteId: string;
      body?: string;
      cookSessionId?: string | null;
    }) =>
      patchRecipeNote(recipeId as string, input.noteId, {
        ...(input.body !== undefined ? { body: input.body } : {}),
        ...(input.cookSessionId !== undefined
          ? { cookSessionId: input.cookSessionId }
          : {}),
      }),
    onSuccess: (note) => {
      client.setQueryData<RecipeNoteDto[]>(
        recipeKeys.notes(recipeId as string),
        (current) =>
          (current ?? []).map((item) => (item.id === note.id ? note : item)),
      );
    },
  });

  const remove = useMutation({
    mutationFn: (input: { noteId: string; confirmed: true }) =>
      deleteRecipeNote(recipeId as string, input.noteId),
    onSuccess: (_void, input) => {
      client.setQueryData<RecipeNoteDto[]>(
        recipeKeys.notes(recipeId as string),
        (current) => (current ?? []).filter((item) => item.id !== input.noteId),
      );
    },
  });

  return { query, create, update, remove };
}
