import { describe, it, expect } from 'vitest'
import { Resampler } from '../../dsp/resampler'

describe('resampler chunk boundaries', () => {
  it.each([8000, 44100, 48000])('preserves fractional phase for %s Hz regardless of chunk size', rate => {
    const samples = Float32Array.from({ length: rate }, (_, i) => Math.sin(i * 0.137) * 0.02)
    const expected = new Resampler(rate).process(samples)
    for (const size of [1, 7, 1024]) {
      const resampler = new Resampler(rate)
      const output: number[] = []
      for (let i = 0; i < samples.length; i += size) output.push(...resampler.process(samples.subarray(i, i + size)))
      expect(new Float32Array(output)).toEqual(expected)
      resampler.reset()
      expect(resampler.process(samples)).toEqual(expected)
    }
  })
})
