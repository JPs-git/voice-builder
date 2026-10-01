import { describe, it } from 'vitest'
import assert from 'node:assert/strict'
import { fftMagnitudes } from '../../dsp/fft'

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
import { vi } from 'vitest'
import { complexFft } from '../../dsp/fft'
import { Complex } from '../../dsp/complex'

function referenceMagnitudes(signal, size) {
  const data = Array.from({ length: size }, () => new Complex(0, 0))
  let sum = 0
  for (let i = 0; i < signal.length; i++) {
    const w = .5 * (1 - Math.cos(2 * Math.PI * i / (signal.length - 1)))
    data[i] = new Complex(signal[i] * w, 0)
    sum += w
  }
  complexFft(data)
  return Float32Array.from(data.slice(0, size / 2 + 1),
    x => 20 * Math.log10(Math.max(Math.sqrt(x.re * x.re + x.im * x.im) / sum, 1e-12)))
}

describe('FFT optimization contract', () => {
  it('preserves every bin through different sizes and successive frames', () => {
    let seed = 123
    for (const [size, length] of [[2048, 400], [512, 400], [2048, 256], [2048, 400]]) {
      const signal = Float32Array.from({ length }, () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
        return seed / 2 ** 31 - 1
      })
      const before = signal.slice()
      const actual = fftMagnitudes(signal, size)
      const expected = referenceMagnitudes(signal, size)
      assert.equal(actual.length, expected.length)
      for (let i = 0; i < actual.length; i++) assert.ok(Math.abs(actual[i] - expected[i]) < 1e-4)
      assert.deepEqual(signal, before)
      const saved = actual.slice()
      const silent = fftMagnitudes(new Float32Array(length), size)
      assert.deepEqual(actual, saved)
      for (const value of silent) assert.equal(value, -240)
    }
  })

  it('does not repeat trigonometry for a warmed spectrum shape', () => {
    const signal = generateSine(220, 16000, 400)
    fftMagnitudes(signal, 2048)
    const sin = vi.spyOn(Math, 'sin')
    const cos = vi.spyOn(Math, 'cos')
    try {
      fftMagnitudes(signal, 2048)
      assert.equal(sin.mock.calls.length + cos.mock.calls.length, 0)
    } finally {
      sin.mockRestore()
      cos.mockRestore()
    }
  })
})
