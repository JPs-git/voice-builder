export const F0_RANGE = { min: 60, max: 1000 } as const

// Fixed F0 chart references, separate from editable vowel training targets.
export const F0_REFERENCE_ZONES = [
  { id: 'male', label: '男声', range: [80, 150] },
  { id: 'female', label: '女声', range: [180, 300] },
] as const

export const BAND_INPUT_LIMITS: Record<
  'f0' | 'f1' | 'f2',
  { min: number; max: number; step: number }
> = {
  f0: { min: F0_RANGE.min, max: F0_RANGE.max, step: 5 },
  f1: { min: 100, max: 3500, step: 10 },
  f2: { min: 100, max: 3500, step: 10 },
}
