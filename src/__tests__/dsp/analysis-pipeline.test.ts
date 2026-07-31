import { describe, it, expect } from 'vitest'
import { AnalysisPipeline } from '../../dsp/analysis-pipeline'

function generateSine(freqHz: number, sampleRate: number, durationSec: number): Float32Array {
  const len = Math.round(sampleRate * durationSec)
  const signal = new Float32Array(len)
  for (let i = 0; i < len; i++) {
    signal[i] = Math.sin(2 * Math.PI * freqHz * i / sampleRate)
  }
  return signal
}

describe('AnalysisPipeline', () => {
  it('static analyze() produces frames for valid input', () => {
    const samples = generateSine(200, 16000, 1)
    const frames = AnalysisPipeline.analyze(samples, 16000, 'hybrid', true)
    expect(frames.length).toBeGreaterThan(0)
    // First frame has expected structure
    const f = frames[0]
    expect(f).toHaveProperty('time')
    expect(f).toHaveProperty('f0')
    expect(f).toHaveProperty('f1')
    expect(f).toHaveProperty('f2')
  })

  it('static analyze() detects F0 for 200Hz sine', () => {
    const samples = generateSine(200, 16000, 0.5)
    const frames = AnalysisPipeline.analyze(samples, 16000, 'hybrid', true)
    // Find frames with valid F0
    const voiced = frames.filter(f => f.f0 != null && f.f0 > 0)
    expect(voiced.length).toBeGreaterThan(0)
    const avgF0 = voiced.reduce((s, f) => s + f.f0!, 0) / voiced.length
    expect(Math.abs(avgF0 - 200)).toBeLessThan(50)
  })

  it('times increment by ~0.01s per frame', () => {
    const samples = generateSine(200, 16000, 1)
    const frames = AnalysisPipeline.analyze(samples, 16000, 'hybrid', true)
    for (let i = 1; i < frames.length; i++) {
      const dt = frames[i].time - frames[i - 1].time
      expect(Math.abs(dt - 0.01)).toBeLessThan(0.001)
    }
  })

  it('handles empty input gracefully', () => {
    const frames = AnalysisPipeline.analyze(new Float32Array(0), 16000, 'hybrid', true)
    expect(frames).toEqual([])
  })
})
