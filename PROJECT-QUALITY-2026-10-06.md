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
- Candidate checks: pending implementation.
