# Acoustic model and limits

## Coordinates and source level

Positions are metres; +Y is up; heading 0° faces −Z and 90° faces +X. A room is a closed prism with a strictly convex, counter-clockwise 3–12-corner footprint, horizontal floor and ceiling. Editing currently moves existing corners; importing can supply another valid corner count. Concave rooms, holes and interior obstacles are intentionally unsupported so visible first-order paths can be validated reliably.

Each source is a stationary sine oscillator with frequency, phase, direction and relative level. A level L gives reference pressure amplitude `10^(L/20)`. The distance amplitude factor is `1/max(1,r)`, where r is path length in metres. Thus energy falls as inverse-square beyond 1 m; the near field is clamped rather than singular. This is not calibrated sound pressure level (SPL).

Directional sources use an idealized cone: full gain within 65% of the outer half-angle, a linear pressure transition, and 0.08 rear gain. An omnidirectional 360° source bypasses the cone. This is a teaching control, not a measured loudspeaker directivity dataset.

## First-order image sources

The model mirrors each source across each vertical wall and across the floor/ceiling. For an image/receiver pair, it intersects their connecting line with the reflecting plane. It accepts only intersections between the image and receiver, on the finite wall segment and within room height, or inside the footprint for floor/ceiling hits. A valid hit and interior endpoints keep both path legs inside a convex room. Reflections obey equal incidence/reflection angles; tests cover horizontal and vertical normals.

The image-to-receiver distance equals the sum of the two physical path legs. Directional gain uses the **first leg from the physical source to the wall hit**, not a fictitious source pointing directly at the receiver. Propagation delay is `pathLength / 343` seconds. Speed of sound is fixed at 343 m/s; there is no temperature/humidity model.

Material absorption alpha is log-frequency-interpolated between illustrative values at 125 Hz, 1 kHz and 8 kHz. Pressure reflection is `sqrt(1-alpha)`; energy reflection is `1-alpha`. Values are **not certified material coefficients**, nor an impedance/phase-inverting boundary model. The optional air-loss setting adds `airLoss * (frequency/1000)^1.3 * length` dB attenuation. Its default is zero; this heuristic is not an ISO atmospheric absorption implementation.

The finite-plane/visibility requirement follows the image-source method described in the [Wayverb image-source explanation](https://reuk.github.io/wayverb/image_source.html). This implementation restricts room geometry instead of implying general obstacle/concave-room visibility support.

## Energy versus phase maps

Let g be a path's attenuated amplitude and phi its source phase minus `2*pi*frequency*pathLength/343`.

- **Energy coverage:** sum `g*g` for all accepted paths. Phase is deliberately ignored. This is an incoherent coverage estimate, not the exact instantaneous output of correlated sine sources.
- **Phase interference:** sum `g * exp(i*phi)` within each group of **exactly equal frequencies**, square the complex magnitude, then sum powers across frequency groups. Unlike frequencies are treated as time-averaged uncorrelated components; beat envelopes and finite-time cross terms are not simulated.

Map values are `10*log10(power)` relative to the reference source. Display colors saturate at −60/0 dB; direct probe readouts are not clamped to that color range. Empty/muted scenes have zero modeled power. Cells outside the room are masked.

The 2D and 3D views display the same horizontal slice at the selected height. A 2D plan is **not** a separate cylindrical 2D-wave propagation model. Fine mode is still a finite grid. The warning threshold asks for four samples per shortest wavelength; this is a practical warning, not a guarantee that all spatial interference features are resolved. The listener probe evaluates the model directly and does not sample/interpolate the map.

## Audible preview

An explicit click constructs/resumes the Web Audio graph. Each unmuted source has a phase-consistent oscillator; parameter edits crossfade oscillators rather than abruptly restarting them. Direct paths use HRTF panning; reflections use less expensive equal-power panning positioned at the wall hit, with the full propagation delay and shared model gain. Panner distance rolloff is zero because the acoustic path model already applied attenuation.

The listener's position **and facing/up orientation** are synchronized. Orbiting the camera does not move the listener. Parameter smoothing makes dragging less abrupt; it is not a physically accurate moving-source/Doppler solver. Preview normalization uses an upper bound based on total path gains, followed by compression and a quiet master setting. Device volume remains outside the app's control.

HRTF filtering, stereo panning, smoothing, normalization and compression mean the audio is **an audition, not a calibrated realization of the scalar map**. Energy coverage intentionally omits phase while the sine preview necessarily contains it. There is no microphone/audio-file input or frequency-response measurement.

Native API behavior is documented in the [Web Audio specification](https://webaudio.github.io/web-audio-api/) and [Web Audio best practices](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices).

## Deliberate exclusions

No higher-order bounces, diffraction, scattering, transmission through walls, interior obstacles, late reverberation, modal/FDTD/FEM solution, frequency-dependent complex boundary impedance, volumetric acoustic rendering, perspective/first-person camera or calibration. The 3D view is an efficient orthographic Canvas schematic with explicit XYZ geometry, not a general-purpose WebGL renderer. Animated path dots are slowed explanatory markers, not sound-speed wave fronts.

For actual room design, those omitted effects and real source/material data can matter substantially. Use this app to explore the stated simplified relationships, not to certify treatment choices or exposure levels.
