# Recipe Import Pipeline — Audit & Changes Report

Date: 2026-09-26
Scope: the full "import a recipe from a link" flow (mobile add sheet → `POST /recipes/extract` → BullMQ extraction pipeline → recipe detail).

Nothing has been committed. Two new Prisma migrations were written but **not applied** to any database (see [Deploy steps](#deploy-steps)).

---

## 1. How the pipeline works (after the changes)

```
Mobile AddRecipeSheet (paste / clipboard URL)
  → POST /api/v1/recipes/extract            (SSRF check, dedupe, enqueue)
  → Worker: RecipeExtractionPipeline
      ACQUIRING_CONTENT   Instagram (Apify) | YouTube (yt-dlp + captions) | Generic web (JSON-LD, microdata, page text)
                          TikTok / Facebook → UNSUPPORTED_SOURCE
      PROCESSING_MEDIA    ffmpeg: frames (pixel dedupe), audio (skipped if silent), carousel slides as images
      TRANSCRIBING        YouTube captions preferred, else Whisper; music-only transcripts dropped
      ANALYZING_FRAMES    vision on frames + slides (sampled evenly, per-image failures tolerated)
      RUNNING_OCR         OCR on frames + slides, ordered by slide then timestamp
      EXTRACTING_RECIPE   evidence → food-recipe classifier (NOT_A_RECIPE fails the job) → LLM extraction (recipe-extraction-v9)
      NORMALIZING_RECIPE  units, metric + imperial, °C/°F, step→ingredient links
      VALIDATING_RECIPE   heuristics; empty extraction → NOT_A_RECIPE
  → GET /recipes/extract/jobs/:id  → mobile opens recipe or shows a specific error
```

---

## 2. What was found (before)

| Area | Problem |
|---|---|
| Recipe detection | No check at all. Any link produced a "recipe" (often garbage) and the job ended COMPLETED. |
| Generic websites | Only Open Graph tags were read. No schema.org / JSON-LD parsing, so the real recipe data on most recipe blogs was ignored. |
| Error messages | Mobile showed one hard-coded toast for every failure. |
| Video frames | "Perceptual hash" hashed JPEG header bytes, so a video collapsed to ~1 frame. OCR ran on only the first 3 frames, vision on the first 5. Timestamps were wrong after dedupe; long videos were cut off at 300 s. |
| Silent videos | ffmpeg audio extraction failed the whole job when there was no audio track. |
| Instagram | Reel videos were never downloaded (no frames/audio/OCR). Carousel slides (`childPosts`) were ignored; images were never OCR'd. Posts without a caption were rejected. |
| YouTube | Captions/subtitles and chapters were ignored; downloads could pull 4K video. |
| Nutrition | Calories came from the USDA FoodData Central API after import. AI only extracted calories if the post stated them; macros were opt-in (`extractNutrition`, off by default). |
| Units | Ingredients stored only as written. No metric ↔ imperial conversion. `parseQuantity` read "1 1/2" as 5.5 and "2-3" as 23. |
| Frontend fields | Difficulty was guessed from total time, "you'll need" per step was keyword matching, the Profile → Units toggle wasn't connected to anything. |

---

## 3. What was added / changed

### 3.1 Food-recipe detection & non-recipe links

- **Classifier** — `apps/api/src/modules/recipes/application/recipe-classifier.ts` with its own prompt `recipes/prompts/recipe-classification-v1.ts`.
  - If the page has schema.org Recipe data, it's accepted without an LLM call.
  - Otherwise an LLM call returns `{ isFoodRecipe, confidence, category, reason }`; rejects only when "not a recipe" with confidence ≥ 0.7. Thin evidence leans toward "recipe".
  - Keyword heuristics (`recipe-signals.ts`) are used when there's no OpenAI key or the LLM call fails. They catch "recipe for success", DIY soap, product pages, etc.
  - A second guard rejects extractions with no ingredients **and** no steps.
- **New error** `NotARecipeError` / code `NOT_A_RECIPE` (HTTP 422, not retryable), added to `packages/contracts/src/errors.ts`. The job ends FAILED and **no recipe is saved**. Job errors now carry `code`.
- **Mobile** — `add-recipe.tsx` + `lib/user-error.ts` (`importFailureToast`) show specific messages: "That link doesn't look like a food recipe", "TikTok/Facebook links aren't supported yet", "Couldn't open that link", or the generic fallback.
- **Decision:** cocktails and smoothies count as food recipes.

### 3.2 Generic websites: structured recipe data

- `content/providers/generic/structured-recipe-parser.ts` — JSON-LD parser (`@graph`, `mainEntity`, array/prefixed `@type`, HowToSection/HowToStep, `recipeYield`, ISO-8601 durations, `nutrition.calories`, image variants, loose JSON) plus a microdata fallback.
- `content/providers/generic/page-text.ts` — readable main text (prefers `<article>`/`<main>`, strips nav/scripts), capped at 12,000 chars (4,000 when structured data exists).
- Both feed the evidence as their own labelled sections (`evidence/application/structured-recipe-evidence.ts`). Non-HTML responses are rejected.

### 3.3 Recipes written in video frames and post images

- **Media stages** moved to `extraction/application/media-stage-handlers.ts`:
  - several videos per post plus image slides; a failed video only fails the job if there's no other evidence
  - YouTube captions used instead of Whisper when available; music-only transcripts dropped
  - OCR + vision per image with bounded concurrency, sampled evenly across the video, per-image failures skipped
- **Real frame dedupe** — `media/domain/perceptual-hash.ts` compares decoded 128×128 grayscale pixels, so frames differing only by text overlay are kept.
- **Silent videos** — audio skipped when ffprobe finds no audio stream; audio failures are non-fatal. Audio is mono 64 kbps to stay under Whisper's 25 MB limit.
- **Instagram** — `instagram-slides.ts` builds ordered slides from `childPosts` / `carouselImages` / `images`; reel and carousel videos are downloaded during acquisition (CDN links expire); caption optional.
- **YouTube** — `youtube-captions.ts` picks uploader subtitles first, then original-language auto captions; chapters added to evidence; downloads capped at 720p.
- **Evidence labelling** — `evidence/application/media-evidence.ts` labels items (`Slide 3 OCR`, `Frame @12s OCR`, `Slide 1 vision`), collapses repeated/build-up overlays, and applies a character budget.
- OCR prompt now preserves line breaks, fractions and units and ignores watermarks.

New env vars (`apps/api/src/config/env.ts`, `.env.example`):

| Var | Default |
|---|---|
| `FRAME_INTERVAL_SECONDS` | 1 (was 2; fractional allowed) |
| `FRAME_DEDUPE_MIN_CHANGED_RATIO` | 0.002 |
| `OCR_MAX_FRAMES` | 24 |
| `VISION_MAX_IMAGES` | 6 |
| `MEDIA_AI_CONCURRENCY` | 4 |
| `MAX_POST_IMAGES` | 20 |
| `MAX_POST_VIDEOS` | 3 |
| `MAX_MEDIA_DOWNLOAD_BYTES` | 200 MB |
| `EVIDENCE_MEDIA_MAX_CHARS` | 16000 |
| `EVIDENCE_TRANSCRIPT_MAX_CHARS` | 20000 |
| `YOUTUBE_PREFER_CAPTIONS` | true |

### 3.4 USDA nutrition API removed — calories handled entirely by AI

**Removed**
- `apps/api/src/modules/nutrition/**` (USDA provider, calculator, service, conversions, routes), `nutrition.repository.ts`, `worker/processors/nutrition.processor.ts`, the `nutrition-jobs` queue, nutrition tests.
- `packages/contracts/src/nutrition.ts`; mobile `features/nutrition/**`; `nutritionStatus` from API responses and mobile types.
- Env vars `USDA_FDC_API_KEY`, `NUTRITION_QUEUE_CONCURRENCY`, `NUTRITION_MAX_RETRIES`, `NUTRITION_BACKOFF_MS`.
- Prisma: `NutritionStatus` enum, `NutritionSnapshot`, `NutritionFoodMatch`, `NutritionQueryCache`, `NutritionFoodCache`, `AIUsage.nutritionSnapshotId`.
- USDA mentions in READMEs, `architecture.md`, Postman collection, OpenAPI.

**AI now always provides nutrition**
- The extraction prompt requires calories + protein/carbs/fat **per serving** on every import: stated values if the source gives them, otherwise estimated from ingredients, quantities and servings.
- New `nutritionSource: 'stated' | 'estimated'`; the detail screen shows "Per portion · est." for estimates.
- `extractNutrition` opt-in removed (old clients sending it are tolerated).
- Editing ingredients/servings does **not** recompute nutrition; halve/double scale ingredients and servings together, so per-portion values stay correct.

### 3.5 Measurements in metric and imperial

- **Every ingredient** stores the original amount plus `metric {quantity, unit}` and `imperial {quantity, unit}`. The LLM supplies both (needed for cup → gram conversions of specific ingredients); `normalization/domain/measurement-conversion.ts` validates and fills them:
  - The original system keeps the exact amount; the other uses the LLM value if within 15% of a straight conversion (or a plausible density for cups ↔ grams), else the straight conversion.
  - Counts (pieces, cloves, pinch, to taste) are copied unchanged into both.
  - Rounding: grams/ml to 0.5 / 1 / 5 depending on size (113.4 g → 115 g); imperial snaps to kitchen fractions (0.33 cup → ⅓ cup); oven temperatures ≥ 250 °F snap to 25 °F (180 °C ↔ 350 °F).
- **Steps** store `temperatureCelsius` and `temperatureFahrenheit`; instruction text carries both inline ("180°C (350°F)", "2 cm (¾ in)"), and the app shows the preferred system first.
- `parseQuantity` fixed for mixed numbers, unicode fractions, ranges and decimal commas.
- **Mobile:** the existing **Profile → Units** toggle now drives recipe detail, cook mode, editor, Today and groceries. `features/recipes/units.ts` converts older cached recipes and grocery rows on the fly.
- Recipes imported before this change get metric/imperial and °C/°F computed when loaded (straight conversion only).

### 3.6 Frontend field coverage

| Field | Where it shows | Before | Now |
|---|---|---|---|
| Calories | Detail "Per portion" | AI only if stated, else USDA | AI always (stated or estimated) |
| Protein · Carbs · Fat | Detail nutrition row | USDA / opt-in AI | AI always |
| Level (difficulty) | Detail, cook, plan, Today, filters, editor | Guessed from total time | Extracted / user-edited; time guess as fallback. Editor level now saves. |
| Total time | Detail, cook, plan, Today | Stated or prep + cook | Stated or estimated from steps |
| Servings | Detail stepper, editor | Stated, else default | Stated or estimated |
| Ingredient amounts | Detail, cook, editor, groceries | As written | Metric or imperial per setting |
| Step heat | Today, cook | Raw text | °C or °F per setting |
| "You'll need" per step | Cook | Keyword matching | Extracted `ingredientRefs`; keywords as fallback |
| Step timers, description, cuisine, categories, photo, author | Various | AI / source metadata | Unchanged (already covered; JSON-LD now also feeds image/author) |

Tips, equipment and yield were skipped because the app doesn't display them.

---

## 4. Behaviour by link type

| Link | Outcome |
|---|---|
| Recipe blog with JSON-LD / `@graph` | Parsed; accepted without classifier call; recipe saved |
| Microdata-only recipe | Parsed via fallback; accepted |
| Recipe page with no structured data | Page text used; classifier accepts; recipe saved |
| Instagram reel | Video downloaded → frames, transcript, OCR, vision → recipe |
| Instagram carousel / image post | All slides OCR'd in order (mixed image/video supported) → recipe |
| YouTube / Shorts | Description + captions (or Whisper) + chapters + frames → recipe |
| Cocktail / smoothie | Accepted as a recipe |
| News article, "recipe for success", DIY soap, product page | FAILED `NOT_A_RECIPE` → "That link doesn't look like a food recipe" |
| TikTok, facebook.com | FAILED `UNSUPPORTED_SOURCE` → "…aren't supported yet" |
| Pinterest, `pin.it`, `fb.watch`, `instagr.am` | Fall through to generic web; usually thin, so results depend on classifier/extraction |
| 404, timeout, non-HTML | FAILED `CONTENT_ACQUISITION_FAILED` → "Couldn't open that link" |
| Invalid / non-http URL | Rejected at job creation (`INVALID_URL` / `UNSUPPORTED_SOURCE`) |

---

## 5. Database migrations (not applied)

1. `apps/api/prisma/migrations/20260926200000_remove_usda_nutrition/migration.sql` — drops the four nutrition tables, the `NutritionStatus` enum and `ai_usage.nutritionSnapshotId`. **Destructive:** existing USDA snapshot data is lost.
2. `apps/api/prisma/migrations/20260926230000_ai_nutrition_dual_units/migration.sql` — adds nullable columns only:
   - `recipes`, `recipe_revisions`: `nutritionSource`, `difficulty`
   - `recipe_ingredients`, `recipe_revision_ingredients`: `metricQuantity`, `metricUnit`, `imperialQuantity`, `imperialUnit`
   - `recipe_steps`, `recipe_revision_steps`: `temperatureCelsius`, `temperatureFahrenheit`, `ingredientRefs`

`prisma format` re-aligned whitespace across `schema.prisma`, so its diff looks larger than the real change.

### Deploy steps

```bash
cd apps/api
npm run db:migrate:deploy          # dev DB and the test DB (recipe_api_test)
npx prisma generate
cd ../../packages/contracts && npm run build
```

Also remove `USDA_FDC_API_KEY` / `NUTRITION_*` from any real `.env`, and add `@react-native/jest-preset` as a mobile devDependency (it's missing, so `npm test` in `apps/mobile` can't start).

---

## 6. Test results

| Check | Result |
|---|---|
| `apps/api`: `npx tsc --noEmit` | Clean |
| `apps/api`: `npx vitest run tests/unit` | 40 files, 368 passed |
| `apps/api`: full `npx vitest run` on a DB with migrations applied | 70 files, 555 passed |
| `apps/api`: full suite on the current unmigrated `recipe_api_test` | 50 DB tests fail until migrations are deployed |
| `packages/contracts`: `tsc` + build | Clean |
| `apps/mobile`: `npx tsc --noEmit` | Clean |
| `apps/mobile`: `npx jest` (preset copied in temporarily) | 33 suites, 146 passed |
| ESLint on changed files | Clean |

New test coverage: HTML fixtures for 9 page types, JSON-LD/microdata parser, classifier, not-a-recipe pipeline, 5-slide and mixed carousels, silent text-only video (real ffmpeg), YouTube captions, frame sampling/dedupe, 83 unit-converter cases, recipe DTO and mobile mapper/units tests.

---

## 7. Remaining gaps & risks

- **Real-model behaviour is untested.** All LLM tests use stubs; the classifier and v9 extraction prompts haven't been run against OpenAI with real links.
- **Cost increase.** One extra classifier call for links without JSON-LD; OCR goes from 3 frames to up to 24 frames + 20 slides per job. Tune with `OCR_MAX_FRAMES` / `MAX_POST_IMAGES`.
- **TikTok and Facebook** remain unsupported (stub providers). Pinterest has no dedicated provider.
- **Nutrition estimates** are only bounds-checked, not cross-checked against 4/4/9 kcal per gram, and aren't recomputed after edits.
- **Short on-screen text** shown for less than the frame interval can be missed (no scene-change detection). Song lyrics transcribed by Whisper aren't filtered.
- **Older recipes** get metric/imperial via straight conversion only (no ingredient densities) and single-system step text; re-import refreshes them.
- **`forceRefresh`** reuses an existing recipe for the same source without re-running the classifier.
- Heuristic classifier (no-key mode) can let a food news article through; only the empty-extraction guard then catches it.
