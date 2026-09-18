# Model: what the picture and audio mean

Audio / Sim models stationary sine sources inside a **convex prism**, in metres, with +Y up. Bearing 0° faces −Z; positive tilt points upward. The listener and view camera are independent. Both views show the same three-dimensional model; a plan view does not switch to cylindrical 2D propagation.

## Path amplitude

For a source level `L`, path length `r`, direction factor `D` and pressure reflection factor `R`:

```text
gain = 10^(L/20) × D × R × 10^(−airLoss × (frequency/1000)^1.3 × r/20)
       / max(1, r)
```

Pressure falls as `1/r` beyond 1 metre; the inner region is capped to avoid a singularity. Levels refer to a unit source at 1 metre, **not measured sound-pressure levels**.

The idealized cone uses full gain inside 65% of its outer half-angle, a linear pressure transition, and 0.08 rear gain. A 360° spread is omnidirectional. Material energy absorption is interpolated in log frequency between illustrative values at 125 Hz, 1 kHz and 8 kHz; pressure reflection is `sqrt(1 − absorption)`. Optional air loss is a heuristic, zero by default—not an atmospheric standard.

## Reflections and timing

Sources are mirrored across each wall, floor and ceiling. A path is accepted only when its image-to-receiver line hits the **finite surface**. Convexity keeps both path legs inside the room. Directionality is evaluated toward the first hit, not the fictitious image. There is only one reflection per path; no multiple-bounce solution.

Geometric arrival time is `length / 343` seconds, using a fixed 343 m/s speed. The arrivals table reports that delay and `20 log10(gain)`; it excludes device latency and is not a calibrated impulse response.

## Two map modes

| Mode | Calculation |
| --- | --- |
| Energy coverage | Sum `gain²` across valid paths; ignore phase. |
| Phase interference | Within each exactly equal frequency, sum `gain × exp(iφ)`, then square the magnitude. Add powers across different frequencies. |

Here `φ = sourcePhase − 2π × frequency × length / 343`. Different-frequency beats and finite-time cross terms are not modeled. Solo/mute filtering precedes map, probe and audio evaluation.

Map cells show `10 log10(power)` on a fixed −60 to 0 dB color scale. The listener probe evaluates the model directly, not the grid. The sampling warning uses four samples per shortest wavelength as a practical threshold, not a guarantee. Contours interpolate sampled levels; masked cells are excluded. Neither view computes a full volume.

## Audio is a preview

Direct sound uses HRTF panning; early reflections use equal-power panning with path delays. Model attenuation is applied once. Phase-consistent oscillators, parameter smoothing, headroom normalization and compression produce a practical audition, **not a calibrated reproduction of the scalar map**. In particular, energy mode ignores phase while audible sine tones still interfere.

## Not included

No concave rooms, furniture/obstacles, diffraction, scattering, wall transmission, higher-order reflections, late reverberation, complex wall impedance, moving-source/Doppler solution, measured speaker response or full-wave/modal solver. Materials and layout presets are illustrative. Do not use this preview to certify treatment, installation or exposure levels.

Method/API references: [image-source method](https://reuk.github.io/wayverb/image_source.html) and [Web Audio specification](https://webaudio.github.io/web-audio-api/).

[Usage guide](GUIDE.md) · [Development](DEVELOPMENT.md) · [Overview](../README.md)
