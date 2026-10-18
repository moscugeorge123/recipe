# Q27. The same recipe is sometimes imported twice

🟠 Medium · API + mobile · Finding **F85**

## Problem

Now and then a shared link ends up in the Cookbook twice. The first QA pass saw the opposite for an identical link ("Duplicate links resolve instantly to the existing recipe", F53), so the cause is not "no dedupe", it is the cases dedupe misses.

## Evidence

Reported on a device; not reproduced in the QA pass. Three candidate causes follow. Causes 1 and 2 are verified in code; cause 3 needs a repro.

## Root cause

1. **The link is not normalised enough (verified).** `normalizeUrl` (`apps/api/src/shared/utils/url.ts`) removes only `utm_*`, `fbclid` and `igsh`. Share sheets add their own parameters, and every share gets a fresh value:
   * YouTube app: `https://youtu.be/<id>?si=<random>`. `si` is not stripped, so every share is a "new" source (new `urlHash`), a new job and a **new recipe**.
   * `youtu.be/<id>` vs `youtube.com/watch?v=<id>` vs `m.youtube.com/…` vs `…/shorts/<id>` are the same video but different hashes.
   * `www.` / non-`www.`, `igshid`, `feature`, `pp`, `ref`, `ref_`, `gclid`, `mc_cid`, `_ga`, trailing `index.html` and the TikTok `_r`/`_t` params do the same.
2. **Dedupe only sees finished jobs (verified).** `extraction-job.service.ts` `createJob` returns an existing recipe only when `findLatestCompletedBySourceId` finds a `COMPLETED` job. Two requests for the same link while the first is `QUEUED`/running both create jobs. The source row is looked up with `findByUrlHash` and then created, so two simultaneous requests can also race on `urlHash @unique`.
3. **Several client paths can fire the same request (hypothesis).** The Add sheet's engine (`import-engine.ts` `startImport`) and the share screen (`use-shared-import.ts`) are separate and neither checks for a running import of the same URL. A re-delivered share intent (`ShareIntentBridge` re-runs on `shareIntent` change and calls `openShare`, bumping the nonce), or tapping the pasted-link "Import" chip and the main button, can create two jobs. After a cancel ([Q25](Q25-share-back-cancels-import.md)) the server cancel is fire-and-forget; if it fails the first job still completes.

## Fix

1. **API:** extend `normalizeUrl`: lower-case host, strip `www.`/`m.`, drop a known tracking-parameter list (`si`, `igshid`, `feature`, `pp`, `ref`, `gclid`, `mc_cid`, `mc_eid`, `_ga`, `_r`, `_t`, `fbclid`, …), sort remaining params, and add per-site canonicalisers (YouTube `watch?v=` / `youtu.be` / `shorts` → `youtube.com/watch?v=<id>`). Keep the original URL in `originalUrl`.
2. **API:** in `createJob`, also look for a `QUEUED`/running job on the same source and return **its** id (`deduplicated: false`, `status: 'queued'`) instead of creating a second one. Wrap source creation in an upsert (`ON CONFLICT (urlHash)`) so the race cannot throw.
3. **Mobile:** one in-flight guard keyed by normalised URL in the shared engine ([Q07](Q07-import-progress-truthful.md) item 3 / [Q25](Q25-share-back-cancels-import.md)); starting an import for a link that is already running focuses the running one.
4. **Mobile:** `ShareIntentBridge`: ignore a hand-off whose URL equals the one already open in the share layer.
5. **Data clean-up:** a one-off script to list recipes whose `sourceType`/video id collide, so existing duplicates can be merged by hand.

## Acceptance criteria

- Sharing the same YouTube video twice from the YouTube app (two different `si=` values) yields one recipe.
- `youtu.be/<id>`, `youtube.com/watch?v=<id>` and `m.youtube.com/watch?v=<id>` yield one recipe.
- Tapping Import twice quickly, or sharing the same link while it is importing, creates one job.
- A link that differs only by tracking parameters resolves to the existing recipe, with the "Already in your cookbook" copy from [Q08](Q08-supported-sources-and-error-copy.md).

## Tests

- Vitest: `normalizeUrl` table (YouTube variants, `si`, `www`, `m.`, tracking params, param order, trailing slash); `createJob` returns the in-flight job; two parallel `createJob` calls produce one source and one job.
- Jest: the engine in-flight guard; `ShareIntentBridge` ignores a repeated hand-off.
- Manual: share one YouTube video twice from the YouTube app.
