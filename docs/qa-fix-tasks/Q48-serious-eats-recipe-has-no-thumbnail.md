# Q48. Serious Eats bolognese imports with a placeholder instead of a photo

🟡 Low · API · Found in the manual test of PR #20 (2026-10-18). Related to [Q05](Q05-site-access-and-failures.md).

## Problem

`https://www.seriouseats.com/the-best-slow-cooked-bolognese-sauce-recipe` imported with a striped placeholder on the Cookbook card and the Today hero. The other six imports show a photo.

## Root cause (hypothesis, not checked)

Possibly the page has no usable `og:image`/JSON-LD image after the largest-image pick in Q05 (`thumbnails.ts`, `pickBestImage`), or the chosen URL is rejected or fails to load in the app. Check: read the stored image URL for recipe `308ab79a-b280-48e7-95bc-c45aedcc7d25` (or re-import), open it in a browser, then call `/recipes/preview` for the page and compare `thumbnails`.

## Fix

Depends on the check: fall back to the next candidate when the best one is unusable, or fix the image selection for this site.

## Acceptance criteria

- The Serious Eats import shows its photo, or the cause is documented as "the page has no image".

## Tests

- `content-providers.test.ts`: a fixture page matching this site's markup picks an image.
