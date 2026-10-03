# Todo

## Cook history screen

The session API already stores past cooks (`COMPLETED` / `STOPPED`, timestamps, per-step time and visit counts). Nothing in the app lists them yet. Kitchen → Cooked is a local `cookedCounts` list of recipes, not session history. You → “Cooking history” is a toast stub.

---

### Implementation prompt

```
Implement a cooking history UI in the Recipe mobile app. The backend already has the data. Do not add notes, servings, or away-time tracking. This task is list + detail for past cook sessions.

## Context

Repo: /home/george/Desktop/Recipe
Mobile: apps/mobile (Expo Router, NativeWind, TanStack Query)
API: apps/api (Fastify, Prisma, /api/v1)

### Session model (already shipped)

Statuses: IN_PROGRESS | COMPLETED | STOPPED
- Stop on the Home “COOKING NOW” card → STOPPED
- Finish the last cook step / complete screen → COMPLETED
- Starting a different recipe stops the previous session → STOPPED
Home only shows IN_PROGRESS.

Each session already includes:
- id, recipeId, status, currentStepIndex
- startedAt, finishedAt, createdAt, updatedAt
- totalDurationMs
- steps[]: stepIndex, visitCount, durationMs, firstEnteredAt, lastEnteredAt
- recipe: { id, title, stepCount }

API:
- GET /api/v1/cook-sessions?page&pageSize&status=
- GET /api/v1/cook-sessions/:id
- List is ordered by updatedAt desc
- status filter is a single enum value. Listing “past cooks” needs COMPLETED + STOPPED. Either:
  1. Call the list endpoint twice and merge, or
  2. GET /cook-sessions (no status) and drop IN_PROGRESS on the client, or
  3. Small API change: allow repeated/comma status, or statusIn, or exclude IN_PROGRESS
  Prefer (3) if it stays a thin query change. Do not invent pagination-breaking hacks.

Mobile already has:
- apps/mobile/src/features/cook-sessions/api.ts (listCookSessions, getCookSession)
- apps/mobile/src/features/cook-sessions/hooks.ts (useCookSessions, useCookSession, cookSessionKeys)
- apps/mobile/src/features/cook-sessions/types.ts + schemas.ts

### Current UI holes

1. apps/mobile/src/app/(tabs)/you.tsx — row “Cooking history” with hint `${cooked} sessions` (local cookedCounts sum). onTap shows toast “Cooking history — prototype stub”. This is the primary entry point.
2. Kitchen tab “Cooked” stays as-is (recipe-level local counts). Do not replace it unless you add a small “See session history” link. Default: leave Kitchen Cooked alone.
3. Seed recipes (id starts with `seed:`) never create API sessions. History is API-only.

## Product

### List screen

Route: apps/mobile/src/app/history.tsx (stack, same pattern as shop.tsx / search.tsx).
Open it from You → Cooking history (replace the stub).

Show ended sessions only (COMPLETED and STOPPED), newest first.

Each row:
- Recipe title (session.recipe.title)
- Date from startedAt (local timezone, e.g. “30 Aug 2026”)
- Duration from totalDurationMs (e.g. “24 min”)
- Status chip: Completed (basil) vs Stopped (olive/sage) — use theme tokens in apps/mobile/src/theme/tokens.ts, no new palette
- Tap → history detail

Empty: “No cooks yet.” + CTA to Explore.
Loading: Skeleton, same style as LatestAddedSection.
Error: caption + Retry, same pattern as LatestAddedSection.

You-tab hint: use API history count (completed + stopped), not local cookedCounts.

Filter chips on the list (optional but preferred): All | Completed | Stopped.

Pagination: first page pageSize 20 is enough. Add “Load more” if totalPages > 1. Do not over-build infinite scroll.

### Detail screen

Route: apps/mobile/src/app/history/[id].tsx
Load GET /cook-sessions/:id (useCookSession).

Show:
- Title
- Status
- Date
- Start time / end time from startedAt / finishedAt
- Total time (totalDurationMs)
- Per-step breakdown: “Step N”, duration, visit count (e.g. “2 visits · 4 min”)
- Primary CTA: open /recipe/{recipeId}
- Secondary CTA: cook again → useStartCooking(recipeId, { reset: true }) then router.push(`/cook/${recipeId}`)

If the recipe was deleted, show the stored title and hide/disable recipe navigation.

### Visual / code style

- Screen, SectionLabel, Text variants, Chip, Button, Skeleton from apps/mobile/src/components/ui
- fonts.manrope* / fonts.mono* and colors.* from theme tokens
- Match Home / Kitchen spacing (px-5, rounded-[20px], linen/crust cards)
- Accessibility: header role, button names, list rows as buttons
- No new state libraries. React Query only.
- Keep changes in cook-sessions + history screens + the You row. Do not refactor cook-store.

## Tests

Mobile:
- You row navigates to /history (no stub toast)
- History list renders completed + stopped fixtures, hides IN_PROGRESS
- Empty and error states
- Stop on Home still hides COOKING NOW (existing home-test must stay green)

API (only if you change the list query):
- Filter ended sessions without returning IN_PROGRESS

## Out of scope

- Session notes, servings cooked, pausing the clock when backgrounded
- Replacing Kitchen → Cooked
- Analytics dashboards, charts, share/export
- Editing or deleting history (DELETE exists; do not expose it unless a swipe-to-delete is trivial and tested)

## Done when

George can open You → Cooking history, see past COMPLETED and STOPPED sessions with date/duration/status, open a session to see per-step time and visits, jump to the recipe, and cook again. IN_PROGRESS never appears in history. Seed-only cooks may be absent (API-only is correct).
```
