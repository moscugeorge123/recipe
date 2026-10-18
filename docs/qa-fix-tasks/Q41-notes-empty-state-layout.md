# Q41. Notes sheet empty state: icon on the same line as the text, left aligned

🟡 Low · mobile · Finding **F99** (the missing glyph part is already in [Q14](Q14-icon-glyphs.md))

## Problem

When a recipe has no notes, the sheet shows a centred round icon on top of "No notes yet" and the paragraph. The product owner wants a lighter, left-aligned row: the icon beside the text.

## Evidence

Code: `RecipeNotesSheet` in `tortie/screens/recipe-notes.tsx` (~l.583): `<EmptyState variant="plain" compact icons={['restaurant','edit_note','chat']} … />`. With `compact`, `EmptyState` (`ui/empty-state.tsx`) draws a 56 px circle with `icons[1]` (`edit_note`) above centred text.

## Root cause

`EmptyState` has only the centred stacked layout. In addition, `edit_note` (and `chat`, `restaurant`) are **not in the bundled icon fonts** ([Q14](Q14-icon-glyphs.md)), so the circle shows the ligature as plain letters rather than an icon.

## Fix

1. Replace the `EmptyState` use in the notes sheet with a small inline row: icon (24 px, green) and a text block to its right — title "No notes yet" (sans 15/600) and the body (sans 13/400, `ink2`) under it — `flexDirection: 'row'`, `alignItems: 'center'` (or `flex-start` when the body wraps), left aligned, no card background.
2. Add an optional `layout="inline"` to `EmptyState` if other places want it (Imports history, step notes); otherwise keep it local to the sheet.
3. Use an icon that exists in the font (e.g. `edit`, `chat_bubble` if present) or finish [Q14](Q14-icon-glyphs.md) first. Do not ship the row with the current `edit_note`.
4. Keep the empty row compact so the composer above it stays in view with the keyboard open ([Q40](Q40-sheet-keyboard-gap.md)).
5. Strings through `t()` ([Q30](Q30-app-translation-coverage.md)).

## Acceptance criteria

- Empty notes: one left-aligned row, icon and text on the same line, no centred circle, no letters in place of the icon.
- Long Romanian copy wraps beside the icon without overlapping it.
- Notes present: unchanged.

## Tests

- Jest: the empty notes sheet renders the inline row; icon name exists in `icon-names.json` (Q14 guard).
- Manual: empty notes at font scale 130 %.
