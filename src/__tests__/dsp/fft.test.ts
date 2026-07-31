import { describe, it, expect } from 'vitest'
import { fftMagnitudes } from '../../dsp/fft'

function generateSine(freqHz: number, sampleRate: number, numSamples: number): Float32Array {
  const signal = new Float32Array(numSamples)
  for (let i = 0; i < numSamples; i++) {
    signal[i] = Math.sin(2 * Math.PI * freqHz * i / sampleRate)
  }
  return signal
}

describe('fftMagnitudes', () => {
  const sampleRate = 16000
  const frameSize = 400
  const fftSize = 512

  it('returns 257 bins (N/2 + 1)', () => {
    const signal = generateSine(200, sampleRate, frameSize)
    const mags = fftMagnitudes(signal, fftSize)
    expect(mags.length).toBe(fftSize / 2 + 1)
  })

  it('peak bin for 200Hz sine', () => {
    const signal = generateSine(200, sampleRate, frameSize)
    const mags = fftMagnitudes(signal, fftSize)
    let maxIdx = 0
    for (let i = 0; i < mags.length; i++) {
      if (mags[i] > mags[maxIdx]) maxIdx = i
    }
    const binFreq = maxIdx * sampleRate / fftSize
    expect(Math.abs(binFreq - 200)).toBeLessThan(50)
  })

  it('peak bin for 440Hz sine', () => {
    const signal = generateSine(440, sampleRate, frameSize)
    const mags = fftMagnitudes(signal, fftSize)
    let maxIdx = 0
    for (let i = 1; i < mags.length; i++) {
      if (mags[i] > mags[maxIdx]) maxIdx = i
    }
    const binFreq = maxIdx * sampleRate / fftSize
    expect(Math.abs(binFreq - 440)).toBeLessThan(50)
  })

  it('returns very low values for silent input', () => {
    const signal = new Float32Array(frameSize)
    const mags = fftMagnitudes(signal, fftSize)
    for (let i = 0; i < mags.length; i++) {
      expect(mags[i]).toBeLessThan(-50)
    }
  })
})
