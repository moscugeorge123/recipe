# Q28. The Add-recipe sheet keeps the previous link after it is closed

🟡 Low · mobile · Finding **F86**

## Problem

After importing a recipe from the Add sheet and closing the sheet (swipe down, tap outside, or Android back), the next time the sheet opens the link field still holds the **old link**. The sheet should start clean.

## Evidence

Reported on a device; no screenshot. Same family as F45 (the previous recipe's counts reappearing, see [Q07](Q07-import-progress-truthful.md)) and F76 (Cookbook search surviving tab changes, see [Q15](Q15-cookbook-state-and-copy.md)): state that outlives the thing it belonged to.

## Root cause (verified in code)

`AddRecipeSheet` (`tortie/screens/add-recipe.tsx`) keeps the field in `useState('')` (`url`) and the clipboard suggestion in `useState(null)` (`clip`). The component stays mounted when the sheet is closed. The comment on the open effect says "Opening again starts from a clean sheet", but that effect only calls `setFocus(addJobId)`. `url` is reset in `importAnother`, `openImported` and two error actions, **not** in `close()` / the `Sheet`'s `onClose`, and not when the sheet opens. `startImportFor(raw)` also does `setUrl(raw)` for the clipboard chip, which leaves the pasted link behind.

Check while here: "Write it yourself" (`openNewRecipe` → `RecipeEditor` with `editMode: 'new'`). Open it after editing an existing recipe and confirm the title/ingredient fields start empty; the `editNonce` reset logic in `editor.tsx` (`seen`/`nonce`) should cover it but was not exercised.

## Fix

1. Reset `url` and `clip` when the sheet **opens** (inside the existing `[open]` effect, unless `addJobId` is set), and when it finishes closing, so a mid-close frame never shows the old text.
2. Keep `url` only for the "Edit link" action of a failed import (it sets `url` on purpose).
3. After the clipboard chip is used, clear the chip but not the user's typed text.
4. Same audit for the other sheets that hold local field state across open/close: new collection (`NewCollectionSheet`), edit grocery/pantry (`EditGrocerySheet`, `EditPantrySheet`), notes composer (`RecipeNotesSheet`). Each should reset from its open event, not from a "submit" path only.

## Acceptance criteria

- Import → close the sheet by any route → reopen: empty field, no leftover brand tint on the border, CTA disabled.
- Failed import → *Edit link* still shows the failed link.
- Typed-but-unsent text is not kept after the sheet closes.
- Editor in new mode opens empty after an edit session.

## Tests

- Jest (render): open → type → close → open shows an empty input; error "edit" action pre-fills.
- Manual: the four close routes (swipe, backdrop, hardware back, "Open recipe").
