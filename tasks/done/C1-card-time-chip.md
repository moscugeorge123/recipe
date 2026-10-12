# C1. Time chip over the card photo

Group C: Cookbook and Today cards

## Design source
- Spec: [DESIGN.md](../DESIGN.md), Group C › C1. Time chip over the card photo. Read it first. It is the design this task implements.
- Prototype: `Tortie App v2.dc.html`, screen: "Cookbook". Search the file for `data-screen-label="..."`.

## Design
- Cookbook grid cards get a **time chip on the photo**, bottom-left, 8 px inset.
- It is 24 px tall, with a `schedule` icon and the duration.
- Style: `rgba(25,28,25,.62)`, blur 6, 11/700, text #f8faf5.
- It coexists with the multi-select check, which sits top-right.

## Repo
- `screens/cookbook.tsx` shows only the text meta under the card (about lines 867 and 916). No time chip.

## Enrich later
- List view: the design shows no chip on list rows, only the byline and meta text.
- What to show when the time is missing.

## Status
Done. `ui/time-chip.tsx` has the `TimeChip` (24px, `schedule` glyph, 11/700, `rgba(25,28,25,.62)` over a light blur, 8px inset bottom-left). It is on Cookbook grid cards and on the Today "Cook again" cards, which the prototype also shows it on. It is hidden when the time is unknown. The multi-select check stays top-right.

List rows have no chip, as in the design. The prototype's list meta drops the time, so the row would show no time at all. Rows therefore read "{time} · {level}" instead. The grid's meta line is now the level, "Cooked N×" or the pantry count, since the chip carries the time.
