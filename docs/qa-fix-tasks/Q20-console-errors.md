# Q20. Console errors: empty-id recipe query and a Reanimated warning

🟠 Medium (noise, wasted work) · mobile · Findings **F06, F07**

## Problem

The Metro log during a normal session is dominated by:

1. `ERROR [["recipes","detail",""]]: No queryFn was passed as an option, and no default queryFn was found.` — repeated many times (a recipe-detail query is mounted with an **empty id**).
2. `WARN [Reanimated] Writing to value during component render. Please ensure that you don't access the value property nor use set method of a shared value while React is rendering a component.` — constantly.

These hide real problems and the first one means extra cache entries/work for nothing.

## Evidence

The log excerpt (from the test session):

```
ERROR  [["recipes","detail",""]]: No queryFn was passed as an option, and no default queryFn was found. …
WARN  [Reanimated] Writing to `value` during component render. …
```
Seen alongside the Today and Plan screens, e.g. ![Today](screenshots/067-today-scroll1.png) ![Plan](screenshots/069-plan-day.png)

## Root cause

1. **Verified.** `useRecipe` (`apps/mobile/src/features/recipes/hooks/use-recipe.ts`) mounts a second observer for live engagement edits:
   ```ts
   const original = useQuery<RecipeView>({
     queryKey: recipeKeys.detail(id ?? ''),   // '' when id is undefined/null
     enabled: false,                           // but still has no queryFn
   });
   ```
   Callers such as `Tonight` (`today.tsx`, `useTRecipe(id)` with `id === null` before the plan loads) hit this with `id = ''`. Any `invalidateQueries`/refetch on `recipeKeys.all` then tries to run that function-less query and TanStack logs the error.
2. **Hypothesis.** A shared value is written during render in shared UI (look at the `tw()` helpers, `Stagger`, `SlideText`, `useFade`, `BarFill` in `today.tsx`: they create styles with `useAnimatedStyle` but a `useSharedValue.value = …` assignment in the component body would trigger the warning). **Find it:** run with `LogBox`/`console.warn` stack (`console.warn = (...a) => { console.trace(...a) }` in dev) and fix the first offender; the warning prints once per render, so one bad component floods the log.

## Fix

1. In `use-recipe.ts` give the observer a `queryFn: skipToken` (TanStack v5) and make the key `id ? recipeKeys.detail(id) : ['recipes','detail','none']`, **or** read the cache with `useQueryClient().getQueryState`/`useSyncExternalStore` instead of a second observer. Also guard `useTRecipe(null)` (return early before any hook that builds `recipeKeys.detail('')`).
2. Move the offending `sharedValue.value = x` into `useEffect`/`useLayoutEffect` (or an event handler), or use `useDerivedValue`.
3. Add a dev-only test/logger that fails the Jest run on `console.error` from React Query.

## Acceptance criteria

- A 5-minute session (open app, switch tabs, import, plan, cook) produces **no** "No queryFn" error and no Reanimated render-write warning.
- `recipeKeys.detail('')` never appears in the query cache (assert in a test with a spy).

## Tests

- Jest: render `useTRecipe(null)` with a QueryClient; assert `client.getQueryCache().getAll()` has no key containing `''` and no console error.
