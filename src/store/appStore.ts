import { create } from 'zustand'
import type { AppConfig, TargetBands, AnalysisFrame, AnalysisStats } from '../types'
import { DEFAULT_CONFIG, VOWEL_PRESETS } from '../types'

const WINDOW_FRAMES = 1000

interface AppState {
  config: AppConfig
  bands: TargetBands
  frames: AnalysisFrame[]
  latestFrame: AnalysisFrame | null
  stats: AnalysisStats
}

interface AppActions {
  setConfig: (config: Partial<AppConfig>) => void
  setBands: (bands: Partial<Record<'f0' | 'f1' | 'f2', [number, number]>>) => void
  appendFrame: (frame: AnalysisFrame) => void
  setFrames: (frames: AnalysisFrame[]) => void
  reset: () => void
}

type AppStore = AppState & AppActions

const vowelA = VOWEL_PRESETS['vowel-a']
const DEFAULT_BANDS: TargetBands = {
  f0: { range: vowelA.f0, color: '#10B981' },
  f1: { range: vowelA.f1, color: '#3B82F6' },
  f2: { range: vowelA.f2, color: '#F59E0B' },
}

const initialState: AppState = {
  config: DEFAULT_CONFIG,
  bands: DEFAULT_BANDS,
  frames: [],
  latestFrame: null,
  stats: { f0Mean: null, hitRate: null, duration: 0 },
}

function computeStats(frames: AnalysisFrame[], bands: TargetBands): AnalysisStats {
  if (frames.length === 0) {
    return { f0Mean: null, hitRate: null, duration: 0 }
  }

  let f0Sum = 0
  let f0Count = 0
  let hitCount = 0
  let voicedCount = 0

  const f0Range = bands.f0.range

  for (const frame of frames) {
    if (frame.f0 != null) {
      f0Sum += frame.f0
      f0Count++
      voicedCount++
      if (frame.f0 >= f0Range[0] && frame.f0 <= f0Range[1]) {
        hitCount++
      }
    } else if (frame.voiced) {
      voicedCount++
    }
  }

  return {
    f0Mean: f0Count > 0 ? f0Sum / f0Count : null,
    hitRate: voicedCount > 0 ? hitCount / voicedCount : null,
    duration: frames[frames.length - 1].time,
  }
}

export const useAppStore = create<AppStore>((set) => ({
  ...initialState,

  setConfig: (config) => set((state) => ({
    config: { ...state.config, ...config },
  })),

  setBands: (bands) => set((state) => {
    const next = { ...state.bands }
    for (const k of ['f0', 'f1', 'f2'] as const) {
      const r = bands[k]
      if (r && r.length === 2 && r[0] < r[1]) {
        next[k] = { ...next[k], range: r }
      }
    }
    return { bands: next }
  }),

  appendFrame: (frame) => set((state) => {
    const frames = state.frames.length >= WINDOW_FRAMES
      ? [...state.frames.slice(1), frame]
      : [...state.frames, frame]
    return {
      frames,
      latestFrame: frame,
      stats: computeStats(frames, state.bands),
    }
  }),

  setFrames: (frames) => set((state) => ({
    frames,
    latestFrame: frames.length > 0 ? frames[frames.length - 1] : null,
    stats: computeStats(frames, state.bands),
  })),

  reset: () => set(initialState),
}))
