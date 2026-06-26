# VoiceBuilder — AGENTS.md

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Vite dev server with HMR |
| `npm test` | Run all 47+ tests via `node --test` |
| `npm test -- --test-name-pattern "FormantSmoother"` | Run a single test file |
| `node --test js/__tests__/analysis-pipeline.test.js` | Run a single test file directly |
| `npm run build` | Build to `dist/` |
| `npm start` | Production static server on port 3000 |

No linter, formatter, or typecheck configured.

## Entrypoint & Architecture

- `index.html` → `js/main.js` (app entry, DOM wiring, AudioContext lifecycle)
- `js/analysis-pipeline.js` — orchestrates frame processing (AudioWorklet shim via `frame-processor.js`); FRAME_SIZE = 800 (50ms), HOP_SIZE = 160. Three methods: `hybrid` (default, LPC primary + cepstral fallback in two cases), `lpc` (pure LPC), `cepstral` (pure cepstral)
- `js/cepstral.js` — cepstral formant extractor (LIFTER_CUTOFF = 35, FFT 2048, MAX_FORMANT_FREQ = 3500)
- `js/lpc.js` — LPC formant extractor (order = min(16, len/3, fs/1000+4), MAX_FORMANT_FREQ = 3500)
- `js/formant-smoother.js` — post-processing (5-frame median, 300Hz jump clamp, 50Hz dead zone, F0<F1<F2<F3<F4 ordering)
- `js/wav-parser.js` — WAV import
- `index.html` has the config drawer (checkbox for `formantSmoothing`, radio for `formantMethod`)

### Hybrid Method (default)

`AnalysisPipeline._prevGoodF1` tracks the previous frame's output F1 (from whichever method was used) across frames. In the hybrid branch:

1. LPC finds 2+ formants → check if F1 jumped >300Hz from previous and F1 >600Hz (LPC likely skipped the real F1, reporting F2 as F1).
   - Jump detected → run cepstral verification. If cepstral also finds 2+ formants, use cepstral result (applying `isHarmonicLocked`). If cepstral's F1 also jumps, the LPC fallback is still handled by the formant smoother's 300Hz clamp.
   - If cepstral verification fails (<2 formants), `isHarmonicLocked` is applied to the original LPC result before falling back to smoother clamping.
   - No jump → normal LPC path with `isHarmonicLocked` check.
2. LPC finds <2 formants → cepstral fallback (with `isHarmonicLocked` on F1).

Config is wired via global state in `main.js` and read at recording/import start. Changes do not take effect mid-recording.

## Testing

- Plain `node --test` (no Jest/Vitest). Tests are in `js/__tests__/*.test.js`.
- Test mocks live in `js/__tests__/mocks/`.
- No snapshot tests, no integration test services needed.
- All tests pass: `npm test`.

## Formant Smoother Details

- `FormantSmoother` buffers 5 frames per formant (F0–F4).
- On frame gap >300Hz: output clamps to last valid value, but raw jump value still enters the buffer so median converges on real transitions.
- Deviation <50Hz from median: raw value passed through (preserves natural micro-variation).
- F0<F1<F2<F3<F4 ordering enforced; violation falls back to previous frame.
- `reset()` clears all buffers and last-output state.

## Other

- `vite.config.js` only sets `base: './'` (for relative asset paths in dist).
- No CI, no pre-commit hooks, no lint staged.
- The `.worktrees/` directory is in `.gitignore`.
