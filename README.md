# 3D Speaker Simulator

[Open the simulator](https://generalgroovy.github.io/audio-sim/). Explore how virtual speaker positions and listener movement affect browser spatial audio. This is a visualization prototype, not a calibrated room-acoustics model.

## Use it

1. The **Room map** shows speakers as numbers and you as the blue arrow, facing forward. Drag a marker to move it. **Speakers** edits the selected speaker; **Listener** moves your listening position.
2. Select **Start audio** to listen. **Stop audio** mutes the output. Every fresh page, restored scene, arrangement switch and Undo starts muted.
3. Use **A / B** inside **Compare & save** to keep two independent arrangements. **Copy A to B** gives you a starting point for a variation. Switching retains your edits and stops audio; start explicitly to listen again.
4. **Undo** recovers the last edit, removal, preset, restore or comparison overwrite (up to 40 changes this session). A slider or map drag is one change.
5. **Save A + B** stores both arrangements in this browser. The adjacent status tells you when later edits are unsaved. **Restore saved** validates the entire save before replacing both current arrangements; older single-scene saves remain compatible. Restore itself can be undone.

When you return with a usable save, **Saved arrangements** shows the saved speaker counts and the arrangement it will open. **Continue saved work** restores both arrangements, stays muted, and puts keyboard focus on the restored speaker (or Add speaker for an empty room). **Undo** brings back the workspace you had before continuing, including any new edits. **Keep current** dismisses the card without changing your work or the saved copy; **Compare & save → Restore saved** remains available. A failed restore keeps your current work and offers another try.

Sliders affect the selected speaker; Start/Stop affects all speakers. Speakers remain sounding when deselected. **Remove** stops and removes the selected speaker. Removing the last speaker mutes output and offers **Add speaker** or **Undo** to recover. Undo returns keyboard focus to the restored map marker (or the speaker selector in 3D view). Presets provide Single tone, Stereo pair, and Four corners. **Use preset in A/B** names the arrangement it replaces, and stops audio; the other arrangement stays intact. Blocked/full/corrupt storage leaves the active scene usable. Scene files, recording, and export are not implemented.

**3D view** preserves the selected speaker and arrangement. Return to Room map to find speakers behind you. **Exact position** edits left/right (X), height (Y), and front/back (Z) in scene units. Negative X is left; negative Z is forward. Tab to a map marker and use arrows to move it by 0.5 scene units, or Shift+arrow for 0.1. WASD and the four arrow buttons move the listener; **Reset listener** restores the initial listening position and keeps every speaker in place. The Selected speaker list selects overlapping or crowded markers.

Speaker positions are bounded to X/Z ±5 and Y 0–5, frequencies to 100–2000 Hz, and scenes to 32 speakers. Existing saves with a distant listener stay valid; the map expands and Reset listener can recover the view. The listener faces negative Z in both views. Scene units do not establish real-world room dimensions.

On phones, the map or 3D canvas stays above the scrollable controls. Start/Stop stays within reach while the pane scrolls. Local storage is site/browser-specific, not a portable backup. History resets on reload; saved A/B arrangements remain available through Restore saved.

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

The Quality GitHub Actions workflow runs actual Chromium interactions at 1366×768, 390×844, 320×844, 844×420 and 320×420, saving screenshots and a JSON receipt. The browser suite covers drag/Undo and focus, keyboard placement/height, explicit audio state, A/B edit preservation, save feedback/reload/restore, returning-user recovery and keeping current work, removal recovery, scoped presets, listener reset and map/3D switching. See [the saved-work flow record](PROJECT-UX-FLOW-2026-10-07.md), [the previous UX record](PROJECT-UX-2026-10-07.md) and [the quality record](PROJECT-QUALITY-2026-10-06.md) for evidence and limitations. Human listening remains necessary to judge the actual audio device and spatial effect. Walls are visual guides: reflections, room dimensions, absorption and speaker calibration are not simulated or validated.
