import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePlayback } from '../hooks/usePlayback'
import { getAudioEngine, resetAudioEngine } from '../ts'
import { recordingBuffer } from '../audio/recordingBuffer'
import { useAppStore } from '../store/appStore'

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
    recordingBuffer.clear()
    useAppStore.getState().reset()
  })

  it('returns play/stop functions and isPlaying state', () => {
    const { result } = renderHook(() => usePlayback())
    expect(typeof result.current.play).toBe('function')
    expect(typeof result.current.stop).toBe('function')
    expect(result.current.isPlaying).toBe(false)
  })

  it('cursorTime starts at -1', () => {
    const { result } = renderHook(() => usePlayback())
    expect(result.current.cursorTime).toBe(-1)
  })

  it('play does nothing when recordingBuffer is empty', () => {
    const { result } = renderHook(() => usePlayback())
    act(() => { result.current.play() })
    expect(result.current.isPlaying).toBe(false)
  })

  it('play returns early with no data', () => {
    const { result } = renderHook(() => usePlayback())
    act(() => { result.current.play() })
    expect(result.current.isPlaying).toBe(false)
  })

  it('stop when not playing is no-op', () => {
    const { result } = renderHook(() => usePlayback())
    act(() => { result.current.stop() })
    expect(result.current.isPlaying).toBe(false)
  })
})
