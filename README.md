# 3D Speaker Simulator

[Open the simulator](https://generalgroovy.github.io/audio-sim/). Explore how virtual speaker positions and listener movement affect browser spatial audio. This is a visualization prototype, not a calibrated room-acoustics model.

## Use it

1. The **Room map** shows speakers as numbers and you as the blue arrow, facing forward. Drag a marker to move it; select a speaker to edit its volume and frequency.
2. Select **Start audio** to listen. **Stop audio** mutes the output. Every fresh page, restored scene, arrangement switch and Undo starts muted.
3. Use **A / B** inside **Arrange & compare** to keep two independent arrangements. **Copy A to B** gives you a starting point for a variation. Switching retains your edits and stops audio; start explicitly to listen again.
4. **Undo** recovers the last edit, removal, preset, restore or comparison overwrite (up to 40 changes this session). A slider or map drag is one change.
5. **Save** stores both arrangements in this browser. **Restore** validates the entire save before replacing your current work; older single-scene saves remain compatible. Restore itself can be undone.

Sliders affect the selected speaker; Start/Stop affects all speakers. Speakers remain sounding when deselected. **Remove** stops and removes the selected speaker. Removing the last speaker mutes output; add another and select **Start audio** to continue. Presets provide Single tone, Stereo pair, and Four corners. Apply resets the current arrangement and stops audio. Blocked/full/corrupt storage leaves the active scene usable. Scene files, recording, and export are not implemented.

**3D view** preserves the selected speaker and arrangement. Return to Room map to find speakers behind you. **Position** edits exact X/Y/Z speaker coordinates. Tab to a map marker and use arrows to move it by 0.5 scene units, or Shift+arrow for 0.1. WASD and the four arrow buttons move the listener; **Home** restores the initial listener position. The Speaker list selects overlapping or crowded markers.

Speaker positions are bounded to X/Z ±5 and Y 0–5, frequencies to 100–2000 Hz, and scenes to 32 speakers. Existing saves with a distant listener stay valid; the map expands and Home can recover the view. The listener faces negative Z in both views. Scene units do not establish real-world room dimensions.

On phones, the map or 3D canvas stays above the scrollable controls. Start/Stop remains at the top of that pane. Local storage is site/browser-specific, not a portable backup. History resets on reload; saved A/B arrangements remain available through Restore.

Each speaker retains its requested level. Actual pre-panning gains share a 0.7 total amplitude budget as more/louder sources are added. This is not a measured loudness guarantee; device volume and listening remain the user's controls. The browser's HRTF panner uses inverse-distance attenuation.

## Run

Serve the repository root with a static HTTP server, for example:

```sh
python -m http.server 8080
```

Open `http://localhost:8080`. There is no build step. `index.html` contains the scene, controls and audio graph. It loads the pinned Three.js 0.160.0 browser build from jsDelivr, so the first load requires that CDN to be reachable. WebGL and Web Audio support are required.

## Verify

With Node.js 18 or newer:

```sh
node --test tests/audio.test.cjs
```

The tests cover initial mute, explicit start/stop, rejected/stale audio startup, selected-speaker controls, A/B scene round trips, legacy saves, invalid scene preservation, storage failure, gain/count bounds, compound Undo, precision keyboard edits, and stale pointer events after a scene replacement with API doubles.

The Quality GitHub Actions workflow also runs actual Chromium interactions at 1366, 390 and 320 pixels, saving screenshots and a JSON receipt. The browser suite covers drag/Undo, keyboard placement, explicit audio state, A/B edit preservation, save/reload/restore, removal recovery and map/3D switching. See [the quality record](PROJECT-QUALITY-2026-10-06.md) for evidence and limitations. Human listening remains necessary to judge the actual audio device and spatial effect. Walls are visual guides: reflections, room dimensions, absorption and speaker calibration are not simulated or validated.
