/// <reference types="node" />
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { AudioTooLongError, decodeAudioFile, probeAudioDuration, probeWavDuration, wavDurationFromHeader } from '../audio/audioDecoder'
import { isWavFile } from '../dsp/wav-parser'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

if (typeof Blob.prototype.arrayBuffer !== 'function') {
  Blob.prototype.arrayBuffer = function () {
    return new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as ArrayBuffer)
      reader.onerror = () => reject(reader.error)
      reader.readAsArrayBuffer(this)
    })
  }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ASSETS = path.resolve(__dirname, '../../assets')

function loadAsset(name: string): Buffer {
  return readFileSync(path.join(ASSETS, name))
}

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
    removeAttribute: vi.fn(),
    load: vi.fn(),
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

  it('rejects with a timeout when metadata never loads, and cleans up', async () => {
    const promise = probeAudioDuration(new Blob(['x']), el as unknown as HTMLAudioElement, 10)
    await expect(promise).rejects.toThrow(/Failed to load audio metadata/)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake')
    expect(el.removeAttribute).toHaveBeenCalledWith('src')
    expect(el.load).toHaveBeenCalled()
  })
})

function wavHeader(byteRate: number, dataSize: number): ArrayBuffer {
  const buf = new ArrayBuffer(44)
  const view = new DataView(buf)
  const ascii = (s: string, offset: number) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i))
  }
  ascii('RIFF', 0)
  view.setUint32(4, 36 + dataSize, true)
  ascii('WAVE', 8)
  ascii('fmt ', 12)
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, 16000, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  ascii('data', 36)
  view.setUint32(40, dataSize, true)
  return buf
}

describe('wavDurationFromHeader', () => {
  it('computes duration from the header', () => {
    expect(wavDurationFromHeader(new DataView(wavHeader(32000, 320000)))).toBe(10)
  })

  it('returns 0 for an empty data chunk', () => {
    expect(wavDurationFromHeader(new DataView(wavHeader(32000, 0)))).toBe(0)
  })

  it('returns null for non-RIFF bytes', () => {
    expect(wavDurationFromHeader(new DataView(new ArrayBuffer(12)))).toBeNull()
  })

  it('returns null when the data chunk lies beyond the slice', () => {
    const full = wavHeader(32000, 320000)
    const cut = new ArrayBuffer(36) // only the fmt chunk fits
    new Uint8Array(cut).set(new Uint8Array(full, 0, 36))
    expect(wavDurationFromHeader(new DataView(cut))).toBeNull()
  })

  it('returns null when the byteRate is zero', () => {
    expect(wavDurationFromHeader(new DataView(wavHeader(0, 320000)))).toBeNull()
  })
})

describe('probeWavDuration', () => {
  it('reads only a header slice to compute duration', async () => {
    await expect(probeWavDuration(new Blob([wavHeader(32000, 320000)]))).resolves.toBe(10)
  })

  it('returns null for an unresolvable header', async () => {
    await expect(probeWavDuration(new Blob([new Uint8Array([1, 2, 3])]))).resolves.toBeNull()
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

describe('format detection on real files', () => {
  it('a.mp3 is not detected as WAV', () => {
    const mp3 = new Uint8Array(loadAsset('a.mp3'))
    const head = mp3.buffer.slice(mp3.byteOffset, mp3.byteOffset + 12)
    expect(isWavFile(head)).toBe(false)
  })

  it('a.m4a is not detected as WAV', () => {
    const m4a = new Uint8Array(loadAsset('a.m4a'))
    const head = m4a.buffer.slice(m4a.byteOffset, m4a.byteOffset + 12)
    expect(isWavFile(head)).toBe(false)
  })

  it('a.wav IS detected as WAV', () => {
    const wav = new Uint8Array(loadAsset('a.wav'))
    const head = wav.buffer.slice(wav.byteOffset, wav.byteOffset + 12)
    expect(isWavFile(head)).toBe(true)
  })
})