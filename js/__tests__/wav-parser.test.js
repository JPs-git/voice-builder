import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parseWav } from '../wav-parser.js'

function makeWav({ sampleRate = 44100, numChannels = 1, bitsPerSample = 16, samples = null }) {
  const bytesPerSample = bitsPerSample / 8
  const numSamples = samples ? samples.length : 10
  const dataSize = numSamples * numChannels * bytesPerSample

  const buf = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buf)
  let off = 0

  const writeStr = (s) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i))
    off += s.length
  }

  writeStr('RIFF')
  view.setUint32(off, 36 + dataSize, true); off += 4
  writeStr('WAVE')
  writeStr('fmt ')
  view.setUint32(off, 16, true); off += 4
  view.setUint16(off, 1, true); off += 2 // PCM
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

    assert.equal(result.sampleRate, 44100)
    assert.equal(result.numChannels, 1)
    assert.equal(result.bitsPerSample, 16)
    assert.equal(result.audioFormat, 1)
    assert.equal(result.samples.length, 100)
    for (let i = 0; i < 100; i++) {
      assert.ok(Math.abs(result.samples[i] - samples[i]) < 0.01, `sample ${i} mismatch`)
    }
  })

  it('parses 8-bit mono WAV', () => {
    const samples = new Float32Array(50)
    for (let i = 0; i < 50; i++) samples[i] = Math.sin(2 * Math.PI * 200 * i / 8000)

    const result = parseWav(makeWav({ sampleRate: 8000, numChannels: 1, bitsPerSample: 8, samples }))
    assert.equal(result.sampleRate, 8000)
    assert.equal(result.bitsPerSample, 8)
    assert.equal(result.samples.length, 50)
  })

  it('parses 24-bit mono WAV', () => {
    const samples = new Float32Array(50)
    for (let i = 0; i < 50; i++) samples[i] = Math.sin(2 * Math.PI * 300 * i / 48000)

    const result = parseWav(makeWav({ sampleRate: 48000, numChannels: 1, bitsPerSample: 24, samples }))
    assert.equal(result.sampleRate, 48000)
    assert.equal(result.bitsPerSample, 24)
    assert.equal(result.samples.length, 50)
  })

  it('parses 32-bit float mono WAV', () => {
    const samples = new Float32Array(50)
    for (let i = 0; i < 50; i++) samples[i] = Math.sin(2 * Math.PI * 440 * i / 44100)

    const result = parseWav(makeWav({ sampleRate: 44100, numChannels: 1, bitsPerSample: 32, samples }))
    assert.equal(result.sampleRate, 44100)
    assert.equal(result.bitsPerSample, 32)
    assert.equal(result.samples.length, 50)
  })

  it('reads first channel from stereo WAV', () => {
    const mono = new Float32Array(10)
    for (let i = 0; i < 10; i++) mono[i] = Math.sin(2 * Math.PI * 440 * i / 44100)

    const buf = makeWav({ sampleRate: 44100, numChannels: 2, bitsPerSample: 16, samples: mono })
    const result = parseWav(buf)
    assert.equal(result.samples.length, 10)
    assert.equal(result.numChannels, 2)
  })

  it('throws for non-RIFF', () => {
    const buf = new ArrayBuffer(44)
    assert.throws(() => parseWav(buf), /Not a RIFF file/)
  })

  it('throws for non-WAVE', () => {
    const buf = new ArrayBuffer(44)
    const view = new DataView(buf)
    let off = 0
    const w = (s) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); off += s.length }
    w('RIFF')
    view.setUint32(off, 36, true); off += 4
    w('NotWAVE')
    assert.throws(() => parseWav(buf), /Not a WAV file/)
  })

  it('throws for missing fmt chunk', () => {
    const buf = new ArrayBuffer(12 + 8 + 8)
    const view = new DataView(buf)
    let off = 0
    const w = (s) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); off += s.length }
    w('RIFF')
    view.setUint32(off, buf.byteLength - 8, true); off += 4
    w('WAVE')
    w('data')
    view.setUint32(off, 0, true); off += 4
    assert.throws(() => parseWav(buf), /fmt chunk not found/)
  })

  it('throws for missing data chunk', () => {
    const buf = new ArrayBuffer(12 + 8 + 24)
    const view = new DataView(buf)
    let off = 0
    const w = (s) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); off += s.length }
    w('RIFF')
    view.setUint32(off, buf.byteLength - 8, true); off += 4
    w('WAVE')
    w('fmt ')
    view.setUint32(off, 16, true); off += 4
    view.setUint16(off, 1, true); off += 2
    view.setUint16(off, 1, true); off += 2
    view.setUint32(off, 44100, true); off += 4
    view.setUint32(off, 88200, true); off += 4
    view.setUint16(off, 2, true); off += 2
    view.setUint16(off, 16, true); off += 2
    assert.throws(() => parseWav(buf), /data chunk not found/)
  })

  it('throws for unsupported bitsPerSample', () => {
    const samples = new Float32Array(10)
    assert.throws(() => parseWav(makeWav({ sampleRate: 44100, bitsPerSample: 64, samples })), /Unsupported/)
  })
})
