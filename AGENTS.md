# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Vite dev server |
| `npm test` | All tests (`npx vitest run`) |
| `npm run test:dsp` | DSP tests only (`npx vitest run js/__tests__/`) |
| `npm run test:unit` | React tests only (`npx vitest run src/__tests__/`) |
| `npx vitest run src/__tests__/Foo.test.ts` | Run single test file |
| `npm run build` | Production build to `dist/` |
| `npx tsc --noEmit` | Typecheck |

No linter or formatter configured.

## Architecture

VoiceBuilder is a browser-only SPA for real-time voice pitch (F0) and formant (F1-F4) analysis -- mic or WAV import, ECharts visualization, vowel target bands.

**Core principle: command-driven control, reactive data.** User actions call AudioEngine/Pipeline directly (no state machine). Analysis results flow through Zustand store to Charts.

### Data flow

```
mic -> AudioEngine.startCapture(chunk -> {
    recordingBuffer.write(chunk)          // shared RingBuffer
    pipeline.pushChunk(chunk, rate)       // DSP analysis
  })
  -> onFrame -> appStore.appendFrame(frame) -> Charts (Zustand selector)

playback:
  usePlayback -> recordingBuffer.read() -> AudioEngine.createPlaybackSource(samples)
```

### Key files

| File | Role |
|---|---|
| `src/store/appStore.ts` | Single Zustand store: config, bands, frames[], latestFrame, stats |
| `src/audio/recordingBuffer.ts` | Module-level shared RingBuffer (`16000*10`). Written by useAnalysis, read by usePlayback |
| `src/audio/AudioEngine.ts` | Pure hardware interface: `startCapture(onChunk)`, `stopCapture()`, `createPlaybackSource(samples)`. No data storage |
| `src/hooks/useAnalysis.ts` | Callback-driven: `onRecord`, `onImport`, `onClear`. Owns Pipeline lifecycle and local state (`isCapturing`, `isRequesting`, `dataSource`). Uses `clearFrames()` (preserves config/bands) not `reset()` |
| `src/hooks/useToolbar.ts` | Resolves `ToolItem[]` with dynamic props (label/icon/disabled based on state). Centralized `handleClickTool(id)` with pre-checks: stop playback for all actions, stop recording for non-record actions. Config/help/about bypass pre-checks |
| `src/hooks/usePlayback.ts` | Reads `recordingBuffer` directly (no dependency on useAnalysis). Returns `cursorTime` as state, passed via props to Charts |
| `src/routes/AnalysisPage.tsx` | Thin wiring: useToolbar + usePlayback -> Toolbar + Charts + Drawers |
| `src/components/Toolbar.tsx` | Pure renderer: `toolItems.map(item -> <Button {...item} />)`. Zero business logic |
| `src/components/F0Chart.tsx` | Subscribes to appStore (frames, bands). Receives cursorTime as prop |
| `src/components/FormantChart.tsx` | Same pattern as F0Chart |
| `src/components/TargetPresetBar.tsx` | Local `useState` for activePreset. Reads/writes appStore.bands |
| `src/components/ConfigDrawer.tsx` | Reads/writes appStore.config |
| `src/types/index.ts` | Shared types: AnalysisFrame, TargetBands, AppConfig, VowelPresets. No AppPhase or ChartHandles |

### DSP layer (TypeScript, in `src/dsp/`)

- `analysis-pipeline.ts` -- orchestrator: FRAME_SIZE=800 (50ms), HOP_SIZE=160. Three methods: `hybrid` (default, LPC + cepstral fallback), `lpc`, `cepstral`
- `lpc.ts` -- autocorrelation + Levinson-Durbin + Laguerre root-finding
- `cepstral.ts` -- 2048-FFT cepstral envelope + peak-picking
- `formant-smoother.ts` -- 5-frame median, 300Hz jump clamp, F0<F1<F2 ordering
- `wav-parser.ts`, `resampler.ts`, `vad.ts`, `fft.ts`, `frame-processor.ts`, `complex.ts`, `RingBuffer.ts`
- All modules exported via `src/dsp/index.ts` barrel
- DSP is synchronous, runs in `onaudioprocess` callback (main thread, ~100fps)
- Pipeline used standalone for WAV import: `AnalysisPipeline.analyze(samples, rate, method, smoothing)` (static)

### What was removed

- `AppPhase` state machine (6 states: idle/requesting/recording/paused/uploaded/analyzing) -- replaced by `isCapturing` + `isRequesting` local state
- `AnalysisContext` (React Context + useReducer) -- replaced by `appStore` (Zustand)
- `ChartHandles` imperative ref interface -- replaced by Zustand selectors + cursorTime prop
- `AnalysisService` singleton class -- replaced by `useAnalysis` hook
- `activePreset` in store -- moved to TargetPresetBar local useState
- `cursorTime` in store -- moved to usePlayback local state, passed via props

### Design constraints

Toolbar callback constraints are centralized in `useToolbar.handleClickTool`:
1. Always stop playback first
2. Stop recording before any non-record action (import, playback, clear)
3. Config/help/about actions bypass pre-checks (do not interrupt audio)

Data-clearing uses `clearFrames()` (clears frames only, preserves config/bands). `reset()` restores full defaults -- only used for full app reset.

### Testing

- All tests run under Vitest 3 (two projects: `dsp` in node env, `unit` in jsdom)
- DSP tests: `js/__tests__/*.test.js` (Praat regression, FFT, LPC, cepstral, VAD, etc.), import from `src/dsp/*.ts`
- React tests: `src/__tests__/` with @testing-library/react
- Zustand stores tested directly via `getState().action()` -- no React wrapper needed

## Docs

- `docs/superpowers/specs/2026-07-30-architecture-restructuring-design.md` -- target architecture design
- `docs/constraints-analysis.md` -- callback constraint matrix (command-driven vs state-driven comparison)
- `docs/roadmap.md` -- milestone plan (M1 done, M2 falsetto detection, M3 phoneme alignment)
- `todos.md` -- task list
