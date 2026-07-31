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
  clearFrames: () => void
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
    return { frames, latestFrame: frame }
  }),

  setFrames: (frames) => set({
    frames,
    latestFrame: frames.length > 0 ? frames[frames.length - 1] : null,
  }),

  clearFrames: () => set({
    frames: [],
    latestFrame: null,
    stats: { f0Mean: null, hitRate: null, duration: 0 },
  }),

  reset: () => set(initialState),
}))
