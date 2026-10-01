import { describe, it, vi } from 'vitest'
import assert from 'node:assert/strict'
import { extractFormantsCepstral } from '../../dsp/cepstral'

describe('cepstral FFT allocation contract', () => {
  const signal = Float32Array.from({ length: 800 },
    (_, i) => .5 * Math.sin(2 * Math.PI * 220 * i / 16000) + .1 * Math.sin(2 * Math.PI * 1300 * i / 16000))

  it('does not recompute FFT sine factors after the first call', () => {
    extractFormantsCepstral(signal, 16000, 2, null)
    const sine = vi.spyOn(Math, 'sin')
    try {
      extractFormantsCepstral(signal, 16000, 2, null)
      assert.equal(sine.mock.calls.length, 0)
    } finally {
      sine.mockRestore()
    }
  })

  it('retains results through nonzero, silence and a different frame length', () => {
    const original = extractFormantsCepstral(signal, 16000, 2, null)
    const saved = structuredClone(original)
    const silent = extractFormantsCepstral(new Float32Array(800), 16000, 2, null)
    assert.deepEqual(silent.formants, [])
    extractFormantsCepstral(signal.subarray(0, 400), 16000, 2, null)
    const repeated = extractFormantsCepstral(signal, 16000, 2, null)
    assert.deepEqual(original, saved)
    assert.deepEqual(repeated, original)
  })
})
