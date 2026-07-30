import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePlayback } from '../hooks/usePlayback'
import { getAudioEngine, resetAudioEngine } from '../ts'

function mockAudioContext() {
  const audioCtx = {
    currentTime: 0,
    destination: {},
    close: () => Promise.resolve(),
    resume: () => Promise.resolve(),
    createBuffer: (channels: number, length: number, sampleRate: number) => ({
      getChannelData: (_ch: number) => new Float32Array(length),
      sampleRate,
      length,
      numberOfChannels: channels,
    }),
    createBufferSource: () => {
      const source = {
        buffer: null as AudioBuffer | null,
        connect: () => {},
        start: () => {},
        stop: () => {},
        onended: null as (() => void) | null,
      }
      return source
    },
  }
  return audioCtx
}

let origAudioContext: typeof globalThis.AudioContext

describe('usePlayback', () => {
  beforeAll(() => {
    origAudioContext = globalThis.AudioContext
    globalThis.AudioContext = mockAudioContext as unknown as typeof AudioContext
  })

  afterAll(() => {
    globalThis.AudioContext = origAudioContext
  })

  beforeEach(() => {
    resetAudioEngine()
  })

  it('returns play/stop functions and isPlaying state', () => {
    const { result } = renderHook(() => usePlayback())
    expect(typeof result.current.play).toBe('function')
    expect(typeof result.current.stop).toBe('function')
    expect(result.current.isPlaying).toBe(false)
  })

  it('play does nothing when buffer is empty', () => {
    const { result } = renderHook(() => usePlayback())
    act(() => { result.current.play() })
    expect(result.current.isPlaying).toBe(false)
  })

  it('play sets isPlaying to true, stop sets it to false', () => {
    const ae = getAudioEngine()
    ae.importBuffer(new Float32Array([0.1, 0.2, 0.3]))
    const { result } = renderHook(() => usePlayback())
    act(() => { result.current.play() })
    expect(result.current.isPlaying).toBe(true)
    act(() => { result.current.stop() })
    expect(result.current.isPlaying).toBe(false)
  })
})
