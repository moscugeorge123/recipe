# D2. Step video clips ("Watch step")

Group D: Other new features. Called "F2" in the prototype.

## Design source
- Spec: [DESIGN.md](DESIGN.md), Group D › D2. Step video clips ("Watch step"). Read it first. It is the design this task implements.
- Prototype: `Tortie App v2.dc.html`, screen: "Step clip", "Recipe" (Method section), "Cook mode". Search the file for `data-screen-label="..."`.

## Design
- Recipes imported from a video get a timestamp per step.
- Method rows and cook step pages show a **Watch step** chip with the clip range ("0:29–0:51").
- It opens a **Step clip sheet**:
  - a player, vertical 192×340 for reels or wide 100%×200;
  - a segmented bar, one segment per step;
  - play/pause, replay, previous and next step;
  - a "left" countdown and a "Step clip done" end state;
  - "Open on {platform}", or "Open in YouTube at 1:23".
- The prototype simulates playback.

## Repo
- None.
- The API has transcript and video repositories that could supply timestamps.

## Enrich later
- A per-step start time and the source video duration in the data model.
- Player strategy (embed, deep link, or a downloaded clip).
- The tablet prototype omits this feature.
