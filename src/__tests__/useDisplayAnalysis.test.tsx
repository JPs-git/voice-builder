import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDisplayAnalysis, flushDisplayAnalysis } from '../hooks/useDisplayAnalysis'
import { useAppStore } from '../store/appStore'

beforeEach(() => {
  vi.useFakeTimers()
  useAppStore.getState().reset()
})
afterEach(() => { cleanup(); vi.useRealTimers() })

describe('display snapshot', () => {
  it('keeps analysis complete while display consumers share throttled latest data', () => {
    const a = renderHook(() => useDisplayAnalysis())
    const b = renderHook(() => useDisplayAnalysis())
    act(() => {
      useAppStore.getState().appendFrames([{ time: .01, f0: 200, f1: 500, f2: 1000 }])
      vi.advanceTimersByTime(20)
    })
    expect(a.result.current.frames).toHaveLength(1)
    act(() => {
      useAppStore.getState().appendFrames([{ time: .02, f0: 220, f1: 500, f2: 1000 }])
    })
    expect(useAppStore.getState().frames).toHaveLength(2)
    expect(a.result.current.frames).toHaveLength(1)
    act(() => { vi.advanceTimersByTime(80) })
    expect(a.result.current.frames).toHaveLength(2)
    expect(a.result.current).toBe(b.result.current)
    act(() => { useAppStore.getState().clearFrames() })
    expect(a.result.current.frames).toHaveLength(0)
    act(() => { vi.advanceTimersByTime(100) })
    expect(a.result.current.latestFrame).toBeNull()
  })

  it('flushes the last complete frame immediately on stop and shows fresh data on remount', () => {
    const hook = renderHook(() => useDisplayAnalysis())
    const frame = { time: 1, f0: 200, f1: 500, f2: 1000 }
    act(() => {
      useAppStore.getState().appendFrame(frame)
      flushDisplayAnalysis()
    })
    expect(hook.result.current.latestFrame).toBe(frame)
    hook.unmount()
    useAppStore.getState().clearFrames()
    const next = renderHook(() => useDisplayAnalysis())
    expect(next.result.current.frames).toHaveLength(0)
  })
})
