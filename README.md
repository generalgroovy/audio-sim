# 3D Speaker Simulator

[Open the simulator](https://generalgroovy.github.io/audio-sim/). Explore how virtual speaker positions and listener movement affect browser spatial audio. This is a visualization prototype, not a calibrated room-acoustics model.

## Use it

1. Select **Start audio**. Output starts muted and only enables after this action; **Stop audio** mutes it again.
2. Click a speaker in the scene or choose it from the **Speaker** list. The selected speaker is yellow, and the volume/frequency sliders show that speaker's settings.
3. Adjust **Volume** or **Frequency** for the selected speaker; the readouts show its percentage and Hz.
4. **Add Speaker** adds another independently sounding speaker at a random position and selects it.
5. Use **W / A / S / D** or the four arrow buttons to move the listener through the room. The camera and audio listener move together.

Sliders affect the selected speaker; Start/Stop affects all speakers. Speakers remain sounding when deselected. **Remove** stops and removes the selected speaker. Removing the last speaker mutes output; add another and select **Start audio** to continue. No scene persistence, file import, recording or export is implemented.

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

The tests cover initial mute, explicit start/stop, rejected audio startup and selected-speaker controls with API doubles. In a real browser, verify Start/Stop, add/select speakers and move the listener. Human listening remains necessary to judge the actual audio device and spatial effect. Walls are visual guides: reflections, room dimensions, absorption and speaker calibration are not simulated or validated.
