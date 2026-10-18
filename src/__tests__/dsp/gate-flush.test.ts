import { describe, it, expect } from 'vitest'
import { AnalysisPipeline } from '../../dsp/analysis-pipeline'

describe('gate at a mixed speech/noise tail', () => {
  it('does not estimate formants from less than half an analysis window', () => {
    const short = Float32Array.from({ length: 320 }, (_, i) => 0.2 * Math.sin(2 * Math.PI * 200 * i / 16000))
    const frames = AnalysisPipeline.analyze(short, 16000, 'hybrid')
    expect(frames.length).toBeGreaterThan(0)
    expect(frames.every(f => !f.voiced && f.f0 === null && f.f1 === null && f.f2 === null)).toBe(true)
  })

  it('can analyze a real 25ms tail and clears the real sample count on reset', () => {
    const samples = Float32Array.from({ length: 400 }, (_, i) => 0.02 * Math.sin(2 * Math.PI * 200 * i / 16000))
    const first = AnalysisPipeline.analyze(samples, 16000, 'hybrid')
    expect(first[0].f0).toBe(200)
    expect(first[first.length - 1].voiced).toBe(false)
    const frames: typeof first = []
    const pipeline = new AnalysisPipeline({ onFrame: f => frames.push(f) })
    pipeline.pushChunk(new Float32Array(16000), 16000)
    pipeline.reset()
    frames.length = 0
    pipeline.pushChunk(samples, 16000)
    pipeline.flush()
    expect(frames).toEqual(first)
  })

  it('does not reuse speech evidence from earlier in the tail for later noise', () => {
    const failures: number[] = []
    for (let initialSeed = 1; initialSeed <= 500; initialSeed++) {
      let seed = initialSeed
      const input = Float32Array.from({ length: 800 }, (_, i) => {
        if (i < 320) return 0.2 * Math.sin(2 * Math.PI * 200 * i / 16000)
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
        return (seed / 4294967296 * 2 - 1) * 0.03
      })
      const frames = AnalysisPipeline.analyze(input, 16000, 'hybrid')
      expect(frames[0].voiced).toBe(true)
      if (frames.slice(2).some(f => f.voiced || f.f1 !== null || f.f2 !== null)) failures.push(initialSeed)
    }
    expect(failures).toEqual([])
  })
})
