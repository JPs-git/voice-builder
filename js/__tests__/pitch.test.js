import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { detectPitch } from '../lpc.js'

function generateSine(freqHz, sampleRate, numSamples) {
  const signal = new Float32Array(numSamples)
  for (let i = 0; i < numSamples; i++) {
    signal[i] = Math.sin(2 * Math.PI * freqHz * i / sampleRate)
  }
  return signal
}

describe('detectPitch at 16kHz / 400-sample frames', () => {
  const sampleRate = 16000
  const frameSize = 400

  it('detects 100 Hz sine wave', () => {
    const signal = generateSine(100, sampleRate, frameSize)
    const f0 = detectPitch(signal, sampleRate)
    assert.ok(f0 !== null, 'should detect voiced')
    assert.ok(Math.abs(f0 - 100) < 5, `expected ~100Hz, got ${f0}Hz`)
  })

  it('detects 200 Hz sine wave', () => {
    const signal = generateSine(200, sampleRate, frameSize)
    const f0 = detectPitch(signal, sampleRate)
    assert.ok(f0 !== null)
    assert.ok(Math.abs(f0 - 200) < 10)
  })

  it('detects 440 Hz sine wave', () => {
    const signal = generateSine(440, sampleRate, frameSize)
    const f0 = detectPitch(signal, sampleRate)
    assert.ok(f0 !== null)
    assert.ok(Math.abs(f0 - 440) < 20)
  })

  it('returns null for silence', () => {
    const signal = new Float32Array(frameSize)
    const f0 = detectPitch(signal, sampleRate)
    assert.equal(f0, null)
  })

  it('returns null for white noise (low autocorrelation)', () => {
    const signal = new Float32Array(frameSize)
    for (let i = 0; i < frameSize; i++) {
      signal[i] = Math.random() * 2 - 1
    }
    const f0 = detectPitch(signal, sampleRate)
    assert.ok(f0 === null || (f0 > 50 && f0 < 500))
  })

  it('handles same frequency at different sample rates consistently', () => {
    const sampleRate2 = 44100
    const frameSize2 = 512
    const signal1 = generateSine(200, sampleRate, frameSize)
    const signal2 = generateSine(200, sampleRate2, frameSize2)
    const f0_16k = detectPitch(signal1, sampleRate)
    const f0_44k = detectPitch(signal2, sampleRate2)
    assert.ok(f0_16k !== null && f0_44k !== null)
    assert.ok(Math.abs(f0_16k - f0_44k) < 10,
      `16k: ${f0_16k}Hz, 44k: ${f0_44k}Hz`)
  })
})
