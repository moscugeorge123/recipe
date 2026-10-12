# D6. Tablet layout (iPad)

Group D: Other new features. Called "F6" in the prototype.

## Design source
- Spec: [DESIGN.md](DESIGN.md), Group D › D6. Tablet layout (iPad). Read it first. It is the design this task implements.
- Prototype: `Tortie Tablet v2.dc.html`, screens: "Sidebar", "Cook timers", and the split view in Recipes and Profile. Search the file for `data-screen-label="..."`.

## Design (`Tortie Tablet v2`)
- **Portrait 834×1194:** an icon rail replaces the tab bar. The recipe detail covers the content.
- **Landscape 1194×834:**
  - a labelled **sidebar**;
  - **split view** (list left, detail right) for recipes and profile;
  - a **Cook timers side panel**, 372 px wide, in cook mode.
- Includes the new phone features except step clips. It also has Imports and import error.

## Repo
- Nothing. The shell is phone-only (`tortie/frame.ts`, `shell.tsx`).

## Enrich later
- Breakpoints, responsive sheets, nav-store changes for split-view selection.
