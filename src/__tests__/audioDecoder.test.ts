import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { AudioTooLongError, decodeAudioFile, probeAudioDuration } from '../audio/audioDecoder'

function stubUrl() {
  const createObjectURL = vi.fn(() => 'blob:fake')
  const revokeObjectURL = vi.fn()
  const url = globalThis.URL
  vi.stubGlobal('URL', { ...url, createObjectURL, revokeObjectURL })
  return { createObjectURL, revokeObjectURL }
}

function fakeEl(duration: number) {
  return {
    preload: '',
    src: '',
    onloadedmetadata: null as (() => void) | null,
    onerror: null as (() => void) | null,
    duration,
  }
}

describe('probeAudioDuration', () => {
  let revokeObjectURL: ReturnType<typeof vi.fn>
  let el: ReturnType<typeof fakeEl>

  beforeEach(() => {
    const spies = stubUrl()
    revokeObjectURL = spies.revokeObjectURL
    el = fakeEl(8)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sets preload=metadata and resolves with duration on loadedmetadata', async () => {
    const promise = probeAudioDuration(new Blob(['x']), el as unknown as HTMLAudioElement)
    expect(el.preload).toBe('metadata')
    expect(el.src).toBe('blob:fake')
    el.onloadedmetadata!()
    await expect(promise).resolves.toBe(8)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake')
  })

  it('rejects when metadata loading fails', async () => {
    const promise = probeAudioDuration(new Blob(['x']), el as unknown as HTMLAudioElement)
    el.onerror!()
    await expect(promise).rejects.toThrow(/Failed to load audio metadata/)
  })

  it('rejects when duration is not finite', async () => {
    el.duration = NaN
    const promise = probeAudioDuration(new Blob(['x']), el as unknown as HTMLAudioElement)
    el.onloadedmetadata!()
    await expect(promise).rejects.toThrow(/Failed to read audio duration/)
  })
})

describe('decodeAudioFile', () => {
  it('extracts channel 0 samples, sample rate, and channel count', async () => {
    const samples = new Float32Array([0.1, 0.2, 0.3])
    const context = {
      decodeAudioData: vi.fn(async () => ({
        getChannelData: vi.fn((ch: number) => (ch === 0 ? samples : samples)),
        sampleRate: 44100,
        numberOfChannels: 2,
      })),
    } as unknown as AudioContext

    const result = await decodeAudioFile(new ArrayBuffer(8), context)
    expect(result.samples).toBe(samples)
    expect(result.sampleRate).toBe(44100)
    expect(result.numChannels).toBe(2)
    expect(context.decodeAudioData).toHaveBeenCalledTimes(1)
  })

  it('propagates decode failures', async () => {
    const context = {
      decodeAudioData: vi.fn(async () => {
        throw new DOMException('Failed to decode audio data', 'EncodingError')
      }),
    } as unknown as AudioContext

    await expect(decodeAudioFile(new ArrayBuffer(8), context)).rejects.toThrow()
  })
})

describe('AudioTooLongError', () => {
  it('is an Error subclass', () => {
    expect(new AudioTooLongError()).toBeInstanceOf(Error)
  })
})