# Audio / Sim

**Place speakers. See the field. Hear the room.**

An interactive spatial-sound sketchbook with a 2D plan, an orbitable 3D view, and a shared room model. Drag speakers and the listener, compare energy coverage with phase interference, and inspect reflected sound paths.

## Start

With Node.js 20 or newer, open a terminal in this folder:

```sh
npm run serve
```

Open **http://localhost:8080**. No install, build, account, or external runtime library is needed. Use an HTTP server rather than opening `index.html` directly.

Choose a scene, move a speaker, then switch between **2D Plan** and **3D Orbit**. Click **Enable audio** with your device volume low. **The white listener is where you hear from; the camera only changes the view.**

## Explore

**Place and aim.** Add, copy, mute, solo, or remove up to 16 sine sources. Set frequency, level, position, bearing, tilt, and spread. Edit a convex room outline or start with stereo, cancellation, or surround-layout examples.

**Read and compare.** Energy coverage ignores phase; interference shows reinforcement and cancellation between equal-frequency tones. Both display a horizontal slice at the chosen map height. Optional level contours trace sampled estimates—not additional simulation detail.

**Inspect and keep.** Listener arrivals lists path distances, delays, and relative gains. Scenes save in this browser when storage is available. Export JSON for backup, PNG for the view, or CSV for arrivals. Undo restores edits and replaced scenes.

## Know the limits

This is an **educational approximation, not a room measurement**. Levels are relative, materials illustrative, and reflections first-order only. No diffraction, furniture obstruction, late reverb, full-wave simulation, or calibrated SPL. The 3D view is orthographic; surround presets are layouts, not decoders.

## Find what you need

[Usage and keyboard guide](docs/GUIDE.md) · [Model and equations](docs/MODEL.md) · [Development, testing and hosting](docs/DEVELOPMENT.md) · [Visual design](docs/DESIGN.md)

The in-app **Guide** covers the essentials. Historical audit notes remain in `docs/`, separate from these current instructions.
