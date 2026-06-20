import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { fftMagnitudes } from '../fft.js'

function generateSine(freqHz, sampleRate, numSamples) {
  const signal = new Float32Array(numSamples)
  for (let i = 0; i < numSamples; i++) {
    signal[i] = Math.sin(2 * Math.PI * freqHz * i / sampleRate)
  }
  return signal
}

describe('fftMagnitudes with 512-FFT (400-sample input)', () => {
  const sampleRate = 16000
  const frameSize = 400
  const fftSize = 512

  it('returns 257 bins (N/2 + 1)', () => {
    const signal = generateSine(200, sampleRate, frameSize)
    const mags = fftMagnitudes(signal, fftSize)
    assert.equal(mags.length, fftSize / 2 + 1)
  })

  it('peak bin for 200Hz sine', () => {
    const signal = generateSine(200, sampleRate, frameSize)
    const mags = fftMagnitudes(signal, fftSize)
    // Bin 0 = DC, bin 1 = 16000/512 = 31.25 Hz
    // 200 Hz ≈ bin 200 / 31.25 = 6.4 → bin 6 or 7
    let maxIdx = 0
    for (let i = 0; i < mags.length; i++) {
      if (mags[i] > mags[maxIdx]) maxIdx = i
    }
    const binFreq = maxIdx * sampleRate / fftSize
    assert.ok(Math.abs(binFreq - 200) < 50,
      `expected peak near 200Hz, got ${binFreq}Hz (bin ${maxIdx})`)
  })

  it('peak bin for 440Hz sine', () => {
    const signal = generateSine(440, sampleRate, frameSize)
    const mags = fftMagnitudes(signal, fftSize)
    let maxIdx = 0
    for (let i = 1; i < mags.length; i++) {
      if (mags[i] > mags[maxIdx]) maxIdx = i
    }
    const binFreq = maxIdx * sampleRate / fftSize
    assert.ok(Math.abs(binFreq - 440) < 50,
      `expected peak near 440Hz, got ${binFreq}Hz (bin ${maxIdx})`)
  })

  it('returns -Inf for all bins on silent input', () => {
    const signal = new Float32Array(frameSize)
    const mags = fftMagnitudes(signal, fftSize)
    // All bins should be very low (log of near-zero)
    for (let i = 0; i < mags.length; i++) {
      assert.ok(mags[i] < -50, `bin ${i} should be low, got ${mags[i]}`)
    }
  })
})
