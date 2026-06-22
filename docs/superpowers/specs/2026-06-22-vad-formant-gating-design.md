# VAD Formant Gating Design

Date: 2026-06-22

## Problem

The formant chart (F0-F4) currently renders formant trajectories for every frame, including
noise-only frames. While F0 already returns `null` for unvoiced frames (via autocorrelation
peak threshold), F1-F4 are still computed via LPC and can produce spurious trajectories
during silence or background noise.

## Goal

Add a Voice Activity Detection (VAD) stage before LPC/Pitch analysis so that noise frames
produce `null` for all formants (F0-F4), and only voiced speech frames trigger formant
computation and rendering.

## Design Decisions

| Decision | Choice |
|----------|--------|
| Energy measure | Frame RMS (root-mean-square) |
| Threshold type | Fixed value (configurable) |
| Threshold default | 0.008 (tuning target) |
| Gate placement | Analysis pipeline — skip LPC/Pitch for noise frames |
| Spectrogram | Always computed (FFT runs on every frame) |
| Downstream rendering | Unchanged — `connectNulls: false` handles null values |

## Architecture

```
Frame samples [400 @ 16kHz]
         │
         ▼
  ┌──────────────────┐
  │  VAD (RMS calc)  │  ← new
  │  voiced?         │
  └───────┬──────────┘
          │
     voiced?         FFT always ──► Spectrogram
     ┌──┴──┐
    YES    NO
     │     │
     ▼     ▼
  LPC +    output { f0:null, f1:null,
  Pitch    f2:null, f3:null, f4:null,
     │     voiced:false, rms, magnitudes }
     ▼
  output { f0, f1, f2, f3, f4,
  voiced:true, rms, magnitudes }
          │
          ▼
    FormantChart.pushFrame()
    (ECharts, connectNulls:false)
```

## Module: `js/vad.js` (new)

```js
class VoiceActivityDetector {
  constructor({ threshold = 0.008 })
  compute(samples) → { voiced: boolean, rms: number }
}
```

- `compute()` calculates RMS = sqrt(sum(x²) / N)
- Returns `voiced = rms >= threshold`
- No state, no side effects — fully testable

## Changes to `js/analysis-pipeline.js`

- Constructor accepts optional `{ vadThreshold }`
- Creates `VoiceActivityDetector` instance
- Per frame: compute VAD first
  - If `voiced`: run `detectPitch()` + `extractFormants()`
  - If `!voiced`: set all formants to `null`, skip LPC/Pitch
- Always run `fftMagnitudes()` for spectrogram continuity
- Frame output adds `voiced` and `rms` fields
- `static analyze()` passes `vadThreshold` through

## Changes to `js/main.js`

- `voiced` count: `frames.filter(f => f.voiced).length` (not `f.f0 != null`)

## Changes to `js/formant-chart.js`

- None required. Pipeline already outputs `null` for all formants on unvoiced frames;
  `connectNulls: false` breaks the line series automatically.

## Parameters

| Parameter | Default | Scope |
|-----------|---------|-------|
| `vadThreshold` | `0.008` | Per AnalysisPipeline instance |

Threshold 0.008 is an initial estimate for 16kHz 400-sample frames. Tune by recording
quiet + voiced segments and inspecting RMS distribution.

## Files Changed

| File | Action |
|------|--------|
| `js/vad.js` | Create |
| `js/analysis-pipeline.js` | Modify |
| `js/main.js` | Modify |
| `js/__tests__/vad.test.js` | Create |
| `js/__tests__/analysis-pipeline.test.js` | Modify |
