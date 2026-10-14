export const F0_RANGE = { min: 60, max: 1000 } as const

// Shared display and editable-target ranges; independent of DSP detection limits.
export const F0_CHART_RANGE = { min: 0, max: 500 } as const
export const FORMANT_CHART_RANGE = { min: 0, max: 3500 } as const

// Fixed F0 chart references, separate from editable vowel training targets.
export const F0_REFERENCE_ZONES = [
  { id: 'male', label: '男声', range: [80, 150] },
  { id: 'female', label: '女声', range: [180, 300] },
] as const

export const BAND_INPUT_LIMITS: Record<
  'f0' | 'f1' | 'f2',
  { min: number; max: number; step: number }
> = {
  f0: { ...F0_CHART_RANGE, step: 5 },
  f1: { ...FORMANT_CHART_RANGE, step: 10 },
  f2: { ...FORMANT_CHART_RANGE, step: 10 },
}

export const FORMANT_MIN_GAP_HZ = 50
