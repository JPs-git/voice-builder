import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useCurrentMidi } from '../hooks/useCurrentMidi'
import { useAppStore } from '../store/appStore'
import type { AnalysisFrame } from '../types'

describe('useCurrentMidi', () => {
  beforeEach(() => {
    useAppStore.getState().reset()
  })

  it('returns null when there is no frame', () => {
    const { result } = renderHook(() => useCurrentMidi())
    expect(result.current).toBeNull()
  })

  it('returns null when the frame has no voiced f0', () => {
    useAppStore.getState().setLatestFrame({ f0: null } as unknown as AnalysisFrame)
    const { result } = renderHook(() => useCurrentMidi())
    expect(result.current).toBeNull()
  })

  it('returns the midi for C4 (261.63 Hz)', () => {
    useAppStore.getState().setLatestFrame({ f0: 261.63 } as unknown as AnalysisFrame)
    const { result } = renderHook(() => useCurrentMidi())
    expect(result.current).toBe(60)
  })

  it('returns null for pitches outside C2-B5', () => {
    useAppStore.getState().setLatestFrame({ f0: 1300 } as unknown as AnalysisFrame)
    const { result } = renderHook(() => useCurrentMidi())
    expect(result.current).toBeNull()
  })
})