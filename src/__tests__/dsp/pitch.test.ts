import { describe, it, expect } from 'vitest'
import { detectPitch } from '../../dsp/lpc'

function generateSine(freqHz: number, sampleRate: number, numSamples: number): Float32Array {
  const signal = new Float32Array(numSamples)
  for (let i = 0; i < numSamples; i++) {
    signal[i] = Math.sin(2 * Math.PI * freqHz * i / sampleRate)
  }
  return signal
}

describe('detectPitch', () => {
  const sampleRate = 16000
  const frameSize = 400

  it('detects 100 Hz sine', () => {
    const signal = generateSine(100, sampleRate, frameSize)
    const f0 = detectPitch(signal, sampleRate)
    expect(f0).toBeGreaterThan(0)
    expect(Math.abs(f0! - 100)).toBeLessThan(15)
  })

  it('detects 200 Hz sine', () => {
    const signal = generateSine(200, sampleRate, frameSize)
    const f0 = detectPitch(signal, sampleRate)
    expect(f0).toBeGreaterThan(0)
    expect(Math.abs(f0! - 200)).toBeLessThan(15)
  })

  it('detects 440 Hz sine', () => {
    const signal = generateSine(440, sampleRate, frameSize)
    const f0 = detectPitch(signal, sampleRate)
    expect(f0).toBeGreaterThan(0)
    expect(Math.abs(f0! - 440)).toBeLessThan(30)
  })

  it('returns null for silence', () => {
    const signal = new Float32Array(frameSize)
    expect(detectPitch(signal, sampleRate)).toBeNull()
  })

  it('returns null for white noise', () => {
    const signal = new Float32Array(frameSize)
    for (let i = 0; i < frameSize; i++) signal[i] = (Math.random() * 2 - 1) * 0.5
    expect(detectPitch(signal, sampleRate)).toBeNull()
  })
})
