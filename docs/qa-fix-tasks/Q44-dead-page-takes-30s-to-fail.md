# Q44. A dead page on a scraper-blocking site takes ~30 s to fail

🟡 Low · API · Found in the manual test of PR #20 (2026-10-18). Related to [Q05](Q05-site-access-and-failures.md).

## Problem

`https://www.simplyrecipes.com/recipes/does-not-exist-xyz-123/` ends as `NOT_FOUND` ("This link doesn't exist or has been removed") only after about 30 s. The site answers every direct request from the server with 402, so the importer treats it as blocked, falls back to Apify (`web.fetch-fallback`, 29 s), and Apify reports the 404. It is not a retry loop, but Q05's "fails fast" does not hold for this case.

## Root cause (verified in the logs)

`generic-web-content-provider.ts`: a status in `BLOCKED_STATUSES` (401, 402, 403, 429, 503) always triggers the Apify fallback, even when the URL is a made-up path on a host that blocks everything.

## Fix

Options, simplest first: (a) show a "checking this page" state during the fallback so 30 s is not silent (see [Q07](Q07-import-progress-truthful.md)); (b) lower the Apify fallback timeout for generic pages; (c) probe the site root first and skip the fallback when the root is also blocked and the path looks invalid.

## Acceptance criteria

- A dead URL on a blocking site fails in under 15 s, or the progress UI says what is happening during the wait.

## Tests

- `blocked-page-fallback.test.ts`: the fallback timeout is honored.
