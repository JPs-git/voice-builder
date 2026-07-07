export interface AnalysisFrame {
  time: number
  f0: number | null
  f1: number | null
  f2: number | null
  f3?: number | null
  f4?: number | null
  voiced?: boolean
}

export interface TargetBand {
  range: [number, number]
  color: string
}

export interface FormantMethod {
  value: 'hybrid' | 'lpc' | 'cepstral'
  label: string
  description: string
}

export const FORMANT_METHODS: FormantMethod[] = [
  { value: 'hybrid', label: '混合法', description: 'LPC+倒谱回退，推荐' },
  { value: 'lpc', label: '纯 LPC', description: '自回归，可能找不到低 F1' },
  { value: 'cepstral', label: '纯倒谱法', description: '封闭元音 F2 偏大' },
]

export type AppPhase = 'idle' | 'requesting' | 'recording' | 'paused' | 'analyzing'

export interface TargetBands {
  f0: TargetBand
  f1: TargetBand
  f2: TargetBand
}

export interface VowelPreset {
  label: string
  f0: [number, number]
  f1: [number, number]
  f2: [number, number]
}

export const VOWEL_PRESETS: Record<string, VowelPreset> = {
  'vowel-a': { label: '元音 a', f0: [200, 280], f1: [800, 1000], f2: [1100, 1400] },
  'vowel-o': { label: '元音 o', f0: [200, 280], f1: [480, 620], f2: [700, 1000] },
  'vowel-e': { label: '元音 e', f0: [200, 280], f1: [500, 660], f2: [1000, 1300] },
  'vowel-i': { label: '元音 i', f0: [220, 300], f1: [280, 380], f2: [2500, 3000] },
  'vowel-u': { label: '元音 u', f0: [200, 280], f1: [300, 400], f2: [600, 900] },
  'vowel-yu': { label: '元音 ü', f0: [220, 300], f1: [280, 380], f2: [1800, 2200] },
}

export interface AppConfig {
  formantMethod: FormantMethod['value']
  formantSmoothing: boolean
}

export const DEFAULT_CONFIG: AppConfig = {
  formantMethod: 'hybrid',
  formantSmoothing: true,
}

export interface ChartHandles {
  pushFrame: (frame: AnalysisFrame) => void
  displayAll: (frames: AnalysisFrame[]) => void
  setLiveMode: () => void
  setTargetBands: (bands: Partial<Record<'f0' | 'f1' | 'f2', [number, number]>>) => void
  setCursorTime: (time: number) => void
  setSeriesVisible?: (key: string, visible: boolean) => void
  clear: () => void
}

export interface AnalysisStats {
  f0Mean: number | null
  hitRate: number | null
  duration: number
}
