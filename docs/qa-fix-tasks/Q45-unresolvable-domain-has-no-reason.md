# Q45. A domain that does not resolve fails with no `reason`

🟡 Low · API · Found in the manual test of PR #20 (2026-10-18). Related to [Q05](Q05-site-access-and-failures.md), [Q08](Q08-supported-sources-and-error-copy.md).

## Problem

`fetchHtml('https://nonexistent-domain-xyz123.com/r')` fails in 49 ms with `CONTENT_ACQUISITION_FAILED` and no `reason`, so the app falls back to a generic message. A 404, 410 and 403 each get a distinct reason; a network failure does not. (At job-create time `assertSafeUrl` may reject the host first with `INVALID_URL`; this path is for hosts that resolve at create time and fail later, and for timeouts.)

## Root cause (verified)

`apps/api/src/modules/content/preview/fetch-html.ts`: the `catch` around `fetchImpl` throws `ContentAcquisitionFailedError` without a `reason`.

## Fix

Add reasons for DNS failure (`ENOTFOUND`) and timeouts (for example `UNREACHABLE` and `TIMEOUT`), and a short user message for each.

## Acceptance criteria

- A host that does not resolve and a request that times out each return a specific `reason` and message.

## Tests

- `acquisition-failures.test.ts`: a rejected fetch with `ENOTFOUND` and an `AbortError` map to the new reasons.
