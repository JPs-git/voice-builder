import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePlayback } from '../hooks/usePlayback'
import { getAudioEngine, resetAudioEngine } from '../ts'
import { useAnalysisStore } from '../store/analysisStore'
import { useFrameStore } from '../store/frameStore'

function mockAudioContext() {
  return {
    currentTime: 0,
    destination: {},
    close: () => Promise.resolve(),
    resume: () => Promise.resolve(),
    createBuffer: (_channels: number, length: number, _sampleRate: number) => ({
      getChannelData: (_ch: number) => new Float32Array(length),
      sampleRate: 16000,
      length,
      numberOfChannels: 1,
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
    useAnalysisStore.getState().reset()
    useFrameStore.getState().clear()
  })

  it('returns play/stop functions and isPlaying state', () => {
    const { result } = renderHook(() => usePlayback(() => new Float32Array(0)))
    expect(typeof result.current.play).toBe('function')
    expect(typeof result.current.stop).toBe('function')
    expect(result.current.isPlaying).toBe(false)
  })

  it('play does nothing when getSamples returns empty', () => {
    const { result } = renderHook(() => usePlayback(() => new Float32Array(0)))
    act(() => { result.current.play() })
    expect(result.current.isPlaying).toBe(false)
  })

  it('play does nothing when getSamples is undefined', () => {
    const { result } = renderHook(() => usePlayback())
    act(() => { result.current.play() })
    expect(result.current.isPlaying).toBe(false)
  })

  it('play sets isPlaying to true with data, stop sets it to false', () => {
    const samples = new Float32Array(1600)
    samples.fill(0.1)
    // Pre-init audio context
    getAudioEngine().audioContext

    const { result } = renderHook(() => usePlayback(() => samples))
    act(() => { result.current.play() })
    expect(result.current.isPlaying).toBe(true)
    act(() => { result.current.stop() })
    expect(result.current.isPlaying).toBe(false)
  })

  it('stops playback on unmount', () => {
    const samples = new Float32Array(1600)
    samples.fill(0.1)
    getAudioEngine().audioContext

    const { result, unmount } = renderHook(() => usePlayback(() => samples))
    act(() => { result.current.play() })
    expect(result.current.isPlaying).toBe(true)
    unmount()
  })

  it('accepts getSamples function as parameter', () => {
    const getSamples = () => new Float32Array(0)
    const { result } = renderHook(() => usePlayback(getSamples))
    act(() => { result.current.play() })
    expect(result.current.isPlaying).toBe(false)
  })
})
