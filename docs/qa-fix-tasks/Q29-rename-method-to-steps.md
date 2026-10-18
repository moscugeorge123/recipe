# Q29. Call "Method" "Steps"

🟡 Low · mobile · Finding **F84** (product decision, not a defect)

## Problem

The recipe screens say **Method** (tab on the detail screen, section title in the editor). Everywhere else the app, the API and the cook mode say **steps** ("5 steps", "Step 3", "Watch step"). The inconsistency is confusing.

## Where it shows

User-visible strings, found by searching the mobile source for "method":

| File | Text |
| --- | --- |
| `tortie/screens/recipe-detail.tsx` (segment control) | `label: 'Method'` |
| `tortie/screens/editor.tsx` (~l.1082) | `title="Method"` |

The other hits are code comments and variable names (`recipe-detail.tsx` l.117, `recipe-notes.tsx`, `step-clip.tsx`, `nav-store.ts`); they can be changed for consistency but nothing user-facing depends on them.

Also update, so the docs match the app: [Q02](Q02-step-order-and-title-split.md) ("Method tab"), [Q04](Q04-ingredient-fidelity-and-groups.md), [Q16](Q16-units-and-scaling-in-method-text.md) (title and text), `tasks/DESIGN.md` §B4 and `tasks/done/B4-method-step-rows.md`, and the Maestro flows under `apps/mobile/.maestro/flows` if any select the tab by its label (none matched in a quick search, but check).

## Fix

1. Rename the two labels to **Steps**.
2. Look at the detail screen's segmented control once after the change: "Steps" is shorter than "Method", so overflow is unlikely, but the active pill may be sized from the label (not checked).
3. Search the API prompts and the "Ask Tortie" assistant copy for user-facing "method" (`apps/api`: `recipe-extraction` prompts and assistant replies) and align them. The `E1-assist-step-numbering` task already talks about "method steps" internally; keep that wording out of replies.
4. Localisation: there is no i18n layer yet, so no key to change.

## Acceptance criteria

- No visible "Method" anywhere in the app (detail tab, editor, Ask Tortie replies, share/import copy).
- Docs and task files use "Steps"/"Steps tab".

## Tests

- Jest snapshot or text query for the detail screen's tab labels.
- Manual: detail screen on a 360 dp phone and a Pixel 6; editor section header.
