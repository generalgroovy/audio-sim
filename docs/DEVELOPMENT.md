# Develop, test and host

## Run locally

Node 20+ is needed only for the supplied scripts. The app itself is static HTML/CSS/JavaScript with no runtime package dependencies.

```sh
npm run serve
npm run check
npm test
npm run benchmark
```

The server defaults to `127.0.0.1:8080`. Set environment variables `PORT`, `HOST` or `BASE_PATH` to change it. `BASE_PATH` must end in a slash, for example `/audio-sim/`. The preview blocks hidden-file and escaping-symlink reads; it remains a development server, not a public production backend.

No `npm install` or build step is required. Direct `file://` loading is unsupported because of browser module/worker restrictions.

## Browser checks

```sh
python -m pip install playwright==1.57.0
python -m playwright install chromium
python tests/browser_smoke.py
```

The script starts/stops its own server. `SIM_BROWSER` selects a Chromium executable; `SIM_RESULTS` selects the report directory; `SIM_TEST_BASE=/audio-sim/` exercises project-subpath hosting. CI runs this native HTTP test with modules, a browser worker, reload persistence and actual downloads. It also runs Node checks on Linux 20/22/24 and Windows 22.

`SIM_IN_MEMORY=1` is a restricted-environment fallback using inlined source and a storage shim. It **does not validate** native module loading, HTTP navigation, persistent storage or downloads. Do not treat its results as equivalent to the normal run.

## Architecture

| Files | Responsibility |
| --- | --- |
| `src/model.js` | Scene schema, convex geometry, constraints, presets, history. |
| `src/acoustics.js`, `src/audio.js` | Pure path/field calculation; Web Audio lifecycle. |
| `src/field-controller.js`, `src/field-worker.js` | Cached background work, latest-edit scheduling, fallback. |
| `src/analysis.js`, `src/inspection.js` | Exact listener reports and arrival table/plot. |
| `src/projection.js`, `src/view.js`, `src/visual.js` | Coordinate projection, Canvas drawing, palette and contours. |
| `src/app.js`, `index.html`, `style.css` | Interaction, accessible DOM controls and layout. |

Preserve the shared scene and independent camera/listener. Visual state must not become simulation input. View changes must not rebuild the sound field or reschedule audio parameters. Keep expensive calculation out of idle rendering; contour geometry is cached on field completion. JSON schema remains version 2.

## Static hosting

Publish the repository root on a static HTTP host. Relative assets support a GitHub Pages project subpath. On GitHub, select the intended branch and root folder in Pages settings after merging the desired code. The validation workflow does not deploy or change those settings. Do not call a review branch live merely because CI passes.

## Evidence, not promises

The workflow result and its `browser-results` artifact identify the exact tested commit. Solver benchmarks exclude rendering/audio and are machine-dependent, not FPS guarantees. Physical devices and other browsers require separate verification.

Historical implementation records: [2.0 audit](AUDIT.md), [2.1 audit](ITERATION-2.1.md). These are point-in-time records, not current test status. [Visual design](DESIGN.md) explains the presentation contract.

[Overview](../README.md) · [Usage guide](GUIDE.md)
