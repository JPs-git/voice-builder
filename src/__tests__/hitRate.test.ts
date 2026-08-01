import { describe, it, expect } from 'vitest'
import { evaluateHitRate } from '../feedback/hitRate'
import { VOWEL_PRESETS } from '../types'
import type { FeedbackContext, AnalysisFrame } from '../types'

const vowelA = VOWEL_PRESETS['vowel-a']

function makeCtx(overrides: {
  f0?: number | null
  f1?: number | null
  f2?: number | null
  visible?: Partial<Record<'f0' | 'f1' | 'f2', boolean>>
}): FeedbackContext {
  const frame: AnalysisFrame = {
    time: 0.1,
    f0: overrides.f0 ?? null,
    f1: overrides.f1 ?? null,
    f2: overrides.f2 ?? null,
  }
  return {
    latestFrame: frame,
    bands: {
      f0: { range: vowelA.f0, color: '#10B981' },
      f1: { range: vowelA.f1, color: '#3B82F6' },
      f2: { range: vowelA.f2, color: '#F59E0B' },
    },
    visible: { f0: true, f1: true, f2: true, ...overrides.visible },
  }
}

describe('evaluateHitRate', () => {
  it('returns null when no latest frame', () => {
    const ctx = makeCtx({})
    ctx.latestFrame = null
    expect(evaluateHitRate(ctx)).toBeNull()
  })

  it('returns null when all formants are null', () => {
    expect(evaluateHitRate(makeCtx({}))).toBeNull()
  })

  it('returns hit with "完美" when all in range', () => {
    const mid = (lo: number, hi: number) => Math.round((lo + hi) / 2)
    const result = evaluateHitRate(makeCtx({
      f0: mid(vowelA.f0[0], vowelA.f0[1]),
      f1: mid(vowelA.f1[0], vowelA.f1[1]),
      f2: mid(vowelA.f2[0], vowelA.f2[1]),
    }))
    expect(result).toEqual({
      id: 'hit-rate',
      label: '目标区间',
      status: 'hit',
      message: '完美',
    })
  })

  it('reports F0偏低 when below lower bound', () => {
    const result = evaluateHitRate(makeCtx({
      f0: vowelA.f0[0] - 50,
      f1: (vowelA.f1[0] + vowelA.f1[1]) / 2,
      f2: (vowelA.f2[0] + vowelA.f2[1]) / 2,
    }))
    expect(result?.status).toBe('miss')
    expect(result?.message).toContain('F0偏低')
  })

  it('reports F2偏高 when above upper bound', () => {
    const result = evaluateHitRate(makeCtx({
      f0: (vowelA.f0[0] + vowelA.f0[1]) / 2,
      f1: (vowelA.f1[0] + vowelA.f1[1]) / 2,
      f2: vowelA.f2[1] + 100,
    }))
    expect(result?.status).toBe('miss')
    expect(result?.message).toContain('F2偏高')
  })

  it('merges multiple hints with space separator', () => {
    const result = evaluateHitRate(makeCtx({
      f0: vowelA.f0[0] - 50,
      f1: vowelA.f1[1] + 200,
      f2: (vowelA.f2[0] + vowelA.f2[1]) / 2,
    }))
    expect(result?.status).toBe('miss')
    expect(result?.message).toBe('F0偏低 F1偏高')
  })

  it('ignores null formants without false negatives', () => {
    const result = evaluateHitRate(makeCtx({
      f0: (vowelA.f0[0] + vowelA.f0[1]) / 2,
      f1: null,
      f2: null,
    }))
    expect(result).toEqual({
      id: 'hit-rate',
      label: '目标区间',
      status: 'hit',
      message: '完美',
    })
  })

  it('ignores hidden out-of-range dims (returns hit)', () => {
    const result = evaluateHitRate(makeCtx({
      f0: (vowelA.f0[0] + vowelA.f0[1]) / 2,
      f1: vowelA.f1[1] + 200,
      f2: vowelA.f2[1] + 200,
      visible: { f1: false, f2: false },
    }))
    expect(result).toEqual({
      id: 'hit-rate',
      label: '目标区间',
      status: 'hit',
      message: '完美',
    })
  })

  it('hides deviation hints for hidden dims', () => {
    const result = evaluateHitRate(makeCtx({
      f0: vowelA.f0[0] - 50,
      f1: vowelA.f1[1] + 200,
      f2: (vowelA.f2[0] + vowelA.f2[1]) / 2,
      visible: { f1: false },
    }))
    expect(result?.status).toBe('miss')
    expect(result?.message).toBe('F0偏低')
  })

  it('returns null when all dims hidden', () => {
    const result = evaluateHitRate(makeCtx({
      f0: (vowelA.f0[0] + vowelA.f0[1]) / 2,
      visible: { f0: false, f1: false, f2: false },
    }))
    expect(result).toBeNull()
  })
})
