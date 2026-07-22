import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { type ReactNode } from 'react'
import { AnalysisProvider, useAnalysis } from '../contexts/AnalysisContext'
import { VOWEL_PRESETS } from '../types'

function wrapper({ children }: { children: ReactNode }) {
  return <AnalysisProvider>{children}</AnalysisProvider>
}

describe('AnalysisContext reducer', () => {
  it('initializes with vowel-a preset values', () => {
    const { result } = renderHook(() => useAnalysis(), { wrapper })
    const { state } = result.current
    const vowelA = VOWEL_PRESETS['vowel-a']

    expect(state.activePreset).toBe('vowel-a')
    expect(state.bands.f0.range).toEqual(vowelA.f0)
    expect(state.bands.f1.range).toEqual(vowelA.f1)
    expect(state.bands.f2.range).toEqual(vowelA.f2)
  })

  it('SET_PHASE updates phase', () => {
    const { result } = renderHook(() => useAnalysis(), { wrapper })
    act(() => result.current.dispatch({ type: 'SET_PHASE', phase: 'recording' }))
    expect(result.current.state.phase).toBe('recording')
  })

  it('SET_BANDS updates specific band range', () => {
    const { result } = renderHook(() => useAnalysis(), { wrapper })
    act(() => result.current.dispatch({ type: 'SET_BANDS', bands: { f1: [500, 700] } }))
    expect(result.current.state.bands.f1.range).toEqual([500, 700])
    // other bands unchanged
    const vowelA = VOWEL_PRESETS['vowel-a']
    expect(result.current.state.bands.f0.range).toEqual(vowelA.f0)
  })

  it('SET_BANDS rejects invalid range (low >= high)', () => {
    const { result } = renderHook(() => useAnalysis(), { wrapper })
    const original = result.current.state.bands.f1.range
    act(() => result.current.dispatch({ type: 'SET_BANDS', bands: { f1: [800, 500] } }))
    expect(result.current.state.bands.f1.range).toEqual(original)
  })

  it('SET_ACTIVE_PRESET updates preset name', () => {
    const { result } = renderHook(() => useAnalysis(), { wrapper })
    act(() => result.current.dispatch({ type: 'SET_ACTIVE_PRESET', name: 'vowel-i' }))
    expect(result.current.state.activePreset).toBe('vowel-i')
  })

  it('RESET returns to initial state', () => {
    const { result } = renderHook(() => useAnalysis(), { wrapper })
    act(() => result.current.dispatch({ type: 'SET_PHASE', phase: 'recording' }))
    act(() => result.current.dispatch({ type: 'SET_ACTIVE_PRESET', name: 'vowel-i' }))
    act(() => result.current.dispatch({ type: 'RESET' }))

    const vowelA = VOWEL_PRESETS['vowel-a']
    expect(result.current.state.phase).toBe('idle')
    expect(result.current.state.activePreset).toBe('vowel-a')
    expect(result.current.state.bands.f0.range).toEqual(vowelA.f0)
  })

  it('SET_CONFIG merges config', () => {
    const { result } = renderHook(() => useAnalysis(), { wrapper })
    act(() => result.current.dispatch({ type: 'SET_CONFIG', config: { formantSmoothing: false } }))
    expect(result.current.state.config.formantSmoothing).toBe(false)
    expect(result.current.state.config.formantMethod).toBe('hybrid')
  })

  it('SET_LATEST_FRAME stores frame', () => {
    const { result } = renderHook(() => useAnalysis(), { wrapper })
    const frame = { time: 0.5, f0: 220, f1: 850, f2: 1200 }
    act(() => result.current.dispatch({ type: 'SET_LATEST_FRAME', frame }))
    expect(result.current.state.latestFrame).toEqual(frame)
  })

  it('SET_ABOUT_MODAL toggles modal state', () => {
    const { result } = renderHook(() => useAnalysis(), { wrapper })
    expect(result.current.state.aboutModalOpen).toBe(false)
    act(() => result.current.dispatch({ type: 'SET_ABOUT_MODAL', open: true }))
    expect(result.current.state.aboutModalOpen).toBe(true)
    act(() => result.current.dispatch({ type: 'SET_ABOUT_MODAL', open: false }))
    expect(result.current.state.aboutModalOpen).toBe(false)
  })
})
