import { expect, it } from 'vitest'
import { getFormantEditBounds, normalizeTargetBands } from '../config/targetBandRules'
import { VOWEL_PRESETS, type TargetBands } from '../types'

function makeBands(f0: [number, number], f1: [number, number], f2: [number, number]): TargetBands {
  return { f0: { range: f0, color: '' }, f1: { range: f1, color: '' }, f2: { range: f2, color: '' } }
}

it('preserves every built-in preset unchanged', () => {
  for (const preset of Object.values(VOWEL_PRESETS)) {
    const bands = makeBands(preset.f0, preset.f1, preset.f2)
    expect(normalizeTargetBands(bands)).toBe(bands)
  }
})

it('defines symmetric edit boundaries and permits F1 upper equal to F2 lower', () => {
  const bands = makeBands([200, 280], [800, 1000], [1100, 1400])
  expect(getFormantEditBounds('f1', 0, bands)).toEqual([0, 950])
  expect(getFormantEditBounds('f1', 1, bands)).toEqual([850, 1100])
  expect(getFormantEditBounds('f2', 0, bands)).toEqual([1000, 1350])
  expect(getFormantEditBounds('f2', 1, bands)).toEqual([1150, 3500])
})

it('normalizes finite, reversed, out-of-range and non-finite legacy targets into ordered ranges', () => {
  const values = [-100, 0, 20, 50, 100, 3490, 3500, 5000, NaN, Infinity]
  for (const lo of values) for (const hi of values) {
    const normalized = normalizeTargetBands(makeBands([lo, hi], [hi, lo], [lo, hi]))
    const [f0Lo, f0Hi] = normalized.f0.range
    const [f1Lo, f1Hi] = normalized.f1.range
    const [f2Lo, f2Hi] = normalized.f2.range
    expect(f0Lo).toBeGreaterThanOrEqual(0)
    expect(f0Lo).toBeLessThan(f0Hi)
    expect(f0Hi).toBeLessThanOrEqual(500)
    expect(f1Lo).toBeGreaterThanOrEqual(0)
    expect(f1Hi - f1Lo).toBeGreaterThanOrEqual(50)
    expect(f1Hi).toBeLessThanOrEqual(f2Lo)
    expect(f2Hi - f2Lo).toBeGreaterThanOrEqual(50)
    expect(f2Hi).toBeLessThanOrEqual(3500)
    expect(normalizeTargetBands(normalized)).toBe(normalized)
  }
})
