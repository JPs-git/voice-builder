import { describe, it } from 'vitest'
import assert from 'node:assert/strict'
import * as fft from '../../dsp/fft'
import { Complex } from '../../dsp/complex'

describe('NumericFft', () => {
  it('uses the existing positive-angle convention on a known quadrature signal', () => {
    const workspace = new fft.NumericFft(4)
    workspace.real.set([0, 1, 0, -1])
    workspace.transform()
    for (const value of workspace.real) assert.ok(Math.abs(value) < 1e-12)
    assert.ok(Math.abs(workspace.imag[1] - 2) < 1e-12)
    assert.ok(Math.abs(workspace.imag[3] + 2) < 1e-12)
  })

  for (const size of [8, 512, 2048]) {
    it('matches the existing Complex transform and inverse at size ' + size, () => {
      const workspace = new fft.NumericFft(size)
      let seed = 987
      const input = Array.from({ length: size }, () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
        const re = seed / 2 ** 31 - 1
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
        return new Complex(re, seed / 2 ** 31 - 1)
      })
      for (const inverse of [false, true]) {
        const expected = input.map(z => new Complex(z.re, z.im))
        workspace.real.set(input.map(z => z.re))
        workspace.imag.set(input.map(z => z.im))
        inverse ? fft.ifft(expected) : fft.complexFft(expected)
        workspace.transform(inverse)
        for (let i = 0; i < size; i++) {
          assert.ok(Math.abs(workspace.real[i] - expected[i].re) < 1e-10)
          assert.ok(Math.abs(workspace.imag[i] - expected[i].im) < 1e-10)
        }
      }
      workspace.real.set(input.map(z => z.re))
      workspace.imag.set(input.map(z => z.im))
      workspace.transform()
      workspace.transform(true)
      for (let i = 0; i < size; i++) {
        assert.ok(Math.abs(workspace.real[i] - input[i].re) < 1e-10)
        assert.ok(Math.abs(workspace.imag[i] - input[i].im) < 1e-10)
      }
    })
  }

  it('rejects dimensions that cannot be transformed by radix two', () => {
    for (const size of [0, 1, 3, -2, 2.5]) assert.throws(() => new fft.NumericFft(size), RangeError)
  })
})
