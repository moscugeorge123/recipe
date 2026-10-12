# B2. Header block: tag, title, byline and source link

Group B: Recipe page layout

## Design source
- Spec: [DESIGN.md](DESIGN.md), Group B › B2. Header block: tag, title, byline and source link. Read it first. It is the design this task implements.
- Prototype: `Tortie App v2.dc.html`, screen: "Recipe". Search the file for `data-screen-label="..."`.

## Design
- The tag is now a small uppercase green label, not a filled pill.
- Under the title: **"by {author}"** with the author in bold. For imported recipes it adds `·` and a link with the source host ("instagram.com ↗", `open_in_new`) that opens the original. Recipes the user wrote say "by You".
- The description follows.

## Repo
- No byline.
- The README mentions an "Original source" action that is still a stub.
- `features/recipes` has `originalUrl`, and `recipe-detail.tsx` copies it to the clipboard (about line 852).

## Enrich later
- Where the author name comes from (creator handle from the unfurler, or a field on `RecipeSource`).
- The fallback when the author is unknown.
