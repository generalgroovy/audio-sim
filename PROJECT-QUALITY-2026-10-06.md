# AudioSim spatial workbench

Baseline: `5b7e8b6`, clean checkout. The first journey is place a speaker, move the listener, explicitly start/stop audio, then compare an arrangement without losing work.

## Findings and bounded plan

- The fixed front-facing camera hides speakers behind the listener; a room map should show every object and support drag plus keyboard/numeric positioning.
- Removing, applying or restoring cannot be reversed. A bounded Undo history and two independent comparison arrangements will make exploration recoverable without adding a second editing panel.
- Multiple oscillators sum without a mix bound. Normalize source levels before panning while retaining each speaker's requested volume. This is an electrical amplitude budget, not measured loudness or acoustic calibration.
- Preserve v1 scene saves, explicit audio start, muted replacement, geometry/count validation, and the phone scene area.

Acceptance: meaningful model regressions, real browser drag/keyboard/A-B/save/restore/recovery at desktop and phone widths, no horizontal overflow or console errors, final diff review. Physical audio quality and calibrated acoustics remain outside automated evidence.

API reference: [W3C Web Audio specification](https://www.w3.org/TR/webaudio/) for gain automation, HRTF and inverse-distance behavior. The app uses browser panning; it does not simulate wall reflections or absorption.

## Evidence

- Baseline local suite: 13/13 passed.
- Local candidate suite: **22/22 passed**. Includes independent A/B edits, overwrite Undo, slider gesture grouping, legacy v1 migration, invalid v2 preservation, full 32-voice gain budget, pending/active audio cancellation, map keyboard/drag bounds, distant-listener recovery and late pointermove/up after all four scene replacement paths.
- [Quality CI 37540170623](https://github.com/generalgroovy/audio-sim/actions/runs/37540170623): **passed** at runtime commit `0f9205bec2376ce2d9800ec1c7745cb146862170`. Actual Chromium workflows at **1366×768, 390×844 and 320×844**, with no console/page errors or horizontal overflow. Map remains outside the controls in every measured layout. Receipt: [results.json](docs/evidence/ci/results.json); screenshots alongside it.
- CUA local verification: **1366×768, 390×844 and 320×800**. Drag/Undo, stereo preset, A/B copy and independent precise placement (B speaker 2 X2.1 versus A X2.0), Save/reload/Restore muted, 3D selected-speaker carryover, no console errors. [Desktop](docs/evidence/cua-1366.png), [narrow phone](docs/evidence/cua-320.png). The temporary tab was closed and viewport reset.
- First CI run **failed** on a same-task AudioParam value read immediately after replacement. Review found final-speaker removal redundantly scheduled a fade after the explicit zero. The final version removes that fade and cancels prior automation before zeroing. The real-browser assertion waits at most one second for the render thread's AudioParam acknowledgement, then requires **exact zero**; it also requires the logical stopped state. Second run passed all three complete workflows.
- Final diff review retained all original presets, independent sounding speakers, coordinate controls, movement and legacy saves. The unused default low-pass cutoff is now 20 kHz so the advertised 100–2000 Hz tone range is not unintentionally filtered. Room geometry now agrees with the Y0–5 controls. The 3D renderer is skipped while the map is visible.
- **Not run / not claimed:** physical touch devices, audible headphone/device quality, hearing comfort, calibrated acoustics, or production byte verification. Parent owns public promotion. Browser CI starts a real AudioContext but mutes the headless output; model tests use API doubles.

## Release scope

Only `index.html` is a runtime asset. The candidate branch is `codex/audiosim-spatial-workbench`; later commits containing this report/screenshots do not change runtime bytes. Source remains one static HTML file with the existing pinned Three.js CDN dependency. No new production dependencies, accounts, hardware operations or portfolio edits.
