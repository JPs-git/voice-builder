# VoiceBuilder — AGENTS.md

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Vite dev server with HMR |
| `npm test` | Run all tests (DSP + React) |
| `npm run test:dsp` | Run DSP tests only (`node --test`) |
| `npm run test:unit` | Run React unit tests only (Vitest) |
| `npm run build` | Build to `dist/` |
| `npm start` | Vite preview server (production build) on port 3000 |

No linter, formatter, or typecheck configured.

## Entrypoint & Architecture

- `index.html` → `src/main.tsx` (React entry, renders `<App />`)
- `src/App.tsx` — root component: `BrowserRouter` > `AnalysisProvider` > `Routes`
- `src/routes/AnalysisPage.tsx` — main orchestrator page, wires all components + AudioEngine + AnalysisPipeline
- `src/contexts/AnalysisContext.tsx` — Context + `useReducer` state management (phase, config, preset, bands, frames, stats)
- `src/components/` — React UI components:
  - `Toolbar.tsx` — record/import/playback/clear/config/help buttons
  - `TargetPresetBar.tsx` — vowel preset selector + F0/F1/F2 range inputs
  - `F0Chart.tsx` — F0 chart wrapping ECharts
  - `FormantChart.tsx` — formant chart wrapping ECharts with target bands
  - `Drawer.tsx` — shared right-side drawer shell (CSS module)
  - `ConfigDrawer.tsx` — formant method + smoothing toggle (uses Drawer)
  - `HelpDrawer.tsx` — usage instructions (uses Drawer)
  - `TipWidget.tsx` — rotating tips widget
  - `EmptyState.tsx` — empty state placeholder for charts
- `src/hooks/useECharts.ts` — custom hook for ECharts instance lifecycle
- `src/types/index.ts` — shared TypeScript type definitions

### DSP Layer (vanilla JS, unchanged)

- `js/analysis-pipeline.js` — orchestrates frame processing (AudioWorklet shim via `frame-processor.js`); FRAME_SIZE = 800 (50ms), HOP_SIZE = 160. Three methods: `hybrid` (default, LPC primary + cepstral fallback in two cases), `lpc` (pure LPC), `cepstral` (pure cepstral)
- `js/cepstral.js` — cepstral formant extractor (LIFTER_CUTOFF = 35, FFT 2048, MAX_FORMANT_FREQ = 3500)
- `js/lpc.js` — LPC formant extractor (order = min(16, len/3, fs/1000+4), MAX_FORMANT_FREQ = 3500)
- `js/formant-smoother.js` — post-processing (5-frame median, 300Hz jump clamp, 50Hz dead zone, F0<F1<F2<F3<F4 ordering)
- `js/wav-parser.js` — WAV import
- `js/audio-engine.js` — AudioContext + mic stream + playback
- `js/resampler.js` — sample rate conversion

### Hybrid Method (default)

`AnalysisPipeline._prevGoodF1` tracks the previous frame's output F1 (from whichever method was used) across frames. In the hybrid branch:

1. LPC finds 2+ formants → check if F1 jumped >300Hz from previous and F1 >600Hz (LPC likely skipped the real F1, reporting F2 as F1).
   - Jump detected → run cepstral verification. If cepstral also finds 2+ formants, use cepstral result (applying `isHarmonicLocked`). If cepstral's F1 also jumps, the LPC fallback is still handled by the formant smoother's 300Hz clamp.
   - If cepstral verification fails (<2 formants), `isHarmonicLocked` is applied to the original LPC result before falling back to smoother clamping.
   - No jump → normal LPC path with `isHarmonicLocked` check.
2. LPC finds <2 formants → cepstral fallback (with `isHarmonicLocked` on F1).

Config is wired via React Context and read at recording/import start. Changes do not take effect mid-recording.

## Testing

- **DSP tests**: Plain `node --test` in `js/__tests__/*.test.js`
- **React tests**: Vitest + @testing-library/react in `src/__tests__/*.test.tsx`
- Test mocks live in `js/__tests__/mocks/`.
- All tests pass: `npm test`.

## Formant Smoother Details

- `FormantSmoother` buffers 5 frames per formant (F0–F4).
- On frame gap >300Hz: output clamps to last valid value, but raw jump value still enters the buffer so median converges on real transitions.
- Deviation <50Hz from median: raw value passed through (preserves natural micro-variation).
- F0<F1<F2<F3<F4 ordering enforced; violation falls back to previous frame.
- `reset()` clears all buffers and last-output state.

## Other

- `vite.config.ts` sets `base: './'` and Vitest config (`environment: 'jsdom'`, `include: src/__tests__`).
- No CI, no pre-commit hooks, no lint staged.
- The `.worktrees/` directory is in `.gitignore`.
