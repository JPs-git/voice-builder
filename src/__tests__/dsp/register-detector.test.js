import { describe, it } from 'vitest'
import assert from 'node:assert/strict'
import { RegisterDetector } from '../../dsp/register-detector'
import { fftMagnitudes } from '../../dsp/fft'

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

function chestFrame() {
  return { f0: 200, voiced: true, magnitudes: magnitudesOf(bandlimitedSawtooth(200)), sampleRate: SR }
}

function falsettoFrame() {
  return { f0: 200, voiced: true, magnitudes: magnitudesOf(makeSignal([200], [1])), sampleRate: SR }
}

// Hand-built spectrum for a controllable h1h2. bin = freq * 2048 / 16000.
// f0=250Hz → bin 32, h2=500Hz → bin 64, h3=750Hz → bin 96, f0/2=125Hz → bin 16.
function spectrumWith(levels) {
  const mags = new Float32Array(1025).fill(-80)
  for (const [bin, db] of Object.entries(levels)) {
    mags[Number(bin)] = db
  }
  return mags
}

describe('RegisterDetector', () => {
  it('classifies pure sine as falsetto', () => {
    const det = new RegisterDetector()
    const r = det.push(falsettoFrame())
    assert.equal(r.register, 'falsetto')
    assert.ok(r.h1h2 != null && r.h1h2 > 10, `expected large h1h2, got ${r.h1h2}`)
  })

  it('classifies bandlimited sawtooth as chest', () => {
    const det = new RegisterDetector()
    const r = det.push(chestFrame())
    assert.equal(r.register, 'chest')
  })

  it('classifies unvoiced frame as unvoiced', () => {
    const det = new RegisterDetector()
    const r = det.push({ f0: null, voiced: false, magnitudes: new Float32Array(1025), sampleRate: SR })
    assert.equal(r.register, 'unvoiced')
    assert.equal(r.h1h2, null)
    assert.equal(r.confidence, 0)
  })

  it('returns unvoiced when f0 missing even if voiced=true', () => {
    const det = new RegisterDetector()
    const r = det.push({ f0: null, voiced: true, magnitudes: new Float32Array(1025), sampleRate: SR })
    assert.equal(r.register, 'unvoiced')
  })

  it('classifies intermediate h1h2 as mixed', () => {
    // h1h2 = 6dB (mixed region), harmonicCount = 2, no subharmonic energy
    const mags = spectrumWith({ 32: 0, 64: -6, 96: -8 })
    const det = new RegisterDetector()
    const r = det.push({ f0: 250, voiced: true, magnitudes: mags, sampleRate: SR })
    assert.equal(r.register, 'mixed')
  })

  it('smooths h1h2 across frames so a single falsetto spike does not flip chest', () => {
    const det = new RegisterDetector({ window: 5 })
    for (let i = 0; i < 5; i++) det.push(chestFrame())
    const spike = det.push(falsettoFrame())
    assert.equal(spike.register, 'chest', 'single spike should be damped by median')
  })

  it('converges to falsetto after sustained falsetto frames', () => {
    const det = new RegisterDetector({ window: 5 })
    for (let i = 0; i < 5; i++) det.push(chestFrame())
    let r = { register: '' }
    for (let i = 0; i < 8; i++) r = det.push(falsettoFrame())
    assert.equal(r.register, 'falsetto')
  })

  it('reset() clears smoothing state', () => {
    const det = new RegisterDetector({ window: 5 })
    for (let i = 0; i < 5; i++) det.push(chestFrame())
    det.reset()
    const r = det.push(falsettoFrame())
    assert.equal(r.register, 'falsetto')
  })

  it('confidence is high at a clear chest extreme', () => {
    // h1h2 = 3dB, 7 strong harmonics → unambiguous chest
    const mags = spectrumWith({ 32: 0, 64: -3, 96: -3, 128: -3, 160: -3, 192: -3, 224: -3, 256: -3 })
    const det = new RegisterDetector()
    const r = det.push({ f0: 250, voiced: true, magnitudes: mags, sampleRate: SR })
    assert.equal(r.register, 'chest')
    assert.ok(r.confidence > 0.5, `chest should be confident, got ${r.confidence}`)
  })
})
