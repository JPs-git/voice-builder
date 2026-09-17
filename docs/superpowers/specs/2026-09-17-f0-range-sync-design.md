# F0 Range Synchronization Design

## Problem

The F0 detection ceiling and the custom F0 target-band input are hard-coded and inconsistent:

- `src/dsp/lpc.ts` `detectPitch` — inline `minFreq = 60`, `maxFreq = 500`, an algorithmic search-window bound.
- `src/components/TargetPresetBar.tsx` — F0 number inputs allow `min=20`, `max=600`.

A target band set between 500–600Hz is allowed by the UI but can never be detected, producing undetectable target ranges (the issue surfaced originally on the practice page whose display ceiling E5 is above the 500Hz detection cap).

## Goal

Introduce a single source of truth for the F0 analysis range and consume it from every place that must agree on the ceiling:

1. DSP pitch detection (`detectPitch`) — algorithm threshold.
2. Custom F0 target-band input — bounds for input + clamping.
3. When a user sets an F0 target above the ceiling, clamp to the ceiling and notify.

## Decisions

- Ceiling = `1000 Hz` (covers B5 ≈ 988Hz) — supports the practice page's piano range (C2–B5) for detection.
- F0 display ranges intentionally stay as-is:
  - Main page `F0Chart` Y-axis `0–500` (clips >500 visually; tooltip shows true Hz).
  - Practice `PitchChart` `G2–E5`, `Piano` `C2–B5`, `PracticePage` C2–B5 gate — unchanged.
- F0-only scope. Formant (F1/F2, 3500Hz window) untouched.
- Out-of-range F0 target input → clamp to ceiling + toast (info). Lower bound handled by input `min` attribute only; no extra validation.

## Implementation

### 1. New module `src/config/analysisRanges.ts`

```ts
export const F0_RANGE = { min: 60, max: 1000 } as const
```

Single source of truth for the F0 analysis range.

### 2. `src/dsp/lpc.ts` — `detectPitch`

Replace inline `minFreq`/`maxFreq` with `F0_RANGE.min` / `F0_RANGE.max`.

Effect: `minPeriod = ceil(16000 / 1000) = 16` (was 32). Lag window 16→266. WAV-import and mic paths both benefit. Formant windows (50–3500) unchanged.

### 3. `src/components/TargetPresetBar.tsx`

- F0 inputs: `min={F0_RANGE.min}`, `max={F0_RANGE.max}` (was 20/600). F1/F2 unchanged (`100`/`3500`).
- In `handleInputChange` (live) and `commitValue` (blur/Enter), for `key === 'f0'` clamp `num` to `F0_RANGE.max` before writing store/preset.
- A toast is emitted whenever a clamp occurs during typing (`handleInputChange`):
  `showToast('info', 'F0 已超出检测上限 1000Hz，已自动设为 1000Hz')`
  Because the `bands → localValues` sync effect re-renders the field from the clamped store value, the input visibly snaps to the ceiling immediately — no separate commit-time toast needed.

## Tests

- `src/__tests__/dsp/pitch.test.js` — add high-frequency sine cases (e.g., 700Hz, 988Hz) asserting `detectPitch` returns within tolerance (±2%); keep existing 100/200/440/noise/silence cases untouched to prove no regression.
- `src/__tests__/TargetPresetBar.test.tsx` — add: input 1100 on F0 upper → on blur store `bands.f0.range[1] === 1000`, input shows `1000`, a toast appears. Existing cases unchanged.
- Verify: `npm run test:dsp`, `npm run test:unit`, `npx tsc --noEmit`.