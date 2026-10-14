# E1. Ask Tortie step numbers

Ask Tortie edits one recipe from a free-text request. The cook and the model count the method steps differently, so “change step 2” can edit the wrong step and the reply can name the wrong one.

## Repo
- Prompt: `apps/api/src/modules/recipes/prompts/recipe-assist-v1.ts`, `RECIPE_ASSIST_SYSTEM_PROMPT`.
- The user message is `RECIPE` (JSON) plus `REQUEST`. `steps` is an array with no number field, so the model counts positions 0 to n−1.
- The app shows those same steps as 1 to n: the editor badge is `j + 1` (`StepRow` in `apps/mobile/src/tortie/screens/editor.tsx`), and the recipe page and cook mode use `i + 1`.

## Do
Update the prompt so the model knows the two counts:

- For the model, step positions are 0 to n−1, because `steps` is an array. `steps[0]` is the first step.
- For the user, steps are 1 to n. User step k is `steps[k - 1]`.
- When `REQUEST` names a step, use the user’s number.
- When `message` names a step, use the user’s number too (1 to n), in the language of `REQUEST`.

Leave the JSON shape as it is. Do not add a number field to the schema. Bump `RECIPE_ASSIST_PROMPT_VERSION` so logs tell this prompt from the previous one.
