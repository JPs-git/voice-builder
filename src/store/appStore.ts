import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { AppConfig, TargetBands, AnalysisFrame, AnalysisStats, FormantSeries, FormantVisibility, PresetOverride } from '../types'
import { DEFAULT_CONFIG, VOWEL_PRESETS } from '../types'

const WINDOW_FRAMES = 1000

interface AppState {
  config: AppConfig
  bands: TargetBands
  activePreset: string
  presetOverrides: PresetOverride[]
  frames: AnalysisFrame[]
  latestFrame: AnalysisFrame | null
  stats: AnalysisStats
  formantVisible: FormantVisibility
}

interface AppActions {
  setConfig: (config: Partial<AppConfig>) => void
  setBands: (bands: Partial<Record<'f0' | 'f1' | 'f2', [number, number]>>) => void
  setActivePreset: (name: string) => void
  switchPreset: (name: string) => void
  savePresetOverride: (key: string, f0: [number, number], f1: [number, number], f2: [number, number]) => void
  resetPresets: () => void
  appendFrame: (frame: AnalysisFrame) => void
  setFrames: (frames: AnalysisFrame[]) => void
  setLatestFrame: (frame: AnalysisFrame | null) => void
  clearFrames: () => void
  toggleFormantVisible: (key: FormantSeries) => void
  reset: () => void
}

type AppStore = AppState & AppActions

const vowelA = VOWEL_PRESETS['vowel-a']
const DEFAULT_BANDS: TargetBands = {
  f0: { range: vowelA.f0, color: '#10B981' },
  f1: { range: vowelA.f1, color: '#3B82F6' },
  f2: { range: vowelA.f2, color: '#F59E0B' },
}

function resolveBands(name: string, overrides: PresetOverride[]): TargetBands {
  const preset = VOWEL_PRESETS[name]
  if (!preset) return DEFAULT_BANDS
  const o = overrides.find(x => x.key === name)
  return {
    f0: { range: o?.f0 ?? preset.f0, color: DEFAULT_BANDS.f0.color },
    f1: { range: o?.f1 ?? preset.f1, color: DEFAULT_BANDS.f1.color },
    f2: { range: o?.f2 ?? preset.f2, color: DEFAULT_BANDS.f2.color },
  }
}

function loadStoredOverrides(): PresetOverride[] {
  try {
    const raw = localStorage.getItem('voicebuilder-presets')
    if (!raw) return []
    const data = JSON.parse(raw)
    return data?.state?.presetOverrides ?? []
  } catch {
    return []
  }
}

const storedOverrides = loadStoredOverrides()

const initialState: AppState = {
  config: DEFAULT_CONFIG,
  bands: resolveBands('vowel-a', storedOverrides),
  activePreset: 'vowel-a',
  presetOverrides: storedOverrides,
  frames: [],
  latestFrame: null,
  stats: { f0Mean: null, hitRate: null, duration: 0 },
  formantVisible: { f0: true, f1: true, f2: true },
}

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
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

      setActivePreset: (name) => set({ activePreset: name }),

      switchPreset: (name) => set((state) => ({
        activePreset: name,
        bands: resolveBands(name, state.presetOverrides),
      })),

      savePresetOverride: (key, f0, f1, f2) => set((state) => {
        const idx = state.presetOverrides.findIndex(o => o.key === key)
        const override: PresetOverride = { key, f0, f1, f2 }
        const next = [...state.presetOverrides]
        if (idx >= 0) next[idx] = override
        else next.push(override)
        return { presetOverrides: next }
      }),

      resetPresets: () => set({
        presetOverrides: [],
        activePreset: 'vowel-a',
        bands: DEFAULT_BANDS,
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

      setLatestFrame: (frame) => set({ latestFrame: frame }),

      clearFrames: () => set({
        frames: [],
        latestFrame: null,
        stats: { f0Mean: null, hitRate: null, duration: 0 },
      }),

      toggleFormantVisible: (key) => set((state) => ({
        formantVisible: { ...state.formantVisible, [key]: !state.formantVisible[key] },
      })),

      reset: () => set({
        config: DEFAULT_CONFIG,
        bands: DEFAULT_BANDS,
        activePreset: 'vowel-a',
        presetOverrides: [],
        frames: [],
        latestFrame: null,
        stats: { f0Mean: null, hitRate: null, duration: 0 },
        formantVisible: { f0: true, f1: true, f2: true },
      }),
    }),
    {
      name: 'voicebuilder-presets',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        presetOverrides: state.presetOverrides,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          const { activePreset, presetOverrides } = state
          useAppStore.setState({ bands: resolveBands(activePreset, presetOverrides) })
        }
      },
    }
  )
)
