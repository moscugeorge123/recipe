# F1. Paginate list endpoints

The app asks each list for one page, and `pageSize` cannot exceed 100 (`MAX_PAGE_SIZE` in `apps/api/src/shared/pagination/pagination.ts`). Anything past that page never leaves the database. A few list responses still load the whole set and stamp a fake `meta` on the way out. Collection summaries load every member recipe even though the collection rows themselves are paged.

This task makes every scrollable list a real page, with a stable order and the filters the cookbook already applies on the client. It keeps the existing `page` / `pageSize` contract. [F2](F2-infinite-loading.md) walks those pages in the app.

Depends on nothing. F2 depends on this.

## Contract

Keep `apps/api/src/shared/pagination/pagination.ts`. Do not add a cursor, a `hasMore` flag, or a second query shape.

- `page` is 1-based. Default `1`. Integers below 1 are 400.
- `pageSize` is 1–100. Default `20`. `0` and values above 100 are 400.
- A page past the end is 200 with `data: []`. `meta.total` and `meta.totalPages` still describe the filtered set. `meta.page` is the requested page.
- `meta.total` is the count after filters, before skip/take.
- `totalPages` is `0` when `total` is `0`, otherwise `ceil(total / pageSize)`.
- The envelope stays `{ data, meta }` from `collectionResponse` in `apps/api/src/shared/http/response.ts`.
- Every list order ends with a unique column (`id`, or `recipeId` where that is the row identity) so two rows cannot tie. Without that, an insert between page fetches duplicates one row and skips another.
- Filters and sorts apply in the database. Do not load the table and slice in JavaScript, except the log reader, which stays as it is (see below).

`paginationQuerySchema` already coerces numeric strings, and `pagination.test.ts` covers the bounds. Extend that file only if the shared helper changes. New behavior belongs in the integration tests named below.

## What already pages in the database

These accept `page` and `pageSize`, `skip` / `take`, and a `count` in the same query. Leave the envelope alone. This task still changes their `orderBy`, and the recipe list gains filters.

| Endpoint | Query schema | Repository `list` | Order today | Tie-break |
|---|---|---|---|---|
| `GET /api/v1/recipes` | `listRecipesQuerySchema` | `PrismaRecipeRepository.list` | `latest`: `createdAt desc`. `engagement`: favorite, cook count, `updatedAt` | `id asc` already |
| `GET /api/v1/pantry` | `listPantryQuerySchema` (`category` optional) | `PrismaPantryRepository.list` | `updatedAt desc` | missing |
| `GET /api/v1/shopping-list` | `listShoppingListQuerySchema` (`done` optional) | `PrismaShoppingListRepository.list` | `createdAt desc` | `id desc` already |
| `GET /api/v1/cook-sessions` | `listCookSessionsQuerySchema` (`status` optional) | `PrismaCookSessionRepository.list` | `updatedAt desc` | missing |
| `GET /api/v1/collections` | `listCollectionsQuerySchema` | `PrismaCollectionRepository.list` | `updatedAt desc`, `name asc` | missing |
| `GET /api/v1/dashboard/imports` | `paginationQuerySchema` | `DashboardService.listImports` | already paged | leave |

`ShoppingListService.loadPantryKeys` already walks pantry pages at `pageSize` 100 until `keys.length >= total`. That loop is the pattern for any server code that needs the whole set.

## What still returns the whole set

These handlers build `meta` with `page: 1` and `pageSize: <array length>` after loading every row.

| Endpoint | Where | Order to use once paged |
|---|---|---|
| `GET /api/v1/recipes/:id/notes` | `recipes.controller.ts` `listNotes` | `createdAt desc`, `id desc` |
| `GET /api/v1/recipes/:id/revisions` | `recipes.controller.ts` `listRevisions` | `revisionNumber desc`, `id asc` |
| `GET /api/v1/collections/:id` | `recipes` array on the detail. `findById` includes every `CollectionRecipe` with the full recipe graph | `sortOrder asc`, `userRecipeId asc` |
| `GET /api/v1/categories` | `categories.routes.ts` | leave the full list |

`GET /api/v1/collections` is paged as a list of collections, but each row `include`s every member and maps it through `toMemberRecord` (latest revision, categories, ingredient and step counts) only to throw the recipes away and keep `recipeIds` and four covers. A page of 20 collections still loads every recipe in those collections.

## Leave these as they are

- `GET /api/v1/meal-plan` returns `{ data: MealPlanEntry[] }` for a `from`/`to` range capped at 42 days (`listMealPlanQuerySchema`). The range is the page. The plan screen is a week, not a growing catalog.
- `GET /api/v1/categories` stays the full ordered set. The editor and cookbook chips need every category. The set is small (`sortOrder`, then `name`). Keep the synthetic meta.
- `GET /api/v1/dashboard/logs` already takes `page` / `pageSize`, then `FileLogReader` reads the log files and slices in memory. Leave that reader. The dashboard page is not part of F2.
- `GET /api/v1/dashboard/imports` already pages. The dashboard `ImportsPage` requests `page=1&pageSize=50` and stops. That UI is out of scope.
- Single resources (`/recipes/:id`, `/collections/:id` except its `recipes` array, job status, ops summary, health).
- POST/PUT responses that return an array of rows just written (`POST /pantry/items`, `POST /shopping-list/items`, reorder). Those are the result of the write, not a catalog.

## Do

### 1. Stable order

Add the missing tie-break on every list this task touches. Direction follows the primary key: `asc` when the primary is `asc` or a rank, `desc` when the primary is `desc`.

| List | `orderBy` after this task |
|---|---|
| Pantry | `updatedAt desc`, `id desc` |
| Cook sessions | `updatedAt desc`, `id desc` |
| Collections | `updatedAt desc`, `name asc`, `id asc` |
| Collection members | `sortOrder asc`, `userRecipeId asc` |
| Notes | `createdAt desc`, `id desc` |
| Revisions | `revisionNumber desc`, `id asc` |
| Shopping list | unchanged (`createdAt desc`, `id desc`) |
| Recipes `latest` / `engagement` | unchanged (already end in `id asc`) |

New recipe sorts are in the next section.

### 2. Recipe list filters and sorts

`GET /api/v1/recipes` is the cookbook. Today the app downloads one page and then filters it in `useCookbookView` (`apps/mobile/src/tortie/data/cookbook.ts`). A later page can never match. Add the filters that are real columns. Keep `q`, `cuisine`, and `sourceType`.

Extend `listRecipesQuerySchema`:

| Query | Meaning |
|---|---|
| `collectionId` | UUID. Only recipes in that collection for this user. Another user's collection, or an unknown id, is an empty page (`total: 0`), not 404, so the response does not reveal that the id exists. |
| `favorite` | `true` or `false`, same parsing style as shopping-list `done`. Omitted means both. |
| `difficulty` | Comma-separated `Easy`, `Medium`, `Hard`. Omitted means all. One unknown token is 400. |
| `maxMinutes` | Integer ≥ 1. Keep recipes whose head-revision total time is from 1 through this value. `null` and `0` stay out, which matches the app (`r.time > 0`). |
| `sort` | `latest` (default), `engagement`, `title`, `time`, `cooked`. Unknown values stay 400. |

Sorts:

| `sort` | Order |
|---|---|
| `latest` | `createdAt desc`, `id asc` |
| `engagement` | `isFavorite desc`, `completedCookCount desc`, `updatedAt desc`, `id asc` |
| `title` | head title A→Z, case-insensitive, then `id asc` |
| `time` | head `totalTimeMinutes` ascending, nulls last, then `id asc` |
| `cooked` | `completedCookCount desc`, `id asc` |

`title`, `totalTimeMinutes`, and `difficulty` live on `RecipeRevision`, not on `UserRecipe`. The list already displays the head revision (`revisions` ordered by `revisionNumber desc`, `take: 1`). Filters and the new sorts must use that same head.

`buildListWhere` matches `q`, cuisine, and (after this task) time and difficulty with `revisions.some`. That predicate is true for an old revision, so a recipe whose current time is 90 minutes still matches `maxMinutes=30` if revision 0 was 20 minutes. Pin `q`, `cuisine`, `difficulty`, `maxMinutes`, and the `title` / `time` sorts to the head revision.

Prisma cannot `orderBy` a field of “the related row with the greatest `revisionNumber`”. Copy `listTitle`, `listTotalTimeMinutes`, and `listDifficulty` onto `UserRecipe` (names can follow the repo’s style), write them in the same transaction that creates a revision, and backfill existing rows from the current head. Index them. The JSON list item still comes from the head revision include, so the response shape does not grow new fields. If a join can do the same filter and order without the columns, use the join. Either way, an older revision must not decide membership or order.

`q` keeps searching the head revision’s title, description, cuisine, and ingredient `name` / `canonicalName`.

`collectionId` is `collectionEntries.some.collectionId` plus `userId` on the `UserRecipe`. Combine it with the other filters with `AND`.

`meta.total` counts the filtered set. The cookbook subtitle (`nAll`) and a `favorite=true&pageSize=1` request both rely on that count.

Quick chips in the app (`veg`, `sea`, `slow`, `bake`) are word lists in `matchesQuick`. Do not turn those regular expressions into SQL.

### 3. Collection list must stop loading every member recipe

`PrismaCollectionRepository.list` includes `recipes` with `memberInclude` (recipe, source, head revision, categories, counts) for every member, then `toSummary` discards `recipes`.

For the list query, load only what `collectionSummarySchema` returns:

- collection columns
- `recipeCount` via `_count`
- `recipeIds` as the ordered recipe ids (`sortOrder asc`, `userRecipeId asc`) without the revision graph
- `coverPreviews`: the first 4 members only (`COVER_LIMIT`), with title and thumbnail

`GET /api/v1/collections/:id` still returns the full summary fields plus a `recipes` array. `recipeIds`, `recipeCount`, and `coverPreviews` stay complete when the recipe array is paged, because the cookbook uses `recipeIds` for membership and the four covers for the tile. Covers are the first four by `sortOrder`, not the first four of the current page.

### 4. Opt-in paging where the client still expects every row

Notes, revisions, and `GET /collections/:id` `recipes` are fetched today with no query string (`listRecipeNotes`, `listRecipeRevisions`, `getCollection`). A new default of 20 would hide rows the app already shows.

When the request omits both `page` and `pageSize`, respond as today: the full list, and meta `{ page: 1, pageSize: <length or 1 when empty>, total, totalPages: 1 or 0 }`. Detect “omitted” before Zod applies defaults. A dedicated schema (both fields optional, no `.default()`) is the straightforward way. Validate a present value with the same rules as `paginationQuerySchema` (integers, `page >= 1`, `pageSize` 1–100).

When either `page` or `pageSize` is present, fill the missing one from the defaults (`page` 1, `pageSize` 20) and `skip` / `take` in the database. `meta` then describes that slice, and `total` is the full count.

`GET /recipes`, pantry, shopping list, cook sessions, collections, and dashboard imports already default omitted params to page 1 and size 20. Leave those defaults. Clients that pass `pageSize=100` still receive one page of 100.

### 5. Indexes

Add indexes that match the new order and filters. Follow the existing `@@index` / `map:` style in `apps/api/prisma/schema.prisma`.

| Needed for | Index |
|---|---|
| Shopping list order is `createdAt, id`, while the current index is `[userId, done, updatedAt]` | `[userId, done, createdAt, id]` |
| Collection member page | `[collectionId, sortOrder]` on `CollectionRecipe` |
| Recipe `cooked` and `favorite` filters beside the existing engagement index | `[userId, completedCookCount, id]` and `[userId, isFavorite, createdAt, id]` if the new sorts are not already covered |
| Head-revision copies, if you add those columns | `[userId, listTitle]`, `[userId, listTotalTimeMinutes, id]`, `[userId, listDifficulty]` |

Pantry `[userId, updatedAt]` and cook sessions `[userId, updatedAt]` can stay; the `id` tie-break is only there for equal timestamps. Add a matching index if a query plan shows a sort of the whole user set.

Ship a Prisma migration. Backfill any new `UserRecipe` columns in that migration from the head revision (`revisionNumber` max per `userRecipeId`).

### 6. Callers that treat 100 as “all”

`MAX_PAGE_SIZE` is 100. These callers take one page and drop the rest. F2 teaches the app to loop. On the server, no list method should grow a hidden “return everything” path.

- `apps/mobile/src/features/kitchen/migration.ts` `knownRecipeIds` and the pantry name scan (`page: 1, pageSize: 100`)
- `apps/mobile/src/features/collections/flush.ts` and `useCollections` (`pageSize: 100`)
- `apps/mobile/src/features/pantry/hooks.ts` and `shopping-list/hooks.ts`
- `useTRecipes` via `COOKBOOK_PAGE_SIZE` (100) in `apps/mobile/src/tortie/data/recipes.ts`

## Tests

Integration tests live in `apps/api/tests/integration/api/`. Follow `recipe-engagement.test.ts` (it already checks `page`, `pageSize`, `total`, `totalPages` for engagement sort).

Cover:

- Recipe page 2 does not repeat page 1, and the union of pages of size 1 equals the full id list, including two recipes that share `createdAt`.
- `sort=title` is case-insensitive and stable. `sort=time` puts null times after timed recipes. `sort=cooked` orders by `completedCookCount`.
- `maxMinutes=30` excludes a recipe whose head time is 45 even when an older revision was 20. Same idea for `difficulty` and `q` against an old title.
- `favorite=true` and `collectionId` combine with `sort=latest`. A collection id the user does not own returns `total: 0`.
- `page=5` on a 2-row list is 200, `data: []`, `total: 2`.
- `pageSize=101` and `page=0` stay 400.
- Notes and revisions: no query returns every row; `page=1&pageSize=1` returns the newest note and the highest `revisionNumber`, with `total` equal to the full count.
- `GET /collections/:id?pageSize=1` returns one recipe in `sortOrder`, while `recipeIds.length` and `recipeCount` still equal the full membership. No query returns every recipe.
- `GET /collections` on a collection of many recipes does not select revision, ingredient, or step rows for every member. Assert with a query log or by the shape of the repository call, and assert `coverPreviews` has length at most 4.
- Pantry and cook-session pages are stable when two rows share `updatedAt`.

`platform-journey.test.ts` and `shopping-list.test.ts` call these lists with no page params. Those calls must keep returning the rows they create.

## Done when

- Every scrollable list above either pages in SQL or is listed under “Leave these as they are”.
- Orders are unique.
- Recipe filters match the head revision.
- Collection summaries no longer hydrate every member recipe.
- Omitting `page` and `pageSize` on notes, revisions, and collection detail still returns the full list.
- Integration tests above pass.
