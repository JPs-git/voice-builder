import { describe, it } from 'vitest'
import assert from 'node:assert/strict'
import { fftMagnitudes } from '../../dsp/fft'
import { extractHarmonics } from '../../dsp/harmonic-amplitudes'

const SR = 16000

function makeSignal(freqs, amps, duration = 0.05) {
  const n = Math.round(SR * duration)
  const s = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const t = i / SR
    let v = 0
    for (let k = 0; k < freqs.length; k++) {
      v += amps[k] * Math.sin(2 * Math.PI * freqs[k] * t)
    }
    s[i] = v
  }
  return s
}

function bandlimitedSawtooth(f0) {
  const freqs = []
  const amps = []
  for (let n = 1; ; n++) {
    const f = n * f0
    if (f >= SR / 2) break
    freqs.push(f)
    amps.push(1 / n)
  }
  return makeSignal(freqs, amps)
}

function magnitudesOf(signal) {
  return fftMagnitudes(signal, 2048)
}

// Hand-built spectrum, bin = freq * 2048 / 16000.
function spectrumWith(levels) {
  const mags = new Float32Array(1025).fill(-80)
  for (const [bin, db] of Object.entries(levels)) {
    mags[Number(bin)] = db
  }
  return mags
}

describe('extractHarmonics', () => {
  it('returns nulls for f0 null', () => {
    const mags = magnitudesOf(makeSignal([200], [1]))
    const r = extractHarmonics(mags, null, SR)
    assert.equal(r.h1, null)
    assert.equal(r.h2, null)
    assert.equal(r.h3, null)
    assert.equal(r.h4, null)
    assert.equal(r.harmonicCount, 0)
    assert.equal(r.shr, null)
  })

  it('returns nulls for empty magnitudes', () => {
    const r = extractHarmonics(new Float32Array(0), 200, SR)
    assert.equal(r.h1, null)
    assert.equal(r.harmonicCount, 0)
  })

  it('extracts strong H1 for pure sine', () => {
    const mags = magnitudesOf(makeSignal([200], [1]))
    const r = extractHarmonics(mags, 200, SR)
    assert.ok(r.h1 != null, 'h1 should be present')
    assert.ok(r.h1 > -20, 'h1 should be a real signal peak, not noise floor')
  })

  it('pure sine has sparse harmonics: large h1h2, low harmonicCount', () => {
    const mags = magnitudesOf(makeSignal([200], [1]))
    const r = extractHarmonics(mags, 200, SR)
    assert.ok(r.h2 != null)
    assert.ok(r.h1 - r.h2 > 20, `expected large h1h2, got ${r.h1 - r.h2}`)
    assert.ok(r.harmonicCount <= 2, `expected sparse harmonics, got ${r.harmonicCount}`)
  })

  it('bandlimited sawtooth has rich harmonics: small h1h2, high harmonicCount', () => {
    const mags = magnitudesOf(bandlimitedSawtooth(200))
    const r = extractHarmonics(mags, 200, SR)
    assert.ok(r.h1 != null && r.h2 != null)
    const h1h2 = r.h1 - r.h2
    assert.ok(h1h2 < 12, `expected small h1h2 (1/n decay ~6dB), got ${h1h2.toFixed(1)}`)
    assert.ok(h1h2 > 2, `expected h1h2 near 6dB, got ${h1h2.toFixed(1)}`)
    assert.ok(r.harmonicCount >= 5, `expected rich harmonics, got ${r.harmonicCount}`)
  })

  it('sawtooth H1-H4 are present and monotonically decreasing', () => {
    const mags = magnitudesOf(bandlimitedSawtooth(200))
    const r = extractHarmonics(mags, 200, SR)
    assert.ok(r.h1 != null && r.h2 != null && r.h3 != null && r.h4 != null)
    assert.ok(r.h1 > r.h2 && r.h2 > r.h3 && r.h3 > r.h4)
  })

  it('computes SHR only when f0/2 is above 50Hz floor', () => {
    const mags = magnitudesOf(makeSignal([200], [1]))
    const high = extractHarmonics(mags, 200, SR)
    assert.ok(high.shr != null, 'f0/2=100Hz should compute shr')
    assert.ok(high.shr < 0.3, `clean sine should have near-zero shr, got ${high.shr}`)

    const low = extractHarmonics(mags, 80, SR)
    assert.equal(low.shr, null, 'f0/2=40Hz below floor should be null')
  })

  it('does not mistake the fundamental for the subharmonic at low f0', () => {
    // f0=124Hz → H1 at bin ~16; f0/2=62Hz → bin ~8 with noise floor -60dB.
    // A wide search window around f0/2 would catch H1 (bin 16) and inflate shr≈1.0.
    const mags = spectrumWith({ 8: -60, 16: 0, 32: -30 })
    const r = extractHarmonics(mags, 124, SR)
    assert.ok(r.shr != null, 'f0/2=62Hz above floor should compute shr')
    assert.ok(r.shr < 0.1, `subharmonic energy must be tiny, got ${r.shr}`)
  })
})
