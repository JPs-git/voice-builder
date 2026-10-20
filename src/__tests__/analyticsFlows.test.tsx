import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAnalysis } from '../hooks/useAnalysis'
import { usePlayback } from '../hooks/usePlayback'
import { recordingBuffer } from '../audio/recordingBuffer'
import { useAppStore } from '../store/appStore'

const mocks = vi.hoisted(() => ({
  track: vi.fn(), startCapture: vi.fn(), stopCapture: vi.fn(), play: vi.fn(), stop: vi.fn(),
  wav: true, duration: 1, allowed: true, page: 'analysis' as 'analysis' | 'practice',
  parse: vi.fn(), decode: vi.fn(),
}))
vi.mock('../analytics/analytics', () => ({
  track: mocks.track, getAnalyticsPage: () => mocks.page, isAnalyticsAllowed: () => mocks.allowed,
}))
vi.mock('../ts', () => ({ getAudioEngine: () => ({
  startCapture: mocks.startCapture, stopCapture: mocks.stopCapture,
  createPlaybackSource: () => ({ source: { start: mocks.play, stop: mocks.stop, onended: null }, totalDuration: 1 }),
  audioContext: { currentTime: 0 },
}) }))
vi.mock('../dsp', () => ({
  isWavFile: () => mocks.wav, parseWav: mocks.parse,
  Resampler: class { process(samples: Float32Array) { return samples } },
  AnalysisPipeline: class {
    frameCount = 0
    pushChunk() {}
    flush() {}
    reset() {}
    static analyze() { return [] }
  },
}))
vi.mock('../audio/audioDecoder', () => ({
  AudioTooLongError: class extends Error {},
  probeWavDuration: async () => mocks.duration,
  probeAudioDuration: async () => mocks.duration,
  decodeAudioFile: mocks.decode,
}))

function fileEvent(hasFile = true) {
  const file = { name: 'private-voice.wav', slice: () => ({ arrayBuffer: async () => new ArrayBuffer(12) }), arrayBuffer: async () => new ArrayBuffer(24) }
  return { target: { files: hasFile ? [file] : [], value: '' } } as never
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.wav = true
  mocks.duration = 1
  mocks.allowed = true
  mocks.page = 'analysis'
  mocks.startCapture.mockResolvedValue(undefined)
  const decoded = { samples: new Float32Array([0.1, 0.2]), sampleRate: 16000, numChannels: 1 }
  mocks.parse.mockReturnValue(decoded)
  mocks.decode.mockResolvedValue(decoded)
  recordingBuffer.clear()
  useAppStore.getState().reset()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1))
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
})
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('business analytics boundaries', () => {
  it('tracks real samples across the ten-second buffer, clearing, restarting, and route changes', async () => {
    const { result } = renderHook(() => useAnalysis())
    await act(async () => { await result.current.onRecord() })
    const capture = mocks.startCapture.mock.calls[0][0] as (samples: Float32Array, rate: number) => void
    act(() => capture(new Float32Array(20 * 16000), 16000))
    expect(recordingBuffer.read().length).toBe(10 * 16000)
    expect(mocks.track).toHaveBeenCalledExactlyOnceWith('record_start', { page: 'analysis' })
    act(() => result.current.onClear())
    await act(async () => { await result.current.onRecord() })
    mocks.page = 'practice'
    act(() => capture(new Float32Array(10 * 16000), 16000))
    expect(mocks.track.mock.calls.filter(([name]) => name === 'practice_engaged')).toEqual([])
    const nextCapture = mocks.startCapture.mock.calls[1][0] as typeof capture
    act(() => nextCapture(new Float32Array(5 * 16000), 16000))
    expect(mocks.track.mock.calls.filter(([name]) => name === 'practice_engaged')).toEqual([])
    act(() => nextCapture(new Float32Array(5 * 48000), 48000))
    const engagements = mocks.track.mock.calls.filter(([name]) => name === 'practice_engaged')
    expect(engagements).toEqual([['practice_engaged', { page: 'practice' }]])
  })

  it('reports starts only after success, never for stop or another click while awaiting permission', async () => {
    let resolve!: () => void
    mocks.startCapture.mockReturnValueOnce(new Promise<void>(done => { resolve = done }))
    const { result } = renderHook(() => useAnalysis())
    act(() => { void result.current.onRecord() })
    expect(result.current.isRequesting).toBe(true)
    await act(async () => { await result.current.onRecord() })
    expect(mocks.track).not.toHaveBeenCalled()
    await act(async () => resolve())
    expect(result.current.isCapturing).toBe(true)
    expect(mocks.track).toHaveBeenCalledExactlyOnceWith('record_start', { page: 'analysis' })
    await act(async () => { await result.current.onRecord() })
    expect(result.current.isCapturing).toBe(false)
    expect(mocks.track).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['NotAllowedError', 'permission'], ['SecurityError', 'permission'],
    ['NotFoundError', 'device'], ['NotReadableError', 'device'], ['AbortError', 'device'],
    ['NotSupportedError', 'unsupported'], ['UnknownError', 'unknown'],
  ])('classifies %s without transmitting its message', async (name, reason) => {
    mocks.startCapture.mockRejectedValueOnce(new DOMException('private device information', name))
    const { result } = renderHook(() => useAnalysis())
    await act(async () => { await result.current.onRecord() })
    expect(result.current.isCapturing).toBe(false)
    expect(mocks.track).toHaveBeenCalledExactlyOnceWith('record_error', { page: 'analysis', reason })
  })

  it.each([true, false])('reports one successful import for WAV=%s, without the filename', async wav => {
    mocks.wav = wav
    const { result } = renderHook(() => useAnalysis())
    await act(async () => result.current.handleFileChange(fileEvent()))
    expect(recordingBuffer.read()).toEqual(new Float32Array([0.1, 0.2]))
    expect(mocks.track).toHaveBeenCalledExactlyOnceWith('audio_import', { page: 'analysis', result: 'success' })
  })

  it.each([true, false])('reports one too-long import for WAV=%s', async wav => {
    mocks.wav = wav
    mocks.duration = 11
    const { result } = renderHook(() => useAnalysis())
    await act(async () => result.current.handleFileChange(fileEvent()))
    expect(mocks.track).toHaveBeenCalledExactlyOnceWith('audio_import', { page: 'analysis', result: 'failure', reason: 'too_long' })
  })

  it.each([new DOMException('private', 'EncodingError'), new Error('chunk not found: private.wav')])('classifies a corrupt import without sending its message', async error => {
    mocks.parse.mockImplementationOnce(() => { throw error })
    const { result } = renderHook(() => useAnalysis())
    await act(async () => result.current.handleFileChange(fileEvent()))
    expect(mocks.track).toHaveBeenCalledExactlyOnceWith('audio_import', { page: 'analysis', result: 'failure', reason: 'unsupported_or_corrupt' })
  })

  it('does not treat a cancelled file selection or empty playback as use', async () => {
    const analysis = renderHook(() => useAnalysis())
    const playback = renderHook(() => usePlayback())
    await act(async () => analysis.result.current.handleFileChange(fileEvent(false)))
    act(() => playback.result.current.play())
    expect(mocks.track).not.toHaveBeenCalled()
  })

  it('reports playback only after source.start succeeds', () => {
    recordingBuffer.write(new Float32Array([0.1, 0.2]))
    const { result } = renderHook(() => usePlayback())
    act(() => result.current.play())
    expect(mocks.track).toHaveBeenCalledExactlyOnceWith('playback_start', { page: 'analysis' })
    act(() => result.current.stop())
    expect(mocks.track).toHaveBeenCalledTimes(1)
    mocks.play.mockImplementationOnce(() => { throw new Error('audio failure') })
    expect(() => result.current.play()).toThrow('audio failure')
    expect(mocks.track).toHaveBeenCalledTimes(1)
  })
})
