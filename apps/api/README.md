# Recipe Extraction API

This app lives in an Nx workspace. From the **repository root**:

```bash
npm install
cp apps/api/.env.example apps/api/.env
npx nx dev api
npx nx run api:dev:worker
npx nx test api
docker compose --env-file apps/api/.env up --build
```

Install dependencies from the repository root (`npm install`), not from this folder. App scripts still work with `npm run <script> -w api`.

A production-ready REST API for **asynchronous recipe extraction** from social media and web URLs,
built with **Fastify**, **TypeScript**, **PostgreSQL**, **Redis/BullMQ**, and **Prisma**. Intended
to be consumed by a React Native application and deployed to **AWS ECS/Fargate**.

The HTTP API accepts extraction requests and returns immediately with a job id. A separate **worker**
process executes the multi-stage pipeline (content acquisition → media processing → AI extraction →
normalization → validation) **and** nutrition calculation. See [`architecture.md`](architecture.md)
for the full design.

`POST /api/v1/recipes/preview` unfurls title, author and thumbnails for the import screen without
creating a job. It shares the extract rate limit. Instagram preview is oEmbed/Open Graph only
(never Apify); set `META_APP_ID` + `META_APP_SECRET` for Graph oEmbed. YouTube preview uses public oEmbed plus `i.ytimg.com` stills (never yt-dlp, never downloads).
Extraction still uses yt-dlp on the worker.

Identity is an **implicit singleton profile** (`00000000-0000-4000-8000-000000000001`) until
authentication is wired at the `AUTHENTICATION EXTENSION POINT` in `src/app/app.ts`. Controllers
already read `request.profile`; swapping `ImplicitProfileResolver` is the replacement point.

The scaffold ships with request validation, centralised error handling, structured logging, OpenAPI
documentation, health checks, operational aggregates (`GET /api/v1/ops/summary`), security defaults,
graceful shutdown and a full test suite.

---

## Requirements

| Tool        | Version                     | Notes                                        |
| ----------- | --------------------------- | -------------------------------------------- |
| **Node.js** | `>=22` (24 LTS recommended) | `.nvmrc` pins 24, matching the Docker image. |
| **npm**     | `>=10` (ships with Node)    | The lockfile is at the workspace root.       |
| **Docker**  | Any recent version          | Compose stack: API, worker, Postgres, Redis. |
| **yt-dlp**  | Current release             | Required for YouTube preview/extraction when running the API or worker on the host. `pipx install yt-dlp` or `pip3 install --user yt-dlp`. Compose/ECS images already include it. |
| **FFmpeg**  | Any recent version          | Required on the host worker for audio/frames (`sudo apt install ffmpeg`). The worker image already includes ffmpeg and ffprobe. |

---

## Installation

From the **repository root**:

```bash
npm install
cp apps/api/.env.example apps/api/.env
```

---

## Environment

All configuration comes from environment variables. `src/config/env.ts` validates them with Zod at
startup and **the process exits immediately if anything is invalid**, so a misconfigured container
fails fast instead of serving broken traffic.

`.env.example` documents every variable, its default and why it matters. Copy it to `.env` for local
development — `.env` is git-ignored and must never contain production secrets. In AWS, plain values
come from the ECS task definition and secrets from Secrets Manager or SSM Parameter Store.

| Variable                | Default       | Purpose                                                                    |
| ----------------------- | ------------- | -------------------------------------------------------------------------- |
| `NODE_ENV`              | `development` | `development` \| `test` \| `production`.                                   |
| `HOST`                  | `0.0.0.0`     | Must stay `0.0.0.0` in containers to be reachable.                         |
| `PORT`                  | `3000`        | `0` requests an ephemeral port (used by tests).                            |
| `SERVICE_NAME`          | `api`         | Included in every log line.                                                |
| `SERVICE_VERSION`       | `0.1.0`       | Included in logs and in the OpenAPI document.                              |
| `LOG_LEVEL`             | `info`        | `fatal` … `trace`, or `silent`.                                            |
| `LOG_DIR`               | `./logs`      | Daily files `<service>.YYYY-MM-DD.log`. Empty string disables file logs.   |
| `API_PREFIX`            | `/api/v1`     | Version prefix for application routes.                                     |
| `ENABLE_DOCS`           | _not prod_    | Serves Swagger UI at `/docs`. Off by default in production.                |
| `CORS_ORIGINS`          | _(empty)_     | Comma-separated allow-list. Never a wildcard.                              |
| `TRUST_PROXY`           | `false`       | **Set to `true` behind an ALB** so client IPs and rate limiting are right. |
| `BODY_LIMIT_BYTES`      | `1048576`     | Maximum request body size (1 MiB).                                         |
| `MAX_PARAM_LENGTH`      | `128`         | Maximum length of a single URL path parameter.                             |
| `RATE_LIMIT_ENABLED`    | `true`        | Turns rate limiting on or off.                                             |
| `RATE_LIMIT_MAX`        | `100`         | Requests per window, per client IP, per task.                              |
| `RATE_LIMIT_WINDOW_MS`  | `60000`       | Rate limit window.                                                         |
| `REQUEST_TIMEOUT_MS`    | `30000`       | Aborts requests that exceed it (`0` disables).                             |
| `KEEP_ALIVE_TIMEOUT_MS` | `72000`       | Must exceed the ALB idle timeout (60s) to avoid 502s.                      |
| `SHUTDOWN_TIMEOUT_MS`   | `10000`       | Drain time after SIGTERM. Keep below the ECS `stopTimeout`.                |
| `DATABASE_URL`          | _local default_ | PostgreSQL connection string.                                            |
| `REDIS_URL`             | `redis://localhost:6379` | BullMQ queue backend.                                              |
| `STORAGE_PROVIDER`      | `local`       | `local` or `s3`.                                                           |
| `STORAGE_LOCAL_PATH`    | `./storage`   | Local artifact directory (dev).                                            |
| `OPENAI_API_KEY`        | _(unset)_     | Live extraction/pantry AI. Tests never call OpenAI.                   |
| `AI_INGREDIENT_MODEL`   | `gpt-5-nano`  | Pantry batch model after dictionary/cache. Never GPT-5.6.             |
| `USDA_FDC_API_KEY`      | _(unset)_     | Live nutrition. Tests use a fake catalog. Missing key → unavailable.  |
| `META_APP_ID`           | _(unset)_     | Optional Instagram Graph oEmbed for `POST /recipes/preview`.          |
| `META_APP_SECRET`       | _(unset)_     | Pair with `META_APP_ID`. Preview falls back to Open Graph when unset. |
| `YTDLP_PATH`            | `yt-dlp`      | Binary used for YouTube preview and extraction. Must be on PATH.      |
| `EXTRACTION_MAX_RETRIES`| `5`           | Queue retry limit for transient failures.                             |
| `EXTRACTION_QUEUE_CONCURRENCY` | `2`  | Extraction worker concurrency.                                        |
| `NUTRITION_QUEUE_CONCURRENCY` | `2` | Nutrition worker concurrency.                                        |
| `MAX_VIDEO_DURATION_SECONDS` | `600` | Rejects videos longer than this.                                   |

See `.env.example` for the full list including AI models and external provider tokens.

---

## Development

From the repository root:

```bash
npx nx dev api
npx nx run api:dev:worker
```

Or from this directory (`npm run <script> -w api` also works from the root):

```bash
npm run dev          # API with hot reload
npm run dev:worker   # worker process (requires Redis)
```

Starts the API with hot reload on `http://localhost:3000`, reads `.env` if present, and prints
human-readable logs (`pino-pretty`).

### Full local stack (Docker Compose)

From the repository root:

```bash
docker compose --env-file apps/api/.env up --build
```

This starts **postgres**, **redis**, **api**, and **worker**. Apply migrations against the Compose
database before first use:

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/recipe_api npm run db:migrate:deploy
```

```
http://localhost:3000/health              liveness (ALB)
http://localhost:3000/api/v1/health       same contract, documented
http://localhost:3000/api/v1/ops/summary  operator aggregates (no PII)
http://localhost:3000/docs                Swagger UI
```

### Ingredient-model policy

Pantry organization (and import emoji/category enrichment) is **configuration, not code**:

1. Deterministic dictionary + classification cache.
2. One compact batch to `AI_INGREDIENT_MODEL` (`gpt-5-nano`).
3. Compatibility fallback `AI_INGREDIENT_FALLBACK_MODEL` (`gpt-4.1-nano`).
4. At most `AI_INGREDIENT_MAX_ESCALATIONS` items to `gpt-4o-mini`.
5. Item/token budgets: `AI_INGREDIENT_MAX_ITEMS`, `AI_INGREDIENT_MAX_INPUT_TOKENS`, `AI_INGREDIENT_MAX_OUTPUT_TOKENS`.

Usage lands in `ai_usage`. `GET /api/v1/ops/summary` totals tokens, cost, cache, and escalation calls.

### Data ownership and revisions

Every imported recipe is owned by the singleton profile. `PATCH /recipes/:id` appends an immutable snapshot; the original import (revision 0) is recoverable. Stale `expectedRevisionNumber` returns `409 RECIPE_REVISION_CONFLICT` (logged, not stored as a counter).

### Queue workers

| Queue | Processor | Process |
| --- | --- | --- |
| `extraction-jobs` | `src/worker/processors/extraction.processor.ts` | `npx nx run api:dev:worker` |
| `nutrition-jobs` | `src/worker/processors/nutrition.processor.ts` | same worker |

Tests use in-memory queues so `app.inject()` completes extraction and nutrition without Redis.

## Production

```bash
npm run build        # prisma generate + tsc
npm start            # API
npm run start:worker # worker
```

### Database

```bash
npm run db:migrate        # create/apply migrations (dev)
npm run db:migrate:deploy # apply migrations (CI/production)
npm run db:generate       # regenerate Prisma client
```

Production mode emits single-line JSON logs and disables `/docs` unless `ENABLE_DOCS=true`.

## Docker

```bash
docker build -t api .
docker run -p 3000:3000 api
```

The image is a multi-stage build: dependencies are installed, TypeScript is compiled, and only the
compiled `dist/`, production dependencies and `package.json` are copied into the final
`node:24-alpine` layer. It runs as the unprivileged `node` user, starts Node directly as PID 1 in
exec form so that ECS's `SIGTERM` triggers the graceful drain, and includes a `HEALTHCHECK` that
polls `/health`.

Pass configuration at run time, never at build time:

```bash
docker run -p 3000:3000 \
  -e LOG_LEVEL=debug \
  -e CORS_ORIGINS=http://localhost:8081 \
  -e ENABLE_DOCS=true \
  api
```

`docker-compose.yml` at the repository root builds and runs the API and worker alongside Postgres and Redis. Use
`npx nx dev api` for day-to-day API work — it is much faster.

```bash
docker compose --env-file apps/api/.env up --build
docker compose down          # sends SIGTERM; watch the graceful shutdown logs
```

Both images ship **yt-dlp** (installed at image build, not Alpine’s stale package) so YouTube preview
and extraction work in Compose and ECS. The worker image (`Dockerfile.worker`) also includes
**FFmpeg** and **ffprobe** for media processing. The API image does not include FFmpeg.

## Tests

```bash
npm test              # run everything once
npm run test:watch    # re-run on change
npm run test:coverage # coverage report (text + lcov in coverage/)
```

Tests need no network and no AWS environment. Database integration tests under
`tests/integration/` run when PostgreSQL is reachable (`skipIf` otherwise). They always
target `recipe_api_test`, never `recipe_api`.

```bash
# With Postgres running (e.g. via docker compose up postgres):
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/recipe_api_test npm run db:migrate:deploy
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/recipe_api_test npx prisma migrate status
npm test
```

The focused journey is `tests/integration/api/platform-journey.test.ts` (import → categories/emoji →
immutable edit → nutrition → favorite/rating/note → collection → pantry match → completed cooks →
home ordering). It uses the fake content provider and fake USDA catalog — no live OpenAI/USDA.

`GET /api/v1/ops/summary` is covered by `tests/integration/api/ops-summary.test.ts`.

## Code quality

```bash
npm run lint          # ESLint (type-aware)
npm run lint:fix
npm run format        # Prettier, writes changes
npm run format:check  # Prettier, verifies only
npm run typecheck     # tsc --noEmit over src and tests
```

## API documentation

Swagger UI is served at **`/docs`** and the raw document at **`/docs/json`** (OpenAPI 3.1).

The specification is generated from the same Zod schemas that validate requests and serialise
responses, so it cannot drift from the implementation: change a schema and both the validation and
the documentation change together.

Documentation is enabled outside production by default. To expose it in production, set
`ENABLE_DOCS=true` — preferably behind a protected ALB rule rather than publicly.

---

## API conventions

### Responses

Resource endpoints wrap their payload so that fields can be added later without breaking clients:

```json
{ "data": { "id": "...", "name": "..." } }
```

Collections add pagination metadata:

```json
{
  "data": [],
  "meta": { "page": 1, "pageSize": 20, "total": 0, "totalPages": 0 }
}
```

Health checks are the deliberate exception — load balancers and container agents expect a flat,
minimal document, so `/health` returns `{ "status": "ok" }` unwrapped.

### Errors

Every failure — validation, application error, plugin rejection or unhandled exception — returns the
same envelope:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request",
    "details": [{ "path": "body.name", "message": "name is required" }],
    "requestId": "3f6b1d0e-4c2a-4f21-9a3c-1e5f0b8d9c77"
  }
}
```

Clients should branch on `error.code`, never on `message`. `details` is present for validation
failures. `requestId` matches the `X-Request-Id` response header and the server logs, which makes a
user's bug report traceable to exact log lines.

| Code                     | Status | Meaning                                      |
| ------------------------ | ------ | -------------------------------------------- |
| `VALIDATION_ERROR`       | 400    | Request failed schema validation.            |
| `BAD_REQUEST`            | 400    | Malformed request (e.g. invalid JSON).       |
| `UNAUTHORIZED`           | 401    | Reserved for the future auth layer.          |
| `FORBIDDEN`              | 403    | Reserved for the future authz layer.         |
| `NOT_FOUND`              | 404    | Unknown route or missing resource.           |
| `CONFLICT`               | 409    | Resource already exists.                     |
| `PAYLOAD_TOO_LARGE`      | 413    | Body exceeded `BODY_LIMIT_BYTES`.            |
| `UNSUPPORTED_MEDIA_TYPE` | 415    | Content type has no parser.                  |
| `TOO_MANY_REQUESTS`      | 429    | Rate limit exceeded (`Retry-After` is set).  |
| `INTERNAL_SERVER_ERROR`  | 500    | Unexpected failure; details are in the logs. |
| `SERVICE_UNAVAILABLE`    | 503    | A dependency is unhealthy.                   |

Internal failures always return the generic 500 message. Stack traces, driver errors and internal
identifiers are logged server-side and never serialised into a response — in every environment, not
just production.

### Pagination

`?page=1&pageSize=20`, where `page >= 1` and `1 <= pageSize <= 100`. Invalid values produce a
`VALIDATION_ERROR`. `src/shared/pagination` also provides `toOffsetLimit()`, which converts the
validated query into the `offset`/`limit` pair a database driver expects later.

---

## Architecture

Full design documentation: **[`architecture.md`](architecture.md)**.

```text
src/
├── app/                     HTTP composition (existing)
├── config/env.ts            Zod-validated config (server, database, redis, storage, ai, extraction)
├── modules/                 Domain modules (jobs, recipes, content, extraction, …)
│   ├── jobs/repository/     IExtractionJobRepository
│   └── recipes/repository/  IRecipeRepository, IRecipeSourceRepository
├── infrastructure/
│   ├── database/            Prisma client + repository implementations
│   ├── redis/               ioredis client
│   ├── queues/              BullMQ adapter (Phase 4)
│   ├── storage/             LocalStorageProvider (+ S3 in Phase 10)
│   └── logging/             Pino
├── shared/di/container.ts   Lightweight composition root
├── worker/                  BullMQ worker entry + processors
├── features/                health (+ example demo until Phase 9)
└── index.ts                 API entry
```

Legacy layout notes: `src/features/` still hosts `health` and the demo `example` feature. New domain
code lives under `src/modules/`. See `architecture.md` for the complete target tree.

### Request lifecycle

```text
request
  → request id assigned (X-Request-Id honoured if well formed, else a UUID)
  → security headers, CORS, rate limit
  → route matched
  → Zod validates params / query / body        → 400 VALIDATION_ERROR
  → controller reads validated input
  → service applies business logic             → throws typed AppError
  → response serialised against its Zod schema
  → central error handler formats any failure
  → response logged with status and duration
```

### Why the HTTP layer is thin

Services take plain arguments, return plain values and throw `AppError`s. They import nothing from
Fastify. Consequently the same service can be called from an HTTP route today and from a Lambda
handler, an SQS consumer or a scheduled job later, with no rewrite. Controllers only translate
between HTTP and those calls.

### Adding a feature

1. Create `src/features/<name>/` with `<name>.schema.ts`, `<name>.types.ts`, `<name>.service.ts`,
   `<name>.controller.ts` and `<name>.routes.ts` (copy `example/`).
2. Register the routes plugin in `app.ts` inside the versioned scope.
3. Add unit tests beside the service and API tests under `tests/integration/`.
4. Delete the `example` feature once it is no longer a useful reference.

---

## Logging

Pino writes one JSON object per line to stdout, which is exactly what the ECS `awslogs` driver
forwards to CloudWatch Logs and what Logs Insights can query without pre-processing:

```json
{
  "level": "info",
  "time": "2026-08-19T19:38:20.221Z",
  "service": "api",
  "version": "0.1.0",
  "env": "production",
  "requestId": "b95669a3-7743-4321-86ab-74ae9199b699",
  "res": { "statusCode": 200 },
  "responseTime": 3.73,
  "msg": "request completed"
}
```

The same JSON is also appended to daily files under `LOG_DIR` (default `./logs`, git-ignored):

```
logs/api.2026-08-30.log
logs/worker.2026-08-30.log
```

Set `SERVICE_NAME=worker` on the worker process so its file does not mix with the API. Set
`LOG_DIR=` to disable files (stdout only). Tests never write files. Files older than 14 rotations
are removed.

Pipeline and worker steps log `started` then `completed`/`failed` with `durationMs` and a `step`
field (`pipeline.stage`, `youtube.download`, `ai.transcribe`, `queue.job`, …). If a job hangs, the
last `started` line without a matching `completed` is the step that stalled.

Fastify performs the request/response logging itself. Request ids are available everywhere via
`request.id` and on `request.log`, so every line emitted during a request is correlated automatically.
The worker uses `jobId` the same way.

**What is never logged:** request headers (they carry `Authorization` and `Cookie`), request bodies,
and the client IP address. Pino redaction is configured as a second line of defence for
`authorization`, `cookie`, `x-api-key`, `password`, `accessToken`, `refreshToken`, `idToken` and
`secret` wherever they appear. Failed dependency checks are logged in full server-side but reduced
to `{ name, status, durationMs }` in the public health response.

To include the client IP (useful for abuse investigation, but personal data under some regimes), add
`remoteAddress` to the request serializer in `src/infrastructure/logging/logger.ts`.

---

## Security

Implemented:

- **CORS** from an explicit allow-list; never `*`. Empty by default.
- **Secure headers** via `@fastify/helmet` (CSP, HSTS, `nosniff`, frame options, no `X-Powered-By`).
- **Request body limit** (`BODY_LIMIT_BYTES`) and **URL parameter limit** (`MAX_PARAM_LENGTH`).
- **Rate limiting** per client IP, including on unknown routes so endpoint probing is throttled.
  `/health` is exempt so load balancer polling can never be blocked.
- **Validation of every external input** — params, query and body — via Zod.
- **Prototype pollution rejection** (`__proto__` / `constructor` payloads are refused).
- **Request timeouts** so a slow client cannot hold a connection indefinitely.
- **No sensitive data in logs** and **no internal details in responses**.

A note on CORS and mobile: React Native's `fetch` is not a browser and is not subject to the
same-origin policy, so the mobile app works with an empty `CORS_ORIGINS`. The allow-list exists for
web clients (Expo web, an admin dashboard, local tooling).

### Authentication (replacement point)

There is no authentication and no fake stand-in. The extension points are in place:

- `UnauthorizedError` and `ForbiddenError` already map to 401/403 with the standard envelope.
- `app.ts` contains a commented `AUTHENTICATION EXTENSION POINT`.
- `ImplicitProfileResolver` (`src/modules/profiles/domain/profile.ts`) is the swap target: a future
  JWT resolver should still decorate `request.profile` with `{ userId, mode }`.
- CORS already allows the `Authorization` request header.
- `/health` must remain unauthenticated for the load balancer.
- `GET /api/v1/ops/summary` is unauthenticated while the singleton profile is in use. Gate it when
  auth ships.

---

## AWS deployment

The application is a stateless container that reads configuration from the environment and logs to
stdout. Nothing about it is AWS-specific — no SDK, no AWS-only assumptions — so it runs identically
on a laptop, in Compose, or on Fargate.

### Target architecture

```text
                         Internet
                            │
                            ▼
              Application Load Balancer  (TLS termination, /health target group)
                            │
                            ▼
                       ECS Service  (desired count ≥ 2, rolling deployments)
                            │
              ┌─────────────┴─────────────┐
              ▼                           ▼
       Fargate Task                 Fargate Task
       └── Fastify API              └── Fastify API
              │                           │
              └────────────┬──────────────┘
                           ▼
                   CloudWatch Logs  (JSON lines from stdout)

  Image: ECR   ·   Config: task definition   ·   Secrets: Secrets Manager / SSM
```

### Why it scales horizontally

- **No sessions, no local files, no in-memory application state.** Any task can serve any request,
  so tasks are interchangeable and can be added or replaced freely.
- **The filesystem is treated as ephemeral.** Uploads would go to S3, persistent data to
  RDS/Aurora or DynamoDB, shared cache to ElastiCache.
- **Graceful shutdown** means rolling deployments and scale-in are invisible to clients.

The `example` demo feature has been removed. Real features persist to PostgreSQL.

### Settings that matter on ECS

| Setting                                    | Why                                                                                                          |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `TRUST_PROXY=true`                         | Without it every request appears to come from the ALB, so rate limiting would throttle all clients together. |
| `KEEP_ALIVE_TIMEOUT_MS` > ALB idle timeout | Otherwise the ALB may reuse a connection the app just closed and return 502 to the client.                   |
| ECS `stopTimeout` > `SHUTDOWN_TIMEOUT_MS`  | Gives the app time to drain before the platform sends SIGKILL.                                               |
| Target group deregistration delay          | Lets the ALB stop routing to a task before it finishes draining, avoiding 5xx during deployments.            |
| Health check path `/health`                | Unauthenticated, unthrottled, and independent of dependency state so one outage cannot fail every task.      |
| `awslogs` log driver                       | Ships the JSON log lines straight to CloudWatch.                                                             |

### Graceful shutdown

On `SIGTERM` or `SIGINT` the application stops accepting new connections, lets in-flight requests
finish, runs Fastify `onClose` hooks (where database pools and consumers should be released), and
exits cleanly. A watchdog forces exit after `SHUTDOWN_TIMEOUT_MS` so a stuck request cannot keep a
task alive until SIGKILL.

### Infrastructure as code

None is included, as requested. Nothing in the application constrains that choice: it needs an image
in ECR, a task definition with environment variables, a service behind an ALB target group pointed
at `/health`, and a log group. Add Terraform or CDK under a top-level `infra/` directory when
needed; no application code has to change.

### Lambda (not the primary target)

The primary deployment is ECS/Fargate. Lambda has not been ruled out: business logic, validation and
services are independent of the HTTP server, and `buildApp()` is separate from `startServer()`, so a
Lambda entry point could wrap the app (e.g. with `@fastify/aws-lambda`) or call services directly.

---

## Future extensibility

Each of the following can be added without restructuring what exists:

| Addition           | Where it goes                                                                                                                                                           |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authentication     | `app/plugins/auth.ts` + route-level `preHandler`; errors already defined.                                                                                               |
| Authorization      | Same plugin scope, using `ForbiddenError`.                                                                                                                              |
| Database           | `infrastructure/database/`, exposed via a Fastify decorator, injected into services in each feature's `routes.ts`. Add a health check via `buildApp({ healthChecks })`. |
| S3 / file uploads  | `infrastructure/storage/`; the API returns pre-signed URLs.                                                                                                             |
| Queues, jobs       | `infrastructure/queue/`; consumers reuse the same services.                                                                                                             |
| Notifications      | `infrastructure/notifications/`.                                                                                                                                        |
| Distributed limits | Pass a shared store (ElastiCache) to `@fastify/rate-limit` in `app/plugins/rate-limit.ts`.                                                                              |

---

## Architectural decisions

- **Fastify plugins for third-party concerns, plain functions for our own.** Official plugins are
  registered with `app.register`. Our cross-cutting setup (`registerCors`, `registerErrorHandler`, …)
  are ordinary typed functions applied to the root instance. They behave identically without adding
  a `fastify-plugin` dependency, and the registration order in `app.ts` reads top to bottom.
- **Zod is the single source of truth.** One schema drives request validation, response
  serialisation, the OpenAPI document and the TypeScript types (`z.infer`). Types are never
  hand-duplicated alongside a schema.
- **No repository layer for the demo.** The example feature keeps its data in the service, because a
  fake repository over a `Map` would be indirection that teaches the wrong lesson. A real feature
  introduces a repository when it has a real data store.
- **Errors are thrown, not returned.** Services throw typed `AppError`s and the central handler maps
  them to responses, which keeps controllers free of `try/catch`.
- **Health checks are a registry.** `buildApp({ healthChecks: [...] })` adds probes without touching
  the health feature, and dependency failures degrade the report rather than throwing.
- **`/health` reports dependencies but the ALB check stays simple.** Failing every task because one
  shared dependency is briefly unavailable turns a partial outage into a total one.
- **TypeScript 5.9 rather than 7.x.** TypeScript 7 is stable, but `typescript-eslint` still requires
  `<6.1.0`, so adopting it today would mean giving up type-aware linting. Revisit when the
  toolchain catches up; the codebase itself needs no changes.
- **ESM with `NodeNext` resolution**, so relative imports carry the `.js` extension that Node
  requires at runtime. `strict`, `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` are all
  enabled; there are no `any`s in `src/`.
- **`@typescript-eslint/require-await` is disabled.** Service interfaces and Fastify plugins must
  return promises by contract, so implementations that are synchronous today would otherwise be
  flagged for keeping a signature that will not change when they start doing I/O.
- **The OpenAPI document contains a few unreferenced `*Input`/output component twins.** The type
  provider emits both variants for every registered schema; the trade is worth it for stable, named
  `$ref`s that mobile client generators can use.

---

## Testing strategy

`npm test` runs three layers, all locally:

| Layer                 | Location                      | What it covers                                                                                                                                                      |
| --------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Unit**              | `src/**/*.test.ts`            | Service logic, configuration validation, pagination, the error hierarchy, logger configuration and the shutdown contract.                                           |
| **Integration / API** | `tests/integration/api/` | Real Fastify app via `app.inject()`, including `platform-journey.test.ts`. |
| **Ops**               | `tests/integration/api/ops-summary.test.ts` | Aggregated operator counters. |
| **Integration / DB**  | `tests/integration/database/` | Prisma repositories (requires Postgres). |
| **End-to-end**        | `tests/e2e/*.test.ts`         | A spawned server process: real HTTP requests, real SIGTERM/SIGINT handling, clean exit codes, and the shape of emitted log lines.                                   |

Unit tests sit beside the code they cover, so a feature directory is self-contained. Tests that
exercise the assembled application live under `tests/`.

Notable properties asserted, not just implied: internal errors never leak stack traces or secrets;
health responses never expose dependency error details; request logs never contain headers;
`/health` is never rate limited; and the docs are disabled in production.

```bash
npm run test:coverage   # ~96% statements
```

---

## Remaining manual setup

Nothing is required to run the API locally beyond `npm install`. Before a production deployment you
will need to:

1. **Create the AWS resources**: ECR repository, ECS cluster and service, ALB with a target group
   whose health check path is `/health`, and a CloudWatch log group.
2. **Set the production environment** in the task definition — in particular `NODE_ENV=production`,
   `TRUST_PROXY=true`, `CORS_ORIGINS` for any web clients, and `SERVICE_VERSION` from your build.
3. **Confirm the timeout relationships**: `KEEP_ALIVE_TIMEOUT_MS` above the ALB idle timeout, and
   the ECS `stopTimeout` above `SHUTDOWN_TIMEOUT_MS`.
4. **Add CI** to run `npm run typecheck`, `npm run lint`, `npm run format:check` and `npm test`, then
   build and push the image.
5. **Choose an infrastructure-as-code tool** and add it under `infra/`.
6. **Decide on authentication** (Cognito, Auth0, …) and replace `ImplicitProfileResolver` plus the
   documented extension point in `app.ts`. Gate `/api/v1/ops/summary` at the same time.
7. **Set `USDA_FDC_API_KEY` and `OPENAI_API_KEY`** in production. Missing keys are visible (nutrition
   unavailable, pantry dictionary/fallback) and do not destroy user data.

### Operational log queries

Not every failure is a table row. Use these when `GET /api/v1/ops/summary` says a metric is not persisted:

```text
# USDA 429s (snapshots stay PENDING and are retried)
NutritionRateLimitError   OR   step=nutrition.process

# Revision conflicts (HTTP 409, nothing stored)
error.code=RECIPE_REVISION_CONFLICT

# Pantry fallback / escalation (also in ai_usage.operation)
pantry_organize_cache | pantry_organize_batch | pantry_organize_fallback | pantry_organize_escalation
```
