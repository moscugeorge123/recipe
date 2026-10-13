# D3. Cook timer settings

Group D: Other new features. Called "F3" in the prototype.

## Design source
- Spec: [DESIGN.md](DESIGN.md), Group D › D3. Cook timer settings. Read it first. It is the design this task implements.
- Prototype: `Tortie App v2.dc.html`, screen: "Cook mode" (step timer card). Search the file for `data-screen-label="..."`.

## Design
- The step timer card gets a config toggle that opens a panel:
  - a duration stepper (1 below 10, 5 from 10 up, clamped 1–600 min);
  - presets (Recipe default, 1, 3, 5, 10, 15, 20, 30);
  - an **Auto-start** switch, "Start when you reach this step";
  - an "Apply: Set timer to X" button.
- **−1 min** and **+5 min** buttons are added next to +1 min.

## Repo
- `screens/cook.tsx` has only +1 min (about lines 723, 1336). `timer-clock.ts` and `timer-alarm.ts` exist.

## Enrich later
- Persistence per recipe or step, and the relation to timer alarms.
