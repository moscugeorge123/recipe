# Q42. An optional "rest" step is hoisted in front of the step that makes the batter

🟠 Medium · API · Found in the manual test of PR #20 (2026-10-18). Related to [Q02](Q02-step-order-and-title-split.md).

## Problem

Importing BBC Good Food "Easy pancakes" (`https://www.bbcgoodfood.com/recipes/easy-pancakes`) stores the steps as:

1. Set aside for 30 mins to rest if you have time, or start cooking straight away.
2. Put 100g plain flour, 2 large eggs, 300ml milk ... into a bowl and whisk.
3. Set a medium frying pan ...

The source order is mix, then rest. Step 1 now refers to a batter that does not exist yet. Q02 says only genuine prep steps (soak, marinate, overnight) may move up.

## Root cause (hypothesis)

`orderExtractedSteps()` in `apps/api/src/modules/normalization/application/recipe-normalizer.ts` should refuse this: the text has "if you have" (`OPTIONAL_STEP_PATTERN`) and "rest" is not in `PRE_STEP_PATTERN`. So the code is probably not what moved it. Two suspects, cheapest first:

1. The model returned the steps already reordered (`stepOrder`), because the prompt (`recipe-extraction-v15`) still encourages moving "rest/wait" steps ahead.
2. The page's own JSON-LD lists the rest step first.

Check: re-import with `forceRefresh` and read `rawExtraction` for the job. If `stepOrder` is already wrong there, fix the prompt. If the raw order is right, debug `orderExtractedSteps` with this recipe's steps.

## Fix

Keep source order for any step the page lists after a mixing step, whatever the model's `stepOrder` or `ahead` flag says. If the model is the cause, tighten the prompt so `ahead` is only for soak/marinate/overnight/defrost.

## Acceptance criteria

- BBC "Easy pancakes" keeps "Put 100g plain flour ..." as step 1 and the rest step after it.
- A recipe that starts "Soak the beans overnight" still keeps that step first.

## Tests

- `recipe-normalizer-steps.test.ts`: fixture with this recipe's three steps (flagged `ahead` and not) keeps source order.
