import { describe, it, expect } from 'vitest'
import { parseWav } from '../../dsp/wav-parser'

function makeWav({
  sampleRate = 44100,
  numChannels = 1,
  bitsPerSample = 16,
  samples,
}: {
  sampleRate?: number
  numChannels?: number
  bitsPerSample?: number
  samples?: Float32Array
} = {}): ArrayBuffer {
  const bytesPerSample = bitsPerSample / 8
  const numSamples = samples ? samples.length : 10
  const dataSize = numSamples * numChannels * bytesPerSample

  const buf = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buf)
  let off = 0

  const writeStr = (s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i))
    off += s.length
  }

  writeStr('RIFF')
  view.setUint32(off, 36 + dataSize, true); off += 4
  writeStr('WAVE')
  writeStr('fmt ')
  view.setUint32(off, 16, true); off += 4
  view.setUint16(off, 1, true); off += 2
  view.setUint16(off, numChannels, true); off += 2
  view.setUint32(off, sampleRate, true); off += 4
  view.setUint32(off, sampleRate * numChannels * bytesPerSample, true); off += 4
  view.setUint16(off, numChannels * bytesPerSample, true); off += 2
  view.setUint16(off, bitsPerSample, true); off += 2
  writeStr('data')
  view.setUint32(off, dataSize, true); off += 4

  if (samples) {
    for (let i = 0; i < numSamples; i++) {
      for (let ch = 0; ch < numChannels; ch++) {
        const val = Math.max(-1, Math.min(1, samples[i]))
        switch (bitsPerSample) {
          case 8:
            view.setUint8(off, Math.round((val + 1) * 127.5))
            off += 1
            break
          case 16:
            view.setInt16(off, Math.round(val * 32767), true)
            off += 2
            break
          case 24: {
            const int24 = Math.round(val * 8388607)
            view.setUint8(off, int24 & 0xff)
            view.setUint8(off + 1, (int24 >> 8) & 0xff)
            view.setUint8(off + 2, (int24 >> 16) & 0xff)
            off += 3
            break
          }
          case 32:
            view.setFloat32(off, val, true)
            off += 4
            break
        }
      }
    }
  } else {
    for (let i = 0; i < dataSize; i++) view.setUint8(off + i, 0)
  }

  return buf
}

describe('parseWav', () => {
  it('parses 16-bit mono WAV', () => {
    const samples = new Float32Array(100)
    for (let i = 0; i < samples.length; i++) samples[i] = Math.sin(2 * Math.PI * 440 * i / 44100)

    const buf = makeWav({ sampleRate: 44100, numChannels: 1, bitsPerSample: 16, samples })
    const result = parseWav(buf)

    expect(result.sampleRate).toBe(44100)
    expect(result.numChannels).toBe(1)
    expect(result.bitsPerSample).toBe(16)
    expect(result.audioFormat).toBe(1)
    expect(result.samples.length).toBe(100)
  })

  it('parses 8-bit mono WAV', () => {
    const samples = new Float32Array(50)
    for (let i = 0; i < 50; i++) samples[i] = Math.sin(2 * Math.PI * 200 * i / 8000)

    const result = parseWav(makeWav({ sampleRate: 8000, bitsPerSample: 8, samples }))
    expect(result.sampleRate).toBe(8000)
    expect(result.bitsPerSample).toBe(8)
  })

  it('parses 24-bit mono WAV', () => {
    const samples = new Float32Array(50)
    for (let i = 0; i < 50; i++) samples[i] = Math.sin(2 * Math.PI * 300 * i / 48000)

    const result = parseWav(makeWav({ sampleRate: 48000, bitsPerSample: 24, samples }))
    expect(result.bitsPerSample).toBe(24)
  })

  it('parses 32-bit float mono WAV', () => {
    const samples = new Float32Array(50)
    for (let i = 0; i < 50; i++) samples[i] = Math.sin(2 * Math.PI * 440 * i / 44100)

    const result = parseWav(makeWav({ bitsPerSample: 32, samples }))
    expect(result.bitsPerSample).toBe(32)
  })

  it('reads first channel from stereo', () => {
    const mono = new Float32Array(10)
    for (let i = 0; i < 10; i++) mono[i] = Math.sin(2 * Math.PI * 440 * i / 44100)

    const result = parseWav(makeWav({ numChannels: 2, bitsPerSample: 16, samples: mono }))
    expect(result.samples.length).toBe(10)
    expect(result.numChannels).toBe(2)
  })

  it('throws for non-RIFF', () => {
    const buf = new ArrayBuffer(44)
    expect(() => parseWav(buf)).toThrow('Not a RIFF file')
  })

  it('throws for non-WAVE', () => {
    const buf = new ArrayBuffer(44)
    const view = new DataView(buf)
    let off = 0
    const w = (s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); off += s.length }
    w('RIFF')
    view.setUint32(off, 36, true); off += 4
    w('NotWAVE')
    expect(() => parseWav(buf)).toThrow('Not a WAV file')
  })

  it('throws for missing fmt chunk', () => {
    const buf = new ArrayBuffer(12 + 8 + 8)
    const view = new DataView(buf)
    let off = 0
    const w = (s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); off += s.length }
    w('RIFF')
    view.setUint32(off, buf.byteLength - 8, true); off += 4
    w('WAVE')
    w('data')
    view.setUint32(off, 0, true)
    expect(() => parseWav(buf)).toThrow('fmt chunk not found')
  })

  it('throws for unsupported bitsPerSample', () => {
    const samples = new Float32Array(10)
    expect(() => parseWav(makeWav({ bitsPerSample: 64, samples }))).toThrow('Unsupported')
  })
})
