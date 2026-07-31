import { describe, it, expect } from 'vitest'
import { VoiceActivityDetector } from '../../dsp/vad'

describe('VoiceActivityDetector', () => {
  it('returns voiced=false for silence', () => {
    const vad = new VoiceActivityDetector()
    const result = vad.compute(new Float32Array(400))
    expect(result.voiced).toBe(false)
  })

  it('returns voiced=false for low amplitude', () => {
    const vad = new VoiceActivityDetector()
    const signal = new Float32Array(400)
    signal.fill(0.001)
    expect(vad.compute(signal).voiced).toBe(false)
  })

  it('returns voiced=true for amplitude at default threshold', () => {
    const vad = new VoiceActivityDetector()
    const signal = new Float32Array(400)
    signal.fill(0.05)
    expect(vad.compute(signal).voiced).toBe(true)
  })

  it('accepts custom threshold', () => {
    const vad = new VoiceActivityDetector({ threshold: 0.1 })
    const low = new Float32Array(400)
    low.fill(0.05)
    expect(vad.compute(low).voiced).toBe(false)
    const high = new Float32Array(400)
    high.fill(0.15)
    expect(vad.compute(high).voiced).toBe(true)
  })
})
