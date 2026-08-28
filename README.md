# Recipe

Nx monorepo for the Recipe mobile app and extraction API.

| App | Path | Stack |
| --- | --- | --- |
| **mobile** | `apps/mobile` | Expo SDK 57, React Native, TypeScript |
| **api** | `apps/api` | Fastify, TypeScript, PostgreSQL, BullMQ |

The original **Recipe API** project on Desktop is unchanged. This repo contains a copy under `apps/api`.

## Requirements

- **Node.js** 22.13 or later (`.nvmrc` pins 24)
- **npm** 10 or later
- **Docker** (optional) for Postgres, Redis, and containerized API/worker

## Installation

```bash
npm install
cp apps/mobile/.env.example apps/mobile/.env
cp apps/api/.env.example apps/api/.env
```

`apps/api/.env` is required for the API. Fill in secrets locally — it is gitignored.

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

Equivalent npm scripts:

```bash
npm start                # mobile
npm run dev:api
npm run dev:worker
```

Postgres and Redis for the API:

```bash
docker compose up postgres redis
```

Full API stack in containers:

```bash
docker compose --env-file apps/api/.env up --build
curl http://localhost:3000/health
```

## Testing, lint, types

```bash
npx nx test mobile
npx nx test api
npx nx run-many -t test

npx nx lint mobile
npx nx lint api
npx nx run-many -t lint

npx nx typecheck mobile
npx nx typecheck api
npx nx run-many -t typecheck
```

```bash
npx nx graph
```

## Layout

```text
apps/mobile     Expo app
apps/api        Extraction API + worker
packages/       Shared libraries (none yet)
```

Each app keeps its own `package.json`, tooling, and README:

- [apps/mobile/README.md](apps/mobile/README.md)
- [apps/api/README.md](apps/api/README.md)
- [apps/api/architecture.md](apps/api/architecture.md)
