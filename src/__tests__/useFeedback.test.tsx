import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useFeedback } from '../feedback'
import { useAppStore } from '../store/appStore'
import { VOWEL_PRESETS } from '../types'

const vowelA = VOWEL_PRESETS['vowel-a']

function setFrame(f0: number | null, f1: number | null, f2: number | null) {
  useAppStore.getState().setFrames([{ time: 0.1, f0, f1, f2 }])
}

describe('useFeedback', () => {
  beforeEach(() => {
    useAppStore.getState().reset()
  })

  it('returns empty array with no data', () => {
    const { result } = renderHook(() => useFeedback())
    expect(result.current).toEqual([])
  })

  it('returns hit result when all in range', () => {
    const mid = (lo: number, hi: number) => Math.round((lo + hi) / 2)
    setFrame(mid(vowelA.f0[0], vowelA.f0[1]), mid(vowelA.f1[0], vowelA.f1[1]), mid(vowelA.f2[0], vowelA.f2[1]))
    const { result } = renderHook(() => useFeedback())
    expect(result.current).toHaveLength(1)
    expect(result.current[0].id).toBe('hit-rate')
    expect(result.current[0].status).toBe('hit')
    expect(result.current[0].message).toBe('完美')
  })

  it('reacts to latestFrame updates', () => {
    const { result } = renderHook(() => useFeedback())
    expect(result.current).toEqual([])

    const mid = (lo: number, hi: number) => Math.round((lo + hi) / 2)
    act(() => {
      setFrame(mid(vowelA.f0[0], vowelA.f0[1]), mid(vowelA.f1[0], vowelA.f1[1]), vowelA.f2[1] + 100)
    })
    expect(result.current).toHaveLength(1)
    expect(result.current[0].status).toBe('miss')
    expect(result.current[0].message).toBe('F2偏高')
  })
})
