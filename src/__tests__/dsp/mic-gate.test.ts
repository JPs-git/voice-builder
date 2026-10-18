import { describe, it, expect } from 'vitest'
import { VoiceActivityDetector } from '../../dsp/vad'
import { AnalysisPipeline } from '../../dsp/analysis-pipeline'
import type { SmootherFrame } from '../../dsp/formant-smoother'

const micOptions = { threshold: 0.008, releaseThreshold: 0.005, holdMs: 100 }
const level = (rms: number) => new Float32Array(800).fill(rms)
const tone = (amplitude: number, length = 16000) => Float32Array.from(
  { length }, (_, i) => amplitude * Math.sin(2 * Math.PI * 200 * i / 16000),
)

describe('microphone gate', () => {
  it('requires the opening threshold but sustains quieter input once open', () => {
    const vad = new VoiceActivityDetector(micOptions)
    expect(vad.compute(level(0.006), 10).voiced).toBe(false)
    expect(vad.compute(level(0.01), 10).voiced).toBe(true)
    for (let i = 0; i < 30; i++) expect(vad.compute(level(0.006), 10).voiced).toBe(true)
  })

  it('holds brief dips and closes after 100 ms of consecutive weak input', () => {
    const vad = new VoiceActivityDetector(micOptions)
    vad.compute(level(0.01), 10)
    for (let i = 0; i < 9; i++) expect(vad.compute(level(0), 10).voiced).toBe(true)
    expect(vad.compute(level(0), 10).voiced).toBe(false)
    expect(vad.compute(level(0.006), 10).voiced).toBe(false)
  })

  it('restarts the hold when input recovers above the release threshold', () => {
    const vad = new VoiceActivityDetector(micOptions)
    vad.compute(level(0.01), 10)
    vad.compute(level(0), 75)
    expect(vad.compute(level(0.006), 10).voiced).toBe(true)
    expect(vad.compute(level(0), 75).voiced).toBe(true)
    expect(vad.compute(level(0), 25).voiced).toBe(false)
  })

  it('clears gate history on reset', () => {
    const vad = new VoiceActivityDetector(micOptions)
    vad.compute(level(0.01), 10)
    vad.reset()
    expect(vad.compute(level(0.006), 10).voiced).toBe(false)
    expect(vad.compute(level(0), 10).voiced).toBe(false)
  })

  it('vetoes noise immediately and does not let it extend the internal hold', () => {
    const vad = new VoiceActivityDetector(micOptions)
    expect(vad.compute(level(0.01), 10, true).voiced).toBe(true)
    expect(vad.compute(level(0.006), 50, false).voiced).toBe(false)
    // A brief noise gap must not erase the hysteresis for actual quiet speech.
    expect(vad.compute(level(0.006), 10, true).voiced).toBe(true)
    expect(vad.compute(level(0.02), 100, false).voiced).toBe(false)
    expect(vad.compute(level(0.006), 10, true).voiced).toBe(false)
  })

  it('analyzes quiet tones with the same default gate for microphone and file input', () => {
    const samples = tone(0.02)
    const frames: SmootherFrame[] = []
    const mic = new AnalysisPipeline({ onFrame: f => frames.push(f) })
    mic.pushChunk(samples, 16000)
    expect(frames.length).toBe(96)
    expect(frames.every(f => f.voiced && f.f0 === 200)).toBe(true)
    expect(frames[0].rms).toBeCloseTo(0.014142, 5)
    const file = AnalysisPipeline.analyze(samples, 16000, 'hybrid')
    expect(file.slice(0, frames.length)).toEqual(frames)
    expect(file.some(f => f.f0 === 200)).toBe(true)
  })

  it('does not invent pitch during silence and resets pipeline gate history', () => {
    const frames: SmootherFrame[] = []
    const mic = new AnalysisPipeline({ vadOptions: micOptions, onFrame: f => frames.push(f) })
    mic.pushChunk(tone(0.02, 800), 16000)
    expect(frames[0].f0).toBe(200)
    mic.pushChunk(new Float32Array(2400), 16000)
    const silence = frames.filter(f => f.rms === 0)
    expect(silence.length).toBeGreaterThan(10)
    expect(silence[0].voiced).toBe(false)
    expect(silence.every(f => f.f0 === null && f.f1 === null && f.f2 === null)).toBe(true)
    expect(silence[silence.length - 1].voiced).toBe(false)
    mic.reset()
    mic.pushChunk(tone(0.009, 800), 16000)
    expect(frames[frames.length - 1].voiced).toBe(false)
  })
})
