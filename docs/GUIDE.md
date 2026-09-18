# Use Audio / Sim

## Your first comparison

Choose **Four frequencies** to explore coverage, **Stereo pair** to explore direction, or **Opposite phases** to see cancellation. Drag the white listener. The large **At the listener** reading evaluates that location directly, independently of map resolution.

Switch between 2D and 3D: source positions, receiver position and audio do not change. Enable audio explicitly at a low device volume. The app pauses audio when hidden; enable it again after returning.

## Move and edit

| Task | Action |
| --- | --- |
| Move a speaker or listener | Drag its marker, or edit its XYZ fields. |
| Change height | Edit Height, use Page Up/Down, or Alt-drag the object in 3D. |
| Orbit / pan / zoom | Drag empty space in 3D / Shift-drag or right-drag / scroll or +/−. |
| Restore the overview | Fit or Home. |
| Reshape the room | Enable Edit corners; drag a gold corner. Invalid outlines are rejected. |
| Aim a source | Bearing is horizontal, Tilt vertical, Spread the cone width. |
| Isolate sources | Solo one or several. Mute always takes precedence. |

Grid snapping applies to pointer placement. Numeric fields and keyboard nudges remain precise; room-boundary clearance takes priority over snapping. In the source list, a left stripe and active background identify selection; excluded sources have dashed borders and status text. Canvas slash marks indicate excluded sources.

## Understand the display

**Energy coverage** adds path energies without phase. **Phase interference** combines equal-frequency pressures before adding energy across frequency groups. **No sound map** hides the field without stopping the probe or audio.

**Map height** selects a horizontal slice in either view; it does not move sources or the listener. **Level contours** follow sampled estimates at −48, −36, −24, −12 and 0 dB. They do not create extra resolution. Heed the high-frequency sampling warning; switching contours off does not recalculate acoustics.

Source color identifies its frequency band, not its loudness. Heatmap color encodes relative level. Direct paths are solid; reflections dashed. The axis compass tracks world X/Y/Z orientation, not the listener's head.

**Listener arrivals** shows the selected source's paths; select the listener for all audible sources. The plot is a geometric arrival sketch, not a measured impulse response. Times exclude device latency; levels are not calibrated SPL.

## Keyboard

Focus the canvas first. **2 / 3:** plan/orbit. **WASD:** move listener. **Q / E:** turn listener. **Arrows:** move selected object. **Page Up / Down:** selected height. **Shift:** faster movement. **L:** select listener. **Delete:** remove source. **Home:** fit. **Ctrl/Cmd+Z:** undo; add Shift to redo. Form fields retain their normal keyboard controls.

## Keep your work

**Export** saves the scene as JSON; **Import** restores one. Undo can restore the previous scene. Autosave is browser-local, not a backup. **PNG** exports the field view with dimensions and a relative-level legend. **Export arrivals CSV** includes all paths even when the table displays only 48 rows. Names are escaped for spreadsheet safety.

Nothing is uploaded. Contour visibility is a view preference for this session and is not part of exported scene data.

## When something looks wrong

No audio: click Enable audio again, check mute/solo and device volume. Slow editing: choose Fast map, or switch the map/reflections off. Missing fine interference: lower the frequency or use a finer grid; this is still a sampled approximation. A stalled worker falls back automatically. Back up with JSON when local storage is unavailable.

[Model limits](MODEL.md) · [Setup and hosting](DEVELOPMENT.md) · [Back to overview](../README.md)
