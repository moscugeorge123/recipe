# D4. Skeleton / loading state

Group D: Other new features. Called "F5" in the prototype.

## Design source
- Spec: [DESIGN.md](DESIGN.md), Group D › D4. Skeleton / loading state. Read it first. It is the design this task implements.
- Prototype: `Tortie App v2.dc.html`, screen: All screens, driven by the `loadingState` prop. Search the file for `data-screen-label="..."`.

## Design
- Every text block, image and tile can show a shimmering skeleton (`tlSkWave`, `tlSkBreath`), driven by a `loadingState` prop. It covers all tabs and sheets.

## Repo
- Only the shimmer-text keyframe in `tortie/ui/keyframes.tsx`.
- No reusable skeleton.
