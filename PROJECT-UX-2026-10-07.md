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
- Browser CI: pending candidate push. Expanded actual Chromium journeys cover 1366×768, 390×844, 320×844, 844×420 and 320×420, with screenshots and JSON receipts. This script is run in CI, not through a local browser automation bypass.
- Independent final diff review and parent visual QA: pending. Pre-implementation findings are addressed by the changes above; any final findings will be recorded here before acceptance.

## Limits

The candidate has not been deployed. Automated tests do not establish first-time human usability or audio perception on a user's hardware. This remains a browser spatial-audio demonstration, with visual walls and no validated room acoustics, reflections, absorption or speaker calibration. Existing CDN, WebGL and Web Audio requirements remain.

Proposed release URL: <https://generalgroovy.github.io/audio-sim/>.
