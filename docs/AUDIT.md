# Audit and verification record — 2026-09-18

## Inspected baseline

Main commit: `cfdcdc567610cd6e4de41b852dc4309b397f547f`.
Previous 2D commit: `92a5525e7249e157eb2d684903544c681b0de7ef`.

The current repository contained only a 4.6 KB `index.html`. The main version was a Three.js r160 CDN prototype: wireframe box, cube speakers, click selection and keyboard camera translation. It had no 2D mode or automated tests. The earlier 2D implementation had stray closing tokens after `reflect()` that prevented script parsing, and computed unvalidated image sources within the pixel/source loop every frame.

| Finding | Implemented response |
| --- | --- |
| Earlier 2D broken; main 3D replaced rather than shared it | A common scene, path model and texture with 2D/orthographic 3D projections |
| Unbounded idle animation and audio position writes | On-demand draw scheduling, edit-driven audio updates, value-target deduplication |
| AudioContext/oscillators constructed at load | Explicit enable, resume/pause and hidden-tab suspension |
| No source removal/graph disposal or master headroom | Voice lifecycle, cleanup, quiet normalized master and compression |
| Selected source not reflected in slider values | Synchronized inspector and selection tests |
| Main had no room reflection simulation; old mirrors were unchecked | Finite wall/floor/ceiling hits and shared first-order path gains/delays |
| Arbitrary UI click selection, no drag or touch model | Canvas-scoped pointer capture, drag/orbit/pan, keyboard input guards |
| CDN/rendering dependency and no persistence/tests/docs | Native Canvas/Web Audio, validated JSON/local storage, test suite and model documentation |

The renderer change is a deliberate scope tradeoff: this is a lightweight room layout/acoustic sandbox, not a full perspective 3D engine. It retains three-dimensional source geometry, height placement, camera orbit, source selection and spatial listening while adding an explicit listener marker. It does not preserve camera-follow first-person listening; camera and receiver are now independent.

## Locally executed validation

- **59 Node tests passed:** geometry/validation/history, path equations and reflection-angle/containment checks, energy/phase behavior, field chunk equivalence, projection round trips, audio lifecycle/parameter deduplication, worker coalescing/cancellation/fallback and an actual Node worker-thread field transfer.
- **33 Chromium integration checks passed:** explicit audio enable, native Web Audio start/pause and graph cleanup, actual OfflineAudioContext phase cancellation, mode switching, cache reuse, idle scheduling, both-mode dragging, corner editing, input selection synchronization, undo/redo, keyboard guards, import rejection/plain-text names, source limit and responsive layout. No uncaught page errors were recorded.
- Syntax/markup checks passed: 16 JavaScript files, 72 unique HTML IDs, no external runtime asset URLs.

### Important browser test limitation

The available Chromium 144.0.7559.96 has a managed all-URL navigation block. Policies were not modified. Local integration testing therefore used `SIM_IN_MEMORY=1`: the same local source was inlined into an in-memory page, and localStorage was substituted by a test-only adapter. The browser worker could not start under that environment, so these runs exercised the chunked fallback. **HTTP navigation, native browser ESM/module-worker loading, native storage persistence, GitHub Pages deployment, other browsers and real mobile hardware were not locally verified.** The actual worker module was separately executed in a Node worker thread; that is not a browser-worker compatibility claim.

The committed optional browser script defaults to real HTTP/native modules and adds native persistence/worker assertions. CI is configured to run that mode. This record does not claim a CI outcome before one is observed.

## Measured solver optimization

Synthetic warmed solver-only benchmark on Node v22.16.0, Intel Xeon Platinum 8370C @ 2.80 GHz. Three warmups and seven measured runs per configuration; medians below. Reference 10 × 8 m room, first-order reflections, energy coverage. Audio, rendering, startup and frame rate are excluded. Results vary by device and system load.

**The before column is the first implementation of the NEW solver during this work, not the original repository.** Main did not contain an equivalent sound-map solver, so no honest like-for-like original-app FPS comparison is available.

| Quality | Sources | Samples | First pass ms | Optimized ms |
| --- | ---: | ---: | ---: | ---: |
| Fast | 4 | 2,520 | 12.04 | 5.21 |
| Fast | 16 | 2,520 | 46.58 | 18.23 |
| Balanced | 4 | 7,392 | 33.57 | 10.67 |
| Balanced | 16 | 7,392 | 140.60 | 41.94 |
| Fine | 4 | 20,480 | 102.30 | 32.54 |
| Fine | 16 | 20,480 | 369.59 | 131.91 |

The hot-loop changes cached gain/frequency/phase/directivity terms, reused reflection-hit storage, removed redundant footprint tests for finite convex-wall hits, used bounded-coordinate square-root distances, and skipped unnecessary complex-buffer resets in energy mode. The resulting Float32 maps matched saved pre-optimization outputs exactly for reference, stereo and interference presets (maximum absolute difference zero).

More important than a single timing is avoiding work: the browser checks observed no added draw calls, field jobs or audio writes during an idle sampling interval; switching mode or orbiting did not recompute the field; view-only changes did not reschedule audio parameters. This does not imply the browser/audio hardware consumes zero power.

Reproduce current solver timings with `npm run benchmark`. Historical before/after measurements are in [benchmark-record.json](benchmark-record.json). The implementation has fixed quality budgets rather than unverified claims of automatic 60 FPS on all devices.

## Remaining work beyond this revision

Full HTTP/Pages validation in an unrestricted browser; Firefox/Safari and physical mobile performance/listening checks; optional perspective/WebGL renderer if the project later needs free navigation; measured source/material data and higher-order room acoustics if the scope expands. Those are not represented as completed features.
