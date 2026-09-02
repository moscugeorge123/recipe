# Recipe

Nx monorepo for the Recipe (Mise) mobile app and extraction API.

| App | Path | Stack |
| --- | --- | --- |
| **mobile** | `apps/mobile` | Expo SDK 57, React Native, TypeScript |
| **api** | `apps/api` | Fastify, TypeScript, PostgreSQL, BullMQ |

## What users get

A clean install and a populated upgrade complete the same journeys: import a URL, review the extracted recipe, edit without destroying the original, calculate nutrition, favorite/rate/note, file into a collection, match pantry items, finish cooks, and see Home rank **Last uploaded** (`sort=latest`) separately from **My recipes** (`sort=engagement`: favorites first, then completed cook count).

There is **one implicit profile** until authentication ships. All kitchen data lives on the API (not only in AsyncStorage). Missing USDA/OpenAI keys fail visibly and non-destructively: recipes still save and cook; nutrition/pantry AI fall back instead of wiping input.

## Requirements

- **Node.js** 22.13 or later (`.nvmrc` pins 24)
- **npm** 10 or later
- **Docker** (optional) for Postgres, Redis, and containerized API/worker
- **yt-dlp** and **FFmpeg** on the host if you run the worker outside Docker

## Installation

```bash
npm install
cp apps/mobile/.env.example apps/mobile/.env
cp apps/api/.env.example apps/api/.env
```

`apps/api/.env` is required for the API. Fill in secrets locally — it is gitignored.

Optional production-like keys (never required for tests):

- `OPENAI_API_KEY` — live extraction and pantry organization of unknown text
- `USDA_FDC_API_KEY` — live nutrition (FoodData Central)

## Development

From the repository root:

```bash
npx nx start mobile      # Expo dev server
npx nx android mobile
npx nx ios mobile
npx nx web mobile

npx nx dev api           # Fastify API with reload
npx nx run api:dev:worker
```

The worker process consumes **extraction** and **nutrition** queues. Preview/import HTTP stays on the API; media/AI/nutrition jobs run on the worker.

Postgres and Redis:

```bash
docker compose up postgres redis
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/recipe_api npm run db:migrate:deploy -w api
```

Full API stack in containers:

```bash
docker compose --env-file apps/api/.env up --build
curl http://localhost:3000/health
curl http://localhost:3000/api/v1/ops/summary
```

## Quality gates

Preferred (from the repository root):

```bash
npx nx run-many -t typecheck lint test
```

That runs **api**, **mobile**, and **contracts**. Database-backed API tests use `recipe_api_test` only (never `recipe_api`). Apply migrations first:

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/recipe_api_test npm run db:migrate:deploy -w api
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/recipe_api_test npx prisma migrate status --schema apps/api/prisma/schema.prisma
npx nx test api
npx nx test:ci mobile
```

If the full Nx run is too heavy, per-package:

```bash
npx nx typecheck api && npx nx test api
npx nx typecheck contracts
npx nx test:ci mobile
```

**Environment-only exclusions**

- API database integration tests `skipIf` when Postgres is unreachable.
- Tests never call live OpenAI or USDA (`NODE_ENV=test` uses fakes).
- Maestro is not part of `nx test`. It needs the Maestro CLI and a **development or preview build** of `com.recipe.app`. Expo Go is not a reliable target for API-backed screens (import review, recipe detail, nutrition, history). YAML still lives under `apps/mobile/.maestro/flows` as best-effort flows.
- Mobile Jest sets `forceExit` because React Native `TextInput` typing leaves open handles after assertions. Tests still run and fail on real errors.

```bash
# after installing Maestro and a native build
npm run e2e -w mobile
```

## Known limitations

- Facebook and TikTok extraction remain stubs (`UNSUPPORTED_SOURCE`).
- No login yet; all devices talking to one API share the singleton profile.
- Recipe detail **Original source** is still a “coming soon” toast; revision history and edit work.
- You → Cooking history is a prototype stub.
- USDA 429s and revision conflicts are visible in logs, not as stored counters.
- Missing `USDA_FDC_API_KEY` / `OPENAI_API_KEY` leaves nutrition unavailable or pantry on dictionary/fallback; recipes, notes, and drafts are not discarded.

## Identity, data, and revisions

- **Singleton profile:** `00000000-0000-4000-8000-000000000001`. Controllers read `request.profile`. Replace `ImplicitProfileResolver` and the `AUTHENTICATION EXTENSION POINT` in `apps/api/src/app/app.ts` when login exists. `/health` stays public.
- **Ownership:** recipes, categories, notes, collections, pantry, cooks, and ratings are scoped to that profile. Other users’ rows 404.
- **Revisions:** import writes immutable revision 0. Each save appends a complete snapshot. `expectedRevisionNumber` conflicts return `409 RECIPE_REVISION_CONFLICT`. Restore creates a new head; it never deletes history.
- **Ingredient AI policy:** dictionary + cache first, then `gpt-5-nano`, `gpt-4.1-nano` compatibility fallback, limited `gpt-4o-mini` escalations. Budgets and model names are env-only (see `apps/api/.env.example`). Never GPT-5.6.

## Operators

`GET /health` and `GET /api/v1/health` — liveness; production also probes Postgres and Redis.

`GET /api/v1/ops/summary` — aggregated AI tokens/cost/cache/escalation, USDA cache sizes, nutrition statuses, pantry fallback rate, queue in-flight counts, applied Prisma migrations. No titles, notes, or pantry names. USDA 429s and revision conflicts are **not** stored; the payload includes log filters.

## Layout

```text
apps/mobile     Expo app
apps/api        Extraction API + worker
packages/contracts  Shared Zod/OpenAPI contracts
```

- [apps/mobile/README.md](apps/mobile/README.md)
- [apps/api/README.md](apps/api/README.md)
- [apps/api/architecture.md](apps/api/architecture.md)
