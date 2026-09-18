# Audio Sim 2.1 — spatial sound sandbox

A small, dependency-free browser app for arranging speakers, exploring a room in **2D plan or orbitable 3D**, viewing relative sound coverage/interference, and auditioning direct sound plus first-order reflections. Both views edit the **same metre-based XYZ scene**.

**Educational approximation, not an acoustic measurement or full-wave room solver.** The 3D view is an orthographic Canvas projection; its heatmap is a horizontal height slice, not a volume. No WebGL, CDN, account, backend, analytics, build step, or npm runtime dependencies.

## Run

Install Node.js 20 or newer, open a terminal in this folder, and run:

```sh
npm run serve
```

Open **http://localhost:8080**. No `npm install` is needed for the app or Node tests. On Windows, Linux, and macOS the same command works. An alternate static HTTP server is also sufficient. For a Pages-like local subpath, set `BASE_PATH=/audio-sim/` in the environment; the trailing slash is required. The preview server blocks hidden-file and escaping-symlink reads, but is still not a production web server. Opening `index.html` directly via `file://` is unsupported because of browser module/worker restrictions.

Click **Enable audio** to listen. Start with a low device volume. The default output is deliberately quiet and independent of the relative map values. Nothing plays automatically.

For another local port, set the `PORT` environment variable before running the server. The included server binds to loopback by default; `HOST` can override that for a trusted LAN. It is a development preview server, not a production internet-facing backend.

## What is included

| Area | Controls and behavior |
| --- | --- |
| 2D plan | Drag speakers/listener, edit convex room corners, inspect coverage and reflection paths. |
| 3D orbit | Orbit, pan, zoom, view speaker heights, floor/ceiling/wall paths and an adjustable height slice. Drag objects at their existing height; change height numerically, with Page Up/Down or by Alt-dragging. Optional placement snapping keeps layouts regular. |
| Sources | Up to 16; add, duplicate, delete, mute; names, logarithmic 20 Hz–16 kHz frequency, relative level, XYZ, horizontal direction, vertical tilt, cone, phase and solo. |
| Room | Rectangular resize or draggable convex footprint; independent wall/floor/ceiling absorption presets; optional heuristic air loss. |
| Maps | Incoherent energy coverage, coherent same-frequency phase interference, or off. Three grid budgets, room masking and an undersampling warning. |
| Audio | Explicit enable/pause; direct HRTF, equal-power early reflection panning, path delays, gain smoothing, oscillator crossfades, conservative headroom and compression. |
| Workflow | Reference/stereo/interference/empty plus illustrative 5.1, 7.1 and 7.1.4 layout presets; guarded local autosave; validated JSON import/export; bounded undo/redo; PNG view export with scale/context, CSV arrival export, mobile layout and in-app help. |

The **listener marker**, not the orbit camera, determines the listening position. Camera movements do not change the sound or trigger a new field calculation. This replaces the original prototype's camera-follow listening with an explicit, inspectable receiver.

The reference preset has one low (80 Hz), one mid (1 kHz), and two high (5/8 kHz) sources at −12 dB relative source level. The interference preset provides a symmetric 80 Hz cancellation example with reflections disabled.

## New in 2.1

[Iterative audit and verification scope](docs/ITERATION-2.1.md) records the reproduced defects, regression tests and same-machine benchmark.

The iterative review fixes audio start/pause races, scene replacement during resume, interruption recovery, stalled/foreign worker responses, asynchronous import ordering and room-corner drag drift. Rapid source edits are coalesced at animation-frame boundaries; pure camera gestures do not repeatedly rebuild the inspector or listener analysis. Audio start has a bounded timeout and removed graphs are explicitly disconnected even when a context is suspended or closed.

**Tilt** aims speakers up/down and tilts the listener's head independently of the camera. **Solo** isolates one or several sources consistently in audio, maps and reports; mute takes precedence. Layout presets are illustrative positions and sine tones, **not** surround decoders or certified speaker-placement guidance.

Open **Listener arrivals** for the selected speaker's finite reflection paths, distances, relative gains and geometric arrival delays. Select the listener to inspect all audible sources. The table displays at most 48 paths; CSV exports the entire report. Arrival times exclude audio-device latency; the plot is a path-gain schematic, not a calibrated impulse response. PNG snapshots include room dimensions, slice height and a relative dB scale.

The JSON scene schema remains version 2. Older scenes import with zero tilt, no solo and snapping off. File imports are size-bounded and validated before replacement; a delayed import cannot override a newer preset/import/undo decision. Exported CSV names are escaped and protected against spreadsheet formula execution.

## Controls

Drag an object to move it. Drag empty space to orbit in 3D; Shift-drag or right-drag to pan. Scroll or use +/− to zoom; **Fit** restores the overview. Enable **Edit corners** to drag the gold room handles. Invalid/crossing/concave outlines are not accepted.

With focus on the canvas: **2 / 3** changes view; **WASD** moves the listener relative to its facing direction; **Q / E** turns it; Page Up/Down changes the selected height; arrows nudge the selected object; Shift moves faster. **L** selects the listener, **Delete** removes a source, **Home** fits, **Ctrl/Cmd+Z** undoes, and **Ctrl/Cmd+Shift+Z** redoes. Shortcuts do not take over text fields, sliders, selectors or the help dialog.

## Performance design

- The map is computed once per acoustically meaningful change. Camera, listener, selection, name, output-volume and view-mode changes reuse it.
- A module worker calculates typed-array grids. There is at most one running job and one latest pending edit; stale results are discarded. A watchdog recovers from stalled workers. A time-budgeted, at-most-four-row, yielding main-thread fallback handles unavailable workers.
- Image sources and frequency/directivity constants are prepared outside grid loops. Reflection-hit storage and complex-pressure arrays are reused.
- 2D and orthographic 3D reuse one cached Canvas texture; the 3D slice is an affine `drawImage`, not thousands of per-cell polygons.
- Rendering sleeps while idle. Optional path animation is visual only. Device pixel ratio is capped at 2. Audio parameter targets are only rescheduled when changed.
- Hidden tabs pause audio and animation. Audio requires another explicit enable after returning. Deleting/muting sources cleans up their oscillator and path graphs.

Default balanced coverage uses **96 × 77 = 7,392** samples in the 10 × 8 m reference room. Set Fast or disable the map/reflections for constrained devices. Fine coherent maps at high frequencies still cannot resolve every interference fringe; the app warns rather than implying otherwise.

## Validation and development

```sh
npm run check
npm test
npm run benchmark
```

Optional real-browser integration tests:

```sh
python -m pip install playwright==1.57.0
python -m playwright install chromium
python tests/browser_smoke.py
```

The browser script starts and stops its own local HTTP server. `SIM_BROWSER` can select a Chromium executable. `SIM_RESULTS` selects the screenshot/report directory. `SIM_IN_MEMORY=1` is an explicitly limited fallback for environments that prohibit navigation: it inlines local source and substitutes a storage adapter. It does **not** validate native ESM loading, native storage persistence or HTTP hosting. It does not change browser policies.

The CI workflow runs syntax/unit checks on Linux with Node 20/22/24 and Windows with Node 22, then the HTTP browser suite on Chromium at the `/audio-sim/` project subpath. A passing local in-memory run is **not** a claim that CI or every browser passed; see [the audit record](docs/AUDIT.md).

## GitHub Pages

All runtime assets use relative paths and can be served from a GitHub Pages project subdirectory. After merging the desired code, configure Pages to deploy the repository root of the chosen branch. No bundling or build output is required. The included workflow validates changes; it does not change Pages settings or automatically deploy a review branch.

## Code map

`model.js` owns validated scene data/geometry/history; `acoustics.js` owns the pure path and field model; `audio.js` owns native audio lifecycle; `analysis.js` caches exact listener/path reports, `inspection.js` renders the arrivals table; `projection.js` and `view.js` own rendering; `field-controller.js` / `field-worker.js` own background work; `app.js` owns DOM interaction. Tests and benchmark scripts have no Node package dependencies.

Read [MODEL.md](docs/MODEL.md) for equations, assumptions and limitations, and [AUDIT.md](docs/AUDIT.md) for baseline findings, measurements and verification scope.
