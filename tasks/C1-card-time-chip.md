# C1. Time chip over the card photo

Group C: Cookbook and Today cards

## Design source
- Spec: [DESIGN.md](DESIGN.md), Group C › C1. Time chip over the card photo. Read it first. It is the design this task implements.
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
