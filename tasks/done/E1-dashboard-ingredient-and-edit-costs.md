# E1. Count ingredient generation and recipe edits in dashboard spend

The dashboard token counts and dollar totals should include AI spent on generating ingredients and on editing recipes.

## Repo

Overview (`GET /dashboard/summary`, the Overview page) only adds `ai_usage` rows that belong to an import job. `assembleSummary` walks extraction jobs and sums their `aiUsage`. Anything without a `jobId` is left out of AI cost, total cost, and the token counts.

Usage (`GET /dashboard/usage`) loads every `ai_usage` row, grouped by model and then by operation.

**Generating ingredients.** `IngredientOrganizer` already writes usage for the model calls: `pantry_organize_batch`, `pantry_organize_fallback`, and `pantry_organize_escalation`. Rows are linked by `userId`, not by an import job. Those tokens and dollars show on Usage and are missing from Overview. Cache hits (`pantry_organize_cache`) are stored with zero tokens and zero cost.

**Editing recipes.** Ask Tortie (`RecipeAssistant`, operation `recipe_assist`) is built with an `OpenAIProvider` that has no usage tracker and no job id. The provider only records a call when both are set, and then it stores the operation as `structured_generation`. Edits are never written to `ai_usage`, so they appear on neither page. `AIUsage.recipeRevisionId` exists and is unused.

## Done when

- A recipe edit records input tokens, output tokens, and estimated USD, with operation `recipe_assist`, tied to the user.
- Overview AI cost, total cost, and token counts include ingredient-generation rows and recipe-edit rows, as well as import-job usage.
- The Usage page lists both under their models and operations. Ingredient rows that are already stored are not counted twice.

## Enrich later

- Whether a saved edit should also set `recipeRevisionId`.
- Whether zero-cost cache hits stay in the call count.
