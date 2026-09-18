# Visual contract — drafting desk

The interface pairs a warm paper inspector with a dark drafting field. Color has a job: green actions/selection, source-frequency bands, warm listener readings, and a separate continuous relative-level scale for the sound map. System sans-serif labels and monospaced quantities need no downloaded fonts.

## Information before decoration

The white listener—not the camera—is the receiver. Its reading is prominent and names the current energy/phase model. Source selection has a background and left stripe; excluded sources have dashed borders, status words and canvas slash marks. Direct/reflected paths differ by line style as well as color. The compass follows actual world axes. Speaker cabinets follow source bearing and tilt; cabinet geometry is illustrative, not a change to the acoustic source model.

Contour strokes come from cached marching-squares geometry at −48, −36, −24, −12 and 0 dB. They interpolate the existing field, skip masked cells and resolve saddle connections with a bilinear decider. Camera motion only projects these segments; toggling them changes neither acoustics nor scene JSON. Contours are never a claim of greater spatial resolution.

## Readability and access

Canvas pastels are not reused as text on paper: `sourceColor` and `sourceInk` are separate palettes. The normal paper text pairs and focus colors have automated contrast checks. Inputs have labels, the frequency slider has an audible hertz/kilohertz description, Help is a named dialog, and a skip link reaches scene controls. Small screens retain undo, redo and all export actions. Coarse pointers get larger controls. Nothing starts moving or playing automatically.

These choices are informed by [WCAG 2.2](https://www.w3.org/TR/WCAG22/), particularly text contrast, non-color state cues, visible focus and target sizing. Targeted checks **are not a full WCAG conformance assessment**; Canvas content still needs the equivalent numeric controls and arrival table.

## Keep documentation separated

The README answers what this is and how to start. GUIDE answers user tasks, MODEL explains equations and limitations, DEVELOPMENT covers tests and hosting. In-app help begins with a one-minute path and hides detail behind named disclosures. Historical audits remain evidence, not first-run instructions.
