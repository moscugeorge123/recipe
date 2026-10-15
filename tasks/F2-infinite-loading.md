# F2. Infinite loading for list screens

Scrollable lists stop at one page. The cookbook, collections, groceries, and pantry all request `page: 1` with `pageSize` 100, which is `MAX_PAGE_SIZE`. The subtitle can say 240 recipes while the grid holds 100. Search stops at 50 (`useRecipeSearch`). Kitchen migration treats that single page as the whole kitchen.

[F1](F1-list-pagination.md) is the API this task calls. Ship F1 first. The app already speaks `page`, `pageSize`, and `meta.totalPages`. This task walks the next page when the user reaches the end of the list.

TanStack Query is v5 (`@tanstack/react-query` `^5.101.4`). Use `useInfiniteQuery` with `initialPageParam: 1`.

## Page size

Use 20, the API default, for every infinite list. 20 fills complete rows of the cookbook’s 2-column grid.

Keep `COOKBOOK_PAGE_SIZE` (100) only if something still needs one bounded page. The cookbook itself must stop using it. Prefer a named `LIST_PAGE_SIZE = 20` next to the other sizes in `apps/mobile/src/features/query-keys.ts`.

`getNextPageParam`: return `last.meta.page + 1` when `last.meta.page < last.meta.totalPages`, otherwise `undefined`. An empty `data` array with `page >= totalPages` stops the list. Do not request a page the meta says is past the end.

Flatten pages in id order of arrival, then drop a repeated id (keep the first copy). A recipe saved while the user is scrolling lands on page 1 and shifts the offset page, so the same id can appear twice. The grid’s `keyExtractor` is `b.r.id`; a duplicate key breaks the list.

## Which screens load the next page

| Screen | Endpoint | Today | Scroll |
|---|---|---|---|
| Cookbook recipes | `GET /recipes` | `useTRecipes` → `useRecipes(1, 100)` | `TabList` / FlashList in `RecipesList` (`cookbook.tsx`) |
| Cookbook search | `GET /recipes?q=` | `useRecipeSearch`, one page of 50, plus a local title check | same list |
| A collection’s recipes | client filter `collO.recipeIds.includes` | hides any member that was not on the first recipe page | same list, server `collectionId` from F1 |
| Collections grid | `GET /collections` | `useCollections` page 1 size 100 | `TabScroll` (a `ScrollView`) |
| Groceries | `GET /shopping-list` | `useShoppingList` page 1 size 100 | `ScrollView` in `groceries.tsx` |
| Pantry | `GET /pantry` | `usePantryItems` page 1 size 100 | the pantry segment of the same screen |

Imports (`imports.tsx`) reads the local import store, not a paged API. Meal plan is a date range. Categories stay one small list. Cook sessions on Profile request `pageSize: 1` so `meta.total` is the cooked count. Notes and revisions stay one full response until F1’s opt-in query is sent; this task does not page them. The dashboard imports table is a separate web UI and stays a single page.

## Split the cookbook query from everyone else who calls `useTRecipes`

`useTRecipes` in `apps/mobile/src/tortie/data/recipes.ts` is one shared `useQuery` of the newest 100. These callers need a bounded window, not the growing cookbook:

| Caller | What it needs | After this task |
|---|---|---|
| `TodayScreen` / `Tonight` | newest recipe as a fallback dinner, and “any recipes at all” | `useRecipes(1, 1, { sort: 'latest' })`. `list.length === 0` still means the kitchen is empty, because `total` is 0. |
| `CookAgain` | up to 4 recipes with `cooked > 0` | `useRecipes(1, HOME_ENGAGEMENT_PAGE_SIZE, { sort: 'cooked' })` once F1 adds `sort=cooked`. `cookAgainList` still drops `cooked === 0` and slices to 4. |
| `useRecipeSlot` / `useRecipeLite` (`plan.ts`) | title for one planned id | Keep the detail fallback that already runs when the id is missing from the list. Point the list lookup at whatever pages are already cached; do not start the infinite query here. |
| `PlanDayMenu` (`recipe-detail.tsx`) | titles for occupied slots | The meal-plan payload has `recipeId` and no title. For an id that is not in a cached page, use the existing detail query (`recipeKeys.detail`). A week has a handful of distinct ids. |
| Profile and sign-in | `recipes.total` | `useRecipes(1, 1, { sort: 'latest' })` and read `meta.total`. |
| `useRecipeTitle` (`groceries.ts`) | source line on a grocery row | Look up ids in cached recipe pages. If the id is not cached, omit the title. Do not fetch the cookbook to label groceries. |
| `use-catalog.ts` | `useRecipes(1, 50)` | Leave this bounded page unless that screen is the cookbook grid. It must not be the infinite query. |
| Home prefetch (`features/home/prefetch.ts`) | warms `recipeKeys.list(1, 100, { sort: 'latest' })` | Prefetch the bounded latest page the Today screen uses, and page 1 of the cookbook infinite key. |

The cookbook uses a new hook, `useInfiniteRecipes`, whose key does not include the page number. Suggested factory, next to `recipeKeys.list`:

```ts
infinite: (filters: RecipeListFilters) =>
  [...recipeKeys.all, 'infinite', filters] as const,
```

`recipeKeys.list(page, pageSize, filters)` stays for the bounded queries above. Putting the page into the infinite key would cache each page as a separate list and defeat `getNextPageParam`.

`useTRecipes` can remain as the bounded latest page for the callers that still want “some recipes”, or those callers can use `useRecipes` directly. The cookbook must not import the bounded hook for its grid.

## Cookbook query key

One infinite query per filter set. Changing the key drops back to page 1. Map the sheet in `useCookbook` onto F1’s query:

| App state | Query |
|---|---|
| `rf.sort === 'recent'` | `sort=latest` |
| `rf.sort === 'az'` | `sort=title` |
| `rf.sort === 'quick'` | `sort=time` |
| `rf.sort === 'cooked'` | `sort=cooked` |
| `rf.saved` | `favorite=true` |
| `rf.time` is a number | `maxMinutes=<that number>` |
| `rf.lv` has difficulties | `difficulty=Easy,Medium` (only the selected ones) |
| `q` trimmed, length ≥ 1 | `q`, debounced 300ms, same as `useRecipeSearch` today |
| a collection is open (`cookbookColl`) | `collectionId=<id>` |

Delete the local title/`serverIds` filter and the local sorts (`localeCompare`, time, cooked) inside `useCookbookView`. The server order is the list order. Keep `matchesQuick` for the chips `quick` / `veg` / `sea` / `slow` / `bake`. F1 does not implement those word lists.

While a quick chip or `rf.pantry` is on, the loaded page can be mostly misses. If the visible match count is under 12 and `hasNextPage` is true, fetch the next page from an effect. Stop when the server is exhausted, then show the existing empty copy (“Nothing matches yet”). A chip that matches nothing must not spin forever: the effect stops on `!hasNextPage` or `isFetchingNextPage` or `isError`.

`rf.pantry` (“Cook from my pantry”) still needs ingredient names. `useIngredientIndex` already loads `recipeKeys.detail` per id, and the comment in `cookbook.ts` says the list payload has no ingredients. Pass only the ids of pages already loaded. Do not prefetch details for recipes the user has not paged to. The auto-fetch rule above still applies, so a sparse pantry match keeps asking for the next page of recipes.

Saved count in the cookbook subtitle (`nSaved`) currently counts hearts on the loaded page. Request `favorite=true` with `pageSize=1` (a normal `useQuery`, not the infinite list) and show `meta.total`. `nAll` stays `meta.total` on the unfiltered, or filtered, infinite list’s first page. `nColls` stays `meta.total` from the collections list.

Search: fold `useRecipeSearch` into this infinite query when `q` is non-empty. One debounce, one key. Clearing `q` restores the previous filter key and its first page.

Opening a collection sets `collectionId` and clears the local `recipeIds.includes` test. `recipeIds` on the summary can still drive the collection tile and the empty-collection filter. Membership of the grid comes from the recipe query.

## Collections, groceries, pantry

Same infinite hook shape, own keys:

- `collectionKeys.infinite` replaces the single `collectionKeys.list` page for the grid. `useCollections` today is `useQuery` at `['collections', 'list']`.
- `shoppingListKeys.infinite(done)` replaces `shoppingListKeys.list(done)`.
- `pantryKeys.infinite(category)` replaces `pantryKeys.list(category)`.

`flush.ts` and any caller that needs every collection id must loop `page` until `page >= totalPages`, at `pageSize` 100, the way `ShoppingListService.loadPantryKeys` does. `useCollection(id)` (the detail query) stays one resource. F1 returns every recipe on that detail call when the app sends no page params. The cookbook grid does not use that array; it uses `GET /recipes?collectionId=`.

Groceries and pantry group by aisle after the fetch (`groceryListOrder`, shelf helpers). Append the next page, then group the flattened list. A category may gain rows when the next page arrives. Do not ask the API for one page per aisle.

The groceries badge (`useGroceriesLeft`) counts unchecked rows on the loaded page. Use `GET /shopping-list?done=false&page=1&pageSize=1` and `meta.total` instead.

## How the scroll view asks for the next page

Cookbook `TabList` already renders a FlashList. Pass `onEndReached` and `onEndReachedThreshold={0.6}`. Guard with `hasNextPage && !isFetchingNextPage && !isError`. `listKey` already remounts the list when the grid toggles; also change it when the filter key changes so the scroll position returns to the top.

Collections and the groceries/pantry `ScrollView`s have no `onEndReached`. From `onScroll`, when the remaining distance is under 480px, call the same guarded `fetchNextPage`. One in-flight request at a time.

First load (`isLoading` and no pages) keeps the current placeholders: four `PlaceholderCard`s on the cookbook, the existing grocery/pantry loading state. The next page shows a single footer row, not another set of four cards. `isFetchingNextPage` drives that footer.

If page 1 fails and there is nothing cached, keep the screen’s current error behavior. If page 2+ fails, keep the rows already shown and put a footer on the list: “Couldn’t load more”, which calls `fetchNextPage`. Do not clear the list.

Pull to refresh refetches page 1 only. `refetch()` on an infinite query refetches every loaded page; reset the query (remove it and fetch page 1 again) so a long scroll does not replay ten requests for one gesture. Preserve the rows on screen until page 1 returns (`placeholderData` / the previous pages), then replace them.

Filter changes show the first-load placeholders only when that key has no cached pages. A key the user already loaded paints the cached pages immediately.

## Cache shape

Infinite data is `{ pages: { items, meta }[], pageParams: number[] }`, not `{ items, meta }`.

These patches only recognize a top-level `items` array, so a heart, an edit, or a delete updates the detail cache and skips the cookbook until a refetch:

- `applyEngagement` in `features/recipes/hooks/use-engagement.ts`
- `patchRecipeInCaches` in `use-recipe-editor.ts`
- the delete `setQueriesData` in `recipe-detail.tsx`
- `saved.ts` and `use-review-state.ts`, which use the same `setQueriesData({ queryKey: recipeKeys.all })` pattern

Teach them to walk `pages` when the cache value has `pages`, and to keep patching `{ items, meta }` for the bounded queries. A favorite still `invalidateQueries({ queryKey: recipeKeys.all })` afterwards. The patch is what moves the heart before that refetch returns. Invalidation will refetch every loaded infinite page; that is acceptable.

Deleting a recipe removes the id from every loaded page and decrements `meta.total` on each page’s meta so the subtitle does not wait for the refetch. Removing the row from the flattened list without touching `total` makes `nAll` lie for a moment; do both.

`editShop` / `editPantry` in `tortie/data/groceries.ts` write a single page at `shoppingListKeys.list()` and `pantryKeys.list()`. Point them at the infinite cache:

- Update or delete an item inside whichever page holds that id.
- Prepend a new grocery or pantry item to page 0 (the lists are newest first) and bump `meta.total`.
- If that id is already on a later page, drop the later copy.

`collection` optimistic helpers (`patchListItem`, `withRecipe`, `withoutRecipe`) assume one `CollectionsListPage`. Apply them to each page, or to the page that contains the collection id.

`networkFirst` persists one response per query key. Persist the infinite result under the infinite key (the `pages` array), and also persist each bounded `recipeKeys.list` page as today. On launch, seed the infinite query from that persisted value so the cookbook is not blank, then refresh page 1. A persisted page from the old `['recipes', 1, 100, …]` key will not match the new infinite key. Leave it; the next successful fetch writes the new key. Do not migrate the old blob.

`query-keys.ts` documents the key table at the top of the file. Update that comment: infinite keys, freshness (reuse `recipesList`, `collections`, `shoppingList`, `pantry`), and the note that `recipeKeys.all` still invalidates both the bounded pages and the infinite pages.

## Callers that must see every row

These are not scroll views. They still have to follow `totalPages`, because one response holds at most 100 rows.

| Caller | Loop |
|---|---|
| `knownRecipeIds` in `features/kitchen/migration.ts` | `listRecipes` until `page >= totalPages` |
| pantry staple scan in the same file | `listPantryItems` the same way |
| `features/collections/flush.ts` | `listCollections` the same way |
| `use-kitchen-migration.ts` pantry `list: () => listPantryItems({ page: 1, pageSize: 100 })` | the migration function loops; the injected `list` can stay a single-page function if the migration calls it with a page argument |

Update `migration-test.ts`, `flush-test.ts`, and `query-cache-test.ts` so a second page is included. A fixture with `totalPages: 2` that only returns page 1 should fail.

`features/home/__tests__/prefetch-test.ts` should expect the new prefetch key.

## Tests

Unit tests, in the existing `__tests__` folders:

- `getNextPageParam` returns the next page, and `undefined` when `page === totalPages` or `totalPages === 0`.
- Flattening `[page1, page2]` with a shared id keeps one row, the earlier page’s copy.
- Mapping cookbook state (`RF`, query string, collection id) onto the recipe query string. Cover `sort=time`, `favorite=true`, `maxMinutes`, comma-separated `difficulty`, and `collectionId`.
- `matchesQuick` stays the chip filter. Add a case that a page of non-matches still asks for the next page when `hasNextPage` is true, and stops when it is false. That can be a pure helper the effect calls.
- Cache patch: an infinite `{ pages }` value gets `isFavorite` updated, and a `{ items }` value still does too.
- Migration walks two pages.

## Check on a device or simulator

The cookbook is the main path. Seed or import more than 20 recipes.

- The first screen paints about 20 cards. Scrolling to the bottom appends the next 20, once, with a footer while the request is in flight. The footer goes away. The last page does not fire another request.
- Switching All → Under 30 min, A–Z, Saved, or a collection resets to the top and page 1. The subtitle count matches `meta.total`, including a saved count taken from `favorite=true`, not from the visible cards.
- A quick chip that matches nothing shows the empty state after the last page, not a spinner.
- Pull to refresh replaces from page 1 and does not leave a duplicate of a card from page 2.
- Heart a card on page 2. The heart sticks. Delete a recipe. It leaves the grid and the count drops.
- Groceries and pantry: with more than 20 items, scrolling loads the rest, and aisle groups still include the new rows. The tab badge equals the unchecked total, including items not yet scrolled into view.
- Today still shows tonight and Cook again without loading the whole cookbook. Profile still shows the full recipe count.
- Airplane mode with a persisted first page shows those cards, then recovers when the network returns.

## Done when

- Cookbook, collections, groceries, and pantry append pages until `meta.totalPages`.
- Today, plan, profile, and sign-in read a bounded page or `meta.total`, and still show the right count and titles.
- Optimistic heart, edit, and delete update infinite caches.
- Migration and collection flush see rows past the first 100.
