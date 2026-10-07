# Speaker Simulator UX — 7 October 2026

## Scope and observed friction

The starting interface placed arrangement management above the selected speaker, mixed listener movement with speaker settings, and used ambiguous Apply/Save/Restore, X/Y/Z and Home labels. Undo always attempted to focus its own button even when that final action disabled it. The independent source review identified these same first-use and recovery concerns before implementation.

Base: `2242b3f7a37e00844f8722aa2b633ac1b938169c` (`origin/main`). Candidate branch: `codex/ux-clarity-2026-10-07`. No unrelated local edits were present. No main push or deployment is part of this candidate.

## Changes

- A concise identity and first action lead into separate named speaker and listener regions. The room map stays primary; precision positioning and comparison remain discoverable disclosures.
- Exact position names left/right, height and front/back. Reset listener states its scope and preserves all speakers.
- Compare & save distinguishes using a preset in the active arrangement from saving/restoring both arrangements. Adjacent feedback distinguishes a saved workspace from later unsaved edits.
- Empty rooms offer Add speaker and Undo recovery while unavailable sound controls are hidden and audio stays disabled. Undo focuses a restored map marker, or the speaker selector when in 3D view. Internal scene replacement no longer moves focus repeatedly during teardown.
- Existing scene formats, A/B depth, the 40-change Undo history, placement precision, requested speaker levels and audio-start invalidation remain intact.

## Validation

- Local: `node --test tests/audio.test.cjs` — **25/25 passed**. Includes empty-room focus/recovery in both views, saved/unsaved feedback, reload/restore, and reversible listener reset in addition to all previous audio, storage, placement and history regressions.
- Local: `node --check tests/browser.mjs` and `git diff --check` — passed.
- Runtime revision: `f7693fe51e1d17b9f4a349cee444eb07d4c67a7e`. [Quality run 37599995059](https://github.com/generalgroovy/audio-sim/actions/runs/37599995059) **passed**, including 25 unit tests and actual Chromium journeys at 1366×768, 390×844, 320×844, 844×420 and 320×420. All five journeys report no page/console errors or horizontal overflow. Screenshots and `results.json` are retained in the `audiosim-browser-quality` workflow artifact, with a local ignored copy under `test-results/ux-2026-10-07-shortfix/`.
- Visual inspection of the initial desktop and 390px screenshots confirmed the named groups and first action. Initial 320×420 evidence exposed a listener-marker overlap with the map legend; mobile short-height spacing was corrected and an explicit browser non-overlap assertion added. Final 320×420 initial/workflow screenshots confirm the separation. Browser tests run in CI, not through a local browser automation bypass.
- Independent final source review through `f7693fe`: **no blocker found**, with 25/25 tests rerun. Reviewed A/B preservation, validation-before-restore, serialized save feedback, Undo focus, empty-room recovery and the short-stage padding change. The reviewer did not operate the browser. Parent live rendered acceptance remains a separate release gate.

## Limits

The candidate has not been deployed. Automated tests do not establish first-time human usability or audio perception on a user's hardware. This remains a browser spatial-audio demonstration, with visual walls and no validated room acoustics, reflections, absorption or speaker calibration. Existing CDN, WebGL and Web Audio requirements remain.

Proposed release URL: <https://generalgroovy.github.io/audio-sim/>.
