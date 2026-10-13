# D2. Step video clips ("Watch step")

Group D: Other new features. Called "F2" in the prototype.

## Design source
- Spec: [DESIGN.md](../DESIGN.md), Group D › D2. Step video clips ("Watch step"). Read it first. It is the design this task implements.
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
- **Done:** `RecipeStep.clipStartSeconds` / `RecipeRevisionStep.clipStartSeconds` (nullable int, second the step starts in the source video), migration `20261012110000_step_clip_start`, API and mobile schemas. Null means no clip.
- **Done:** API fills the start times at import: `modules/recipes/application/step-clips.ts` (`alignStepClips`) matches each step to the transcript, and the stage orchestrator stores the result. User edits carry a step's clip along while its text is unchanged.
- **Done:** UI in `tortie/screens/step-clip.tsx` (the **Watch step** chip and the Step clip sheet); pure logic in `tortie/data/step-clips.ts` with tests.
- **Superseded data model:** the single start became `clipSegments` (JSON `[{ start, end }]` in seconds, migration `20261013090000_step_clip_segments`, which backfills the old starts). A step can have several parts when the video comes back to it.
- **Done:** the importer finds the parts with an LLM over the numbered, timed transcript (`step-clip-aligner.ts`, prompt `step-clip-alignment-v1`), falling back to the word-matching heuristic in `step-clips.ts`. It stores the downloaded video on `source.metadata.video`; `GET /recipes/:id/video` streams it (byte ranges locally, redirect to a signed S3 link otherwise). yt-dlp now prefers H.264/AAC MP4 so iOS can play it.
- **Done:** the sheet plays the real video with `expo-video` when there is one (simulation otherwise). It opens paused on the step's first frame and plays on tap; the step's parts play back to back; the bar shows the whole video as chapters with the open step's parts in terracotta; closing pauses, reopening the same step resumes, and cook mode moves to the step the sheet closed on. Cook mode and the Method tab load the video ahead of time.

## Enrich later
- Recipes imported before the stored-video change have no `source.metadata.video`, so they keep the simulation; re-importing fills it.
- Seed recipes carry no clips, so the chip only appears on recipes imported from video after this change.
- Recipes imported before this change have no start times; re-importing fills them.
- Instagram does not report a video length, so its last clip ends at the transcript's last caption.
- The tablet prototype omits this feature.

## Status
The **Watch step** chip is on method rows ("Watch step 0:29") and on cook step pages ("Watch this step 0:29–0:51"), and opens the Step clip sheet:
- player 192×340 for reels and TikToks (and YouTube Shorts), 100%×200 otherwise, with a centre play/pause/replay disc, a "cur / total" time pill and an "End of step" pill;
- segmented bar (one segment per clip, tap to jump), "Step n · 0:29–0:51" and an "n left" / "Step clip done" line;
- previous, replay and next buttons (next turns green once a clip has ended), and "Open on {platform}" / "Open in YouTube at 1:23" which opens the real video.

Deviations from the prototype:
- Only steps with a start time get a clip, so the bar and previous/next move between those clips; the buttons name the real step ("Step 4"), and the previous button reads "Previous" on the first clip.
- The player area is the striped placeholder from the prototype, not a real video. Playback is simulated at 4 ticks per second.
- Steps marked "Before you start" never get a clip, because they are not narrated in cooking order.
- The importer places a clip only when at least two steps match the transcript, and never for carousels with several videos (their timelines overlap).
- `skip_previous`, `skip_next` and `open_in_new` are not in the bundled icon font subset, so they are drawn as SVG (`ui/svg-icons.tsx`).
- The player is not verified in the running app on iOS or Android.
