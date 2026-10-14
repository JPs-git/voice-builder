import type { TargetBands } from '../types'
import { BAND_INPUT_LIMITS, FORMANT_MIN_GAP_HZ } from './analysisRanges'

export function getFormantEditBounds(key: 'f1' | 'f2', index: 0 | 1, bands: TargetBands): [number, number] {
  const { min, max } = BAND_INPUT_LIMITS[key]
  const [lo, hi] = bands[key].range
  if (index === 0) return [key === 'f2' ? Math.max(min, bands.f1.range[1]) : min, hi - FORMANT_MIN_GAP_HZ]
  return [lo + FORMANT_MIN_GAP_HZ, key === 'f1' ? Math.min(max, bands.f2.range[0]) : max]
}

// Normalize older overrides and programmatic updates at the data boundary.
// Reserve room for both 50 Hz intervals, preserving existing values wherever possible.
export function normalizeTargetBands(bands: TargetBands): TargetBands {
  const gap = FORMANT_MIN_GAP_HZ
  const min = Math.max(BAND_INPUT_LIMITS.f1.min, BAND_INPUT_LIMITS.f2.min)
  const max = Math.min(BAND_INPUT_LIMITS.f1.max, BAND_INPUT_LIMITS.f2.max)
  const clamp = (value: number, lo: number, hi: number) => Math.max(lo, Math.min(Number.isFinite(value) ? value : lo, hi))
  const f0Limits = BAND_INPUT_LIMITS.f0
  let f0Hi = clamp(bands.f0.range[1], f0Limits.min, f0Limits.max)
  if (f0Hi <= f0Limits.min) f0Hi = Math.min(f0Limits.max, f0Limits.min + f0Limits.step)
  let f0Lo = clamp(bands.f0.range[0], f0Limits.min, f0Limits.max)
  if (f0Lo >= f0Hi) f0Lo = Math.max(f0Limits.min, f0Hi - f0Limits.step)
  const f1Lo = clamp(bands.f1.range[0], min, max - gap * 2)
  const f1Hi = clamp(bands.f1.range[1], f1Lo + gap, max - gap)
  const f2Lo = clamp(bands.f2.range[0], f1Hi, max - gap)
  const f2Hi = clamp(bands.f2.range[1], f2Lo + gap, max)
  if (f0Lo === bands.f0.range[0] && f0Hi === bands.f0.range[1]
    && f1Lo === bands.f1.range[0] && f1Hi === bands.f1.range[1]
    && f2Lo === bands.f2.range[0] && f2Hi === bands.f2.range[1]) return bands
  return {
    ...bands,
    f0: { ...bands.f0, range: [f0Lo, f0Hi] },
    f1: { ...bands.f1, range: [f1Lo, f1Hi] },
    f2: { ...bands.f2, range: [f2Lo, f2Hi] },
  }
}
