# Import ledger

Internal ops dashboard for the recipe-import pipeline. It shows:

- Imported recipes and the steps required to import each one
- Tokens used, by model, and what that cost
- Third-party API cost (Apify, yt-dlp, and similar)
- Total cost per recipe (model usage plus third-party)
- Application logs
- Time per import step, so slow steps are obvious

## Fixtures

Sample ledger, with no API process:

```bash
npx nx run dashboard:dev:fixtures
```

From this directory:

```bash
npm run dev:fixtures
```

Open http://localhost:5173. The rail reads **Fixtures**.

## Live API

Start the API on port 3000, then from this directory:

```bash
npm run dev
```

The app requests `/api/v1/dashboard/*` on the same origin. Vite proxies `/api` to `http://localhost:3000`, so the browser does not talk to the API host directly and CORS is unnecessary.

Leave `VITE_USE_FIXTURES` unset or `false` (see `.env.example`). If a live request fails, the screen shows the error and a retry button. Fixture data is not substituted for a failed request.

## Checks

```bash
npm test
npm run typecheck
npm run build
npm run lint
```
