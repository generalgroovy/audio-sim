# Speaker Simulator saved-work flow — 7 October 2026

## Observed friction and scope

Reloading the previous release retained saved A/B data but displayed the default scene. The restore action and saved-state feedback were inside the closed Compare & save section. A returning user had no prominent indication that prior work was available, and the default room could appear to be lost work.

Baseline: `72b49d3d813a9ac7616a85c11e5fc241a973ce05`, matching `origin/main` at the start. The checkout was clean and had no applicable AGENTS.md. Candidate branch: `codex/ux-flow-2026-10-07`. Runtime: `fcaa53edaf4b2d832be9265b6a04ec3beb69fc7d`.

## Result

- A usable saved workspace now shows a compact Saved work is available card before the editor, with saved speaker counts for A and B and the arrangement that will open. Fresh visits and invalid saves show no recovery card. The card is in the pane, not an overlay.
- Continue saved work reads and validates the full saved workspace before replacing either arrangement. It restores explicitly, stays muted, cancels delayed audio starts, and remains one Undo step. Focus moves to the restored speaker marker, the speaker selector in 3D, or Add speaker for an empty room.
- Keep current dismisses the card while preserving the current workspace, saved data, history, and audio state. It points back to Compare & save → Restore saved. Saving the current workspace also closes the old recovery card.
- If storage becomes unreadable or invalid after the card appears, recovery leaves both current arrangements intact, reports the failure inside the card, and supports retry or Keep current.
- Existing A/B comparison, speaker/listener controls, map and 3D views, legacy saves, bounded gain, 40-change history, precise placement, and manual restore are preserved. README documents the return journey.

## Validation and review

- Local `node --test tests/audio.test.cjs`: **30 passed**, zero failures or skips. Five new behavior tests cover saved counts without autoplay, complete muted restoration with current-edit Undo in both views, nonmutating Keep current plus later manual restore, validation failure/retry, and legacy-empty recovery/new-save dismissal.
- Local `node --check tests/browser.mjs` and `git diff --check`: passed.
- Independent source review by `flow_c`: no blocker; 30 tests independently rerun. Review inspected complete-workspace validation before mutation, pending-audio invalidation, state/history/storage preservation, and focus recovery. The source reviewer did not operate a browser.
- Candidate [Quality 37609840987](https://github.com/generalgroovy/audio-sim/actions/runs/37609840987): **passed**, including all 30 unit tests and actual Chromium journeys at 1366×768, 390×844, 320×844, 844×420 and 320×420. The suite verified Continue fits in the initial pane at every size; saved counts and muted defaults; Keep current preserving saved bytes; manual restore; direct Continue with focus and Undo; and all previous interaction regressions. All five journeys report zero page/console errors and no horizontal overflow.
- Downloaded the `audiosim-browser-quality` artifact to ignored `test-results/ux-flow-2026-10-07/` and visually inspected all five complete `*-saved-work.png` screenshots. The recovery choice is legible and available without scrolling, including 320×420; the card stays inside the pane and the map remains separate. Screenshots and `results.json` are retained in the workflow artifact. No local browser automation was used.

## Release boundary

This is candidate work. Root integration/rendered acceptance and main promotion/publication have not been performed in this owner pass. Intended public URL: <https://generalgroovy.github.io/audio-sim/>. Browser transport behavior does not establish audible quality, first-time human usability, calibrated acoustics, reflections, absorption, or physical audio hardware acceptance. Existing CDN, WebGL and Web Audio requirements remain.
