import { createContext, useContext, useReducer, type ReactNode } from 'react'
import type { AppPhase, AppConfig, TargetBands, AnalysisFrame, AnalysisStats } from '../types'
import { DEFAULT_CONFIG } from '../types'

interface AnalysisState {
  phase: AppPhase
  config: AppConfig
  activePreset: string | null
  bands: TargetBands
  latestFrame: AnalysisFrame | null
  frameCount: number
  stats: AnalysisStats
  configDrawerOpen: boolean
  helpDrawerOpen: boolean
}

type Action =
  | { type: 'SET_PHASE'; phase: AppPhase }
  | { type: 'SET_CONFIG'; config: Partial<AppConfig> }
  | { type: 'SET_ACTIVE_PRESET'; name: string | null }
  | { type: 'SET_BANDS'; bands: Partial<Record<'f0' | 'f1' | 'f2', [number, number]>> }
  | { type: 'SET_LATEST_FRAME'; frame: AnalysisFrame }
  | { type: 'SET_FRAME_COUNT'; count: number }
  | { type: 'SET_STATS'; stats: AnalysisStats }
  | { type: 'SET_CONFIG_DRAWER'; open: boolean }
  | { type: 'SET_HELP_DRAWER'; open: boolean }
  | { type: 'RESET' }

const DEFAULT_BANDS: TargetBands = {
  f0: { range: [200, 290], color: '#10B981' },
  f1: { range: [400, 750], color: '#3B82F6' },
  f2: { range: [1200, 2200], color: '#F59E0B' },
}

function reducer(state: AnalysisState, action: Action): AnalysisState {
  switch (action.type) {
    case 'SET_PHASE':
      return { ...state, phase: action.phase }
    case 'SET_CONFIG':
      return { ...state, config: { ...state.config, ...action.config } }
    case 'SET_ACTIVE_PRESET':
      return { ...state, activePreset: action.name }
    case 'SET_BANDS': {
      const bands = { ...state.bands }
      for (const k of ['f0', 'f1', 'f2'] as const) {
        const r = action.bands[k]
        if (r && r.length === 2 && r[0] < r[1]) {
          bands[k] = { ...bands[k], range: r }
        }
      }
      return { ...state, bands }
    }
    case 'SET_LATEST_FRAME':
      return { ...state, latestFrame: action.frame }
    case 'SET_FRAME_COUNT':
      return { ...state, frameCount: action.count }
    case 'SET_STATS':
      return { ...state, stats: action.stats }
    case 'SET_CONFIG_DRAWER':
      return { ...state, configDrawerOpen: action.open }
    case 'SET_HELP_DRAWER':
      return { ...state, helpDrawerOpen: action.open }
    case 'RESET':
      return { ...initialState }
    default:
      return state
  }
}

const initialState: AnalysisState = {
  phase: 'idle',
  config: DEFAULT_CONFIG,
  activePreset: 'vowel-a',
  bands: DEFAULT_BANDS,
  latestFrame: null,
  frameCount: 0,
  stats: { f0Mean: null, hitRate: null, duration: 0 },
  configDrawerOpen: false,
  helpDrawerOpen: false,
}

const AnalysisContext = createContext<{
  state: AnalysisState
  dispatch: React.Dispatch<Action>
} | null>(null)

export function AnalysisProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  return (
    <AnalysisContext.Provider value={{ state, dispatch }}>
      {children}
    </AnalysisContext.Provider>
  )
}

export function useAnalysis() {
  const ctx = useContext(AnalysisContext)
  if (!ctx) throw new Error('useAnalysis must be used within AnalysisProvider')
  return ctx
}
