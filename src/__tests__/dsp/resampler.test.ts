import { describe, it, expect } from 'vitest'
import { Resampler } from '../../dsp/resampler'

describe('Resampler', () => {
  it('resamples 44100 to 16000 and preserves frequency', () => {
    const inputRate = 44100
    const outputRate = 16000
    const freq = 200
    const duration = 0.1
    const inputLen = Math.round(inputRate * duration)
    const input = new Float32Array(inputLen)
    for (let i = 0; i < inputLen; i++) {
      input[i] = Math.sin(2 * Math.PI * freq * i / inputRate)
    }

    const r = new Resampler(inputRate, outputRate)
    const output = r.process(input)
    const outputLen = Math.round(outputRate * duration)
    expect(Math.abs(output.length - outputLen)).toBeLessThanOrEqual(1)
  })

  it('handles empty input', () => {
    const r = new Resampler(44100, 16000)
    expect(r.process(new Float32Array(0)).length).toBe(0)
  })

  it('buffer does not grow unbounded', () => {
    const r = new Resampler(44100, 16000)
    const chunkSamples = 100
    let maxBuffer = 0

    for (let i = 0; i < 100; i++) {
      r.process(new Float32Array(chunkSamples))
      maxBuffer = Math.max(maxBuffer, r.buffer.length)
    }

    expect(maxBuffer).toBeLessThan(chunkSamples * 2)
  })

  it('resets correctly', () => {
    const r = new Resampler(44100, 16000)
    r.process(new Float32Array(44100))
    r.reset()
    expect(r.buffer.length).toBe(0)
  })
})
