import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useMediaQuery } from '../hooks/useMediaQuery'

type Listener = (event: { matches: boolean }) => void

function mockMatchMedia(initialMatches: boolean) {
  const listeners = new Set<Listener>()
  const mql = {
    matches: initialMatches,
    addEventListener: (type: string, cb: Listener) => {
      if (type === 'change') listeners.add(cb)
    },
    removeEventListener: (type: string, cb: Listener) => {
      if (type === 'change') listeners.delete(cb)
    },
  }
  const stub = vi.fn().mockReturnValue(mql)
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: stub,
  })
  return { mql, listeners }
}

describe('useMediaQuery', () => {
  it('returns false when matchMedia reports a non-match', () => {
    mockMatchMedia(false)
    const { result } = renderHook(() => useMediaQuery('(max-width: 768px)'))
    expect(result.current).toBe(false)
  })

  it('returns true when the media query matches', () => {
    mockMatchMedia(true)
    const { result } = renderHook(() => useMediaQuery('(max-width: 768px)'))
    expect(result.current).toBe(true)
  })

  it('updates when the media query crosses the breakpoint', () => {
    const { mql, listeners } = mockMatchMedia(false)
    const { result } = renderHook(() => useMediaQuery('(max-width: 768px)'))
    expect(result.current).toBe(false)

    act(() => {
      mql.matches = true
      for (const cb of listeners) cb({ matches: true })
    })
    expect(result.current).toBe(true)
  })

  it('removes the change listener on unmount', () => {
    const { listeners } = mockMatchMedia(false)
    const { unmount } = renderHook(() => useMediaQuery('(max-width: 768px)'))
    expect(listeners.size).toBe(1)
    unmount()
    expect(listeners.size).toBe(0)
  })
})