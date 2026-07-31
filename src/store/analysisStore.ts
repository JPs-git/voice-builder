import { create } from 'zustand'
import type { AppPhase, AppConfig, TargetBands, DataSource } from '../types'
import { DEFAULT_CONFIG, VOWEL_PRESETS } from '../types'

interface AnalysisState {
  phase: AppPhase
  config: AppConfig
  activePreset: string | null
  bands: TargetBands
  dataSource: DataSource
}

interface AnalysisActions {
  setPhase: (phase: AppPhase) => void
  setConfig: (config: Partial<AppConfig>) => void
  setActivePreset: (name: string | null) => void
  setBands: (bands: Partial<Record<'f0' | 'f1' | 'f2', [number, number]>>) => void
  reset: () => void
}

type AnalysisStore = AnalysisState & AnalysisActions

const vowelA = VOWEL_PRESETS['vowel-a']
const DEFAULT_BANDS: TargetBands = {
  f0: { range: vowelA.f0, color: '#10B981' },
  f1: { range: vowelA.f1, color: '#3B82F6' },
  f2: { range: vowelA.f2, color: '#F59E0B' },
}

const initialState: AnalysisState = {
  phase: 'idle',
  config: DEFAULT_CONFIG,
  activePreset: 'vowel-a',
  bands: DEFAULT_BANDS,
  dataSource: null,
}

export const useAnalysisStore = create<AnalysisStore>((set) => ({
  ...initialState,

  setPhase: (phase) => set({ phase }),

  setConfig: (config) => set((state) => ({
    config: { ...state.config, ...config },
  })),

  setActivePreset: (name) => {
    if (name === null) {
      set({ activePreset: null })
      return
    }
    const preset = VOWEL_PRESETS[name]
    if (!preset) return
    set({
      activePreset: name,
      bands: {
        f0: { ...DEFAULT_BANDS.f0, range: preset.f0 },
        f1: { ...DEFAULT_BANDS.f1, range: preset.f1 },
        f2: { ...DEFAULT_BANDS.f2, range: preset.f2 },
      },
    })
  },

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

  reset: () => set(initialState),
}))
