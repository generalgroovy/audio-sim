# Iterative audit — Audio Sim 2.1

Baseline: PR #1 head `dc986863343e77af770fd2667a9d231ab1357bae` (tree `ca3c7148f826e3764a6660bcb5e6613707ea63df`). The mounted source package's Git tree was checked against that exact tree before editing. Main and deployment settings are not part of this revision.

## Pass 1 — reproduce and fix lifecycle defects

Four additional regression tests failed on the unchanged baseline: an older audio resume could suspend a newer successful start; a scene replaced during resume was ignored; an external interruption left the playback-enabled state stale; and an unrelated worker reply released the occupied job slot. All four pass after the fixes. The lifecycle suite also covers resume timeout/retry, a late resume after pause, explicit disconnection without onended callbacks, closed-context recreation, silent-worker recovery and late replies from terminated workers.

Audio now tracks current playback intent and the newest scene. Only the newest intent can change playback state; interruption revokes the intent and requires explicit enable. Removed/retired graphs are disconnected even when playback is suspended or closed. Resume is bounded by a five-second timeout. Worker replies must match the running request; a watchdog and decoding/error handlers fall back to bounded, yielding solver chunks.

## Pass 2 — spatial controls and useful inspection

Both speaker and listener support vertical tilt. Listener forward/up vectors stay orthonormal, including vertical orientations. Directivity and compiled field evaluation include the vertical component; height-layout speakers aim at the central receiver.

Solo (including multiple solo sources) filters audio, maps, paths and probe consistently, with mute precedence. Added illustrative 5.1, 7.1 and 7.1.4 positions; these are not certified placement recommendations or surround decoders. Existing version-2 scenes import with safe defaults for the new properties.

Added optional pointer grid snapping, Alt-drag height editing in 3D, Page Up/Down height nudging, exact listener-arrival tables and a path-gain timeline. The all-source table is capped at 48 visible rows, but CSV includes every path. Source names are escaped and formula-protected in CSV. PNG export includes room dimensions, slice height and the relative dB scale.

## Pass 3 — interaction, scheduling and portability

Room-corner dragging freezes the projection during the gesture so the handle stays under the pointer. Source edits are batched at animation-frame boundaries: the browser regression sends 50 synchronous edits and observes one field request. Camera-only gestures bypass acoustic/audio updates; listener analysis has its own cache and ignores display-only settings. Energy maps also ignore phase-only changes. Stale maps are hidden while a replacement is pending rather than displayed at a new, incorrect slice height.

Asynchronous imports carry a generation token so an earlier slow read cannot overwrite a newer preset/import/undo decision. Input files remain size-bounded and atomically validated. Hidden/page-exit audio pause is immediate; page restoration refreshes rendering. The Node test command uses test discovery instead of shell glob expansion, and the CI matrix now includes Windows. The local preview server supports a Pages-like base path and rejects hidden files and paths/symlinks outside its root. It remains a local development server, not a production backend.

## Executed local verification

- Original suite: **59/59 passed** before modification.
- Four new regressions: **59 passed / 4 failed** against baseline, before fixes.
- Final Node suite: **88/88 passed** on Node 22.16.0, including an actual HTTP server test at `/audio-sim/`.
- Syntax/markup checks: **20 JavaScript files, 81 unique IDs, zero errors**.
- Chromium integration: **52 checks passed**, no uncaught page errors. This includes native Web Audio and OfflineAudioContext checks for staggered oscillator start times and nontrivial phase-plus-delay sums.
- Exact Float32 comparison against the baseline solver: reference, stereo and interference presets at all three quality settings (**nine grids, identical values**).

### Browser execution scope

The local Chromium still blocks HTTP navigation under managed policy. That policy was not changed. Local browser checks therefore use the explicitly documented in-memory harness and test storage adapter, exercising the chunked field fallback. They do not establish native browser ESM/HTTP/worker/persistence/download compatibility. Node's independent HTTP server test is real HTTP, but is not a browser-loading test.

The committed CI runs the native HTTP browser suite at `/audio-sim/`, adds JSON/CSV/PNG download checks, native storage persistence and native module-worker assertions, and tests Node on Linux and Windows. The live PR checks and their uploaded browser report are the authority for hosted-run results; local success alone is not represented as hosted CI success.

## Performance measurements

`iteration-2.1-benchmark.json` records the baseline and this revision on the same AMD EPYC 9V74 / Node 22.16.0 environment: three warmups, seven measured solver runs per configuration. Results fluctuate and some configurations are slightly slower. This revision makes **no blanket solver-speedup or FPS claim**. Its demonstrated savings are avoiding unnecessary field/probe/audio work and coalescing rapid edits while preserving numerical output.

The earlier `AUDIT.md` and `benchmark-record.json` describe the separate 2.0 implementation, its different machine and its own historical comparison; those timings are not comparable to this pass's absolute timings.

## Remaining scope limits

The renderer remains orthographic, not perspective/first-person. Maps are horizontal slices through a 3D simplified model, not a volumetric/full-wave solution. The model remains convex-room, first-order, relative-level acoustics with illustrative materials; no diffraction, furniture occlusion, higher-order reverb, measured transfer functions or real multichannel decoding. Firefox/Safari, physical mobile devices and live GitHub Pages deployment are not established by this local record.
