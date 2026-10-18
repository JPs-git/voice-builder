import { describe, it, expect } from 'vitest'
import { AnalysisPipeline } from '../../dsp/analysis-pipeline'
import type { SmootherFrame } from '../../dsp/formant-smoother'

function noise(length: number, rms: number, seed = 12345): Float32Array {
  return Float32Array.from({ length }, () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return (seed / 4294967296 * 2 - 1) * Math.sqrt(3) * rms
  })
}

function tone(length: number, amplitude: number, rate = 16000): Float32Array {
  return Float32Array.from({ length }, (_, i) => amplitude * Math.sin(2 * Math.PI * 200 * i / rate))
}

function collect() {
  const frames: SmootherFrame[] = []
  const pipeline = new AnalysisPipeline({ onFrame: f => frames.push(f) })
  return { frames, pipeline }
}

describe('shared gate and background noise', () => {
  it.each([0.003, 0.006, 0.02])('does not render pure noise at RMS %s after speech', rms => {
    const { pipeline, frames } = collect()
    pipeline.pushChunk(tone(800, 0.02), 16000)
    expect(frames[0].f0).toBe(200)
    pipeline.pushChunk(noise(16000, rms), 16000)
    // Four windows still overlap the initial tone; the rest contain noise only.
    const pureNoise = frames.slice(5)
    expect(pureNoise.length).toBe(96)
    expect(pureNoise.every(f => !f.voiced && f.f0 === null && f.f1 === null && f.f2 === null)).toBe(true)
    // Once noise has drained the hold, sub-opening-level speech cannot reopen it.
    pipeline.pushChunk(tone(1600, 0.009), 16000)
    if (rms < 0.008) expect(frames[frames.length - 1].voiced).toBe(false)
    pipeline.pushChunk(tone(1600, 0.02), 16000)
    expect(frames[frames.length - 1].f0).toBe(200)
  })

  it.each([1, 42, 98765])('does not open on broadband noise at startup (seed %s)', seed => {
    const frames = AnalysisPipeline.analyze(noise(16000, 0.02, seed), 16000, 'hybrid')
    expect(frames.every(f => !f.voiced && f.f0 === null && f.f1 === null && f.f2 === null)).toBe(true)
  })

  it('does not turn short noise clips into speech when flush adds padding', () => {
    const falseOpenSeeds: number[] = []
    for (let seed = 1; seed <= 500; seed++) {
      const frames = AnalysisPipeline.analyze(noise(800, 0.03 / Math.sqrt(3), seed), 16000, 'hybrid')
      if (frames.some(f => f.voiced || f.f1 !== null || f.f2 !== null)) falseOpenSeeds.push(seed)
    }
    expect(falseOpenSeeds).toEqual([])
  })

  it('keeps sustained speech above a custom low threshold open', () => {
    const frames: SmootherFrame[] = []
    const pipeline = new AnalysisPipeline({ vadThreshold: 0.001, onFrame: f => frames.push(f) })
    pipeline.pushChunk(tone(16000, 0.003), 16000)
    expect(frames.every(f => f.voiced && f.f0 === 200)).toBe(true)
  })

  it('treats an empty gate override as shared defaults', () => {
    const frames: SmootherFrame[] = []
    const pipeline = new AnalysisPipeline({ vadOptions: {}, onFrame: f => frames.push(f) })
    pipeline.pushChunk(tone(800, 0.02), 16000)
    pipeline.pushChunk(tone(16000, 0.009), 16000)
    expect(frames.slice(5).every(f => f.voiced && f.f0 === 200)).toBe(true)
  })

  it('retains weak periodic speech across the hysteresis band', () => {
    const { pipeline, frames } = collect()
    pipeline.pushChunk(tone(800, 0.02), 16000)
    pipeline.pushChunk(tone(16000, 0.009), 16000)
    expect(frames.slice(5).every(f => f.voiced && f.f0 === 200)).toBe(true)
  })

  it('does not require pitch for structured aperiodic input', () => {
    const samples = noise(16000, 1)
    let previous = 0
    let sum = 0
    for (let i = 0; i < samples.length; i++) {
      previous = 0.95 * previous + 0.05 * samples[i]
      samples[i] = previous
      sum += previous * previous
    }
    const scale = 0.02 / Math.sqrt(sum / samples.length)
    for (let i = 0; i < samples.length; i++) samples[i] *= scale
    const frames = AnalysisPipeline.analyze(samples, 16000, 'hybrid')
    expect(frames.filter(f => f.voiced && f.f0 === null && f.f1 !== null).length).toBeGreaterThan(10)
  })

  it.each([16000, 44100, 48000])('matches streaming and whole-file results at %s Hz, including flush', rate => {
    const samples = new Float32Array(rate)
    samples.set(tone(Math.floor(rate / 3), 0.02, rate))
    samples.set(noise(Math.floor(rate / 3), 0.006), Math.floor(rate / 3))
    samples.set(tone(rate - Math.floor(rate / 3) * 2, 0.02, rate), Math.floor(rate / 3) * 2)
    const { pipeline, frames } = collect()
    for (let i = 0; i < samples.length; i += 1024) pipeline.pushChunk(samples.subarray(i, i + 1024), rate)
    pipeline.flush()
    const file = AnalysisPipeline.analyze(samples, rate, 'hybrid')
    expect(frames.length).toBe(file.length)
    frames.forEach((f, i) => {
      expect(f.voiced).toBe(file[i].voiced)
      expect(f.f0).toBe(file[i].f0)
      expect(f.f1).toBe(file[i].f1)
      expect(f.f2).toBe(file[i].f2)
      expect(f.rms).toBeCloseTo(file[i].rms!, 7)
    })
    expect(file.some(f => f.voiced)).toBe(true)
    expect(file.some(f => !f.voiced)).toBe(true)
    expect(file[file.length - 1].voiced).toBe(false)
  })
})
