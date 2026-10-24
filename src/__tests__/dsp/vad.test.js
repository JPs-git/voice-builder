import { describe, it } from 'vitest'
import assert from 'node:assert/strict'
import { VoiceActivityDetector, DEFAULT_VAD_THRESHOLD, DEFAULT_VAD_OPTIONS } from '../../dsp/vad'

describe('VoiceActivityDetector', () => {
  it('returns voiced=false for silence (all zeros)', () => {
    const vad = new VoiceActivityDetector({ threshold: 0.008 })
    const samples = new Float32Array(400)
    const result = vad.compute(samples)
    assert.equal(result.voiced, false)
    assert.equal(result.rms, 0)
  })

  it('returns voiced=false for low amplitude below threshold', () => {
    const vad = new VoiceActivityDetector({ threshold: 0.1 })
    const samples = new Float32Array(400)
    for (let i = 0; i < 400; i++) samples[i] = 0.05
    const result = vad.compute(samples)
    assert.equal(result.voiced, false)
  })

  it('returns voiced=true for amplitude at threshold', () => {
    const vad = new VoiceActivityDetector({ threshold: 0.1 })
    const samples = new Float32Array(400)
    for (let i = 0; i < 400; i++) samples[i] = 0.1
    const result = vad.compute(samples)
    assert.equal(result.voiced, true)
    assert.ok(Math.abs(result.rms - 0.1) < 0.001)
  })

  it('returns voiced=true for amplitude above threshold', () => {
    const vad = new VoiceActivityDetector({ threshold: 0.008 })
    const samples = new Float32Array(400)
    for (let i = 0; i < 400; i++) samples[i] = Math.sin(2 * Math.PI * 200 * i / 16000)
    const result = vad.compute(samples)
    assert.equal(result.voiced, true)
    assert.ok(result.rms > 0.008)
  })

  it('uses the selected shared default threshold', () => {
    const vad = new VoiceActivityDetector()
    assert.equal(vad._threshold, DEFAULT_VAD_THRESHOLD)
    assert.deepEqual(DEFAULT_VAD_OPTIONS, { threshold: 0.01, releaseThreshold: 0.01, holdMs: 0 })
  })

  it('accepts custom threshold', () => {
    const vad = new VoiceActivityDetector({ threshold: 0.05 })
    assert.equal(vad._threshold, 0.05)
  })

  it('compute() is stateless — same input returns same output', () => {
    const vad = new VoiceActivityDetector({ threshold: 0.008 })
    const samples = new Float32Array(400)
    for (let i = 0; i < 400; i++) samples[i] = 0.05
    const r1 = vad.compute(samples)
    const r2 = vad.compute(samples)
    assert.equal(r1.voiced, r2.voiced)
    assert.equal(r1.rms, r2.rms)
  })
})


describe('default gate compromise', () => {
  it('closes below the opening threshold without hysteresis or hold', () => {
    const vad = new VoiceActivityDetector()
    const level = rms => new Float32Array(800).fill(rms)
    assert.equal(vad.compute(level(0.009)).voiced, false)
    assert.equal(vad.compute(level(0.011)).voiced, true)
    assert.equal(vad.compute(level(0.009)).voiced, false)
    assert.equal(vad.compute(level(0.02), 10, false).voiced, false)
    assert.equal(vad.compute(level(0.011)).voiced, true)
    vad.reset()
    assert.equal(vad.compute(level(0.009)).voiced, false)
  })
})
