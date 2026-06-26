import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { AnalysisPipeline } from '../analysis-pipeline.js'

describe('AnalysisPipeline', () => {
  it('static analyze() produces frames with correct structure', () => {
    const sampleRate = 16000
    const duration = 0.5
    const numSamples = Math.round(sampleRate * duration)
    const samples = new Float32Array(numSamples)
    for (let i = 0; i < numSamples; i++) {
      samples[i] = Math.sin(2 * Math.PI * 200 * i / sampleRate)
    }

    const frames = AnalysisPipeline.analyze(samples, sampleRate)

    assert.ok(frames.length > 0, 'should produce at least one frame')
    for (const f of frames) {
      assert.ok(typeof f.f0 === 'number' || f.f0 === null, 'f0 should be number or null')
      assert.ok(typeof f.time === 'number')
      assert.ok(f.magnitudes instanceof Float32Array)
      assert.equal(f.magnitudes.length, 1025, 'should have 1025 FFT bins (2048/2+1)')
      // f1-f4 should exist (may be null for simple sine)
      assert.ok('f1' in f)
      assert.ok('f2' in f)
      assert.ok('f3' in f)
      assert.ok('f4' in f)
    }
  })

  it('static analyze() detects F0 for 200Hz sine', () => {
    const sampleRate = 16000
    const duration = 0.2
    const numSamples = Math.round(sampleRate * duration)
    const samples = new Float32Array(numSamples)
    for (let i = 0; i < numSamples; i++) {
      samples[i] = Math.sin(2 * Math.PI * 200 * i / sampleRate)
    }

    const frames = AnalysisPipeline.analyze(samples, sampleRate)
    const voiced = frames.filter(f => f.voiced)
    assert.ok(voiced.length > 0, 'should have voiced frames')

    const avgF0 = voiced.reduce((s, f) => s + f.f0, 0) / voiced.length
    assert.ok(Math.abs(avgF0 - 200) < 20, `expected ~200Hz, got ${avgF0.toFixed(1)}Hz`)
  })

  it('times increment by ~0.01s per frame', () => {
    const sampleRate = 16000
    const duration = 0.3
    const numSamples = Math.round(sampleRate * duration)
    const samples = new Float32Array(numSamples)
    for (let i = 0; i < numSamples; i++) {
      samples[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate)
    }

    const frames = AnalysisPipeline.analyze(samples, sampleRate)
    assert.ok(frames.length >= 2)

    for (let i = 1; i < frames.length; i++) {
      const dt = frames[i].time - frames[i - 1].time
      assert.ok(Math.abs(dt - 0.01) < 0.001, `expected 0.01s step, got ${dt}s at frame ${i}`)
    }
  })

  it('pushChunk + flush produces frames incrementally', () => {
    const sampleRate = 16000
    const numSamples = 2000
    const samples = new Float32Array(numSamples)
    for (let i = 0; i < numSamples; i++) {
      samples[i] = Math.sin(2 * Math.PI * 200 * i / sampleRate)
    }

    const frames = []
    const pipeline = new AnalysisPipeline({
      onFrame: (f) => frames.push(f),
    })

    // Push in chunks
    pipeline.pushChunk(samples.slice(0, 800), sampleRate)
    const countAfterFirst = frames.length
    assert.ok(countAfterFirst > 0, 'should produce frames after first chunk')

    pipeline.pushChunk(samples.slice(800), sampleRate)
    pipeline.flush()

    assert.ok(frames.length > countAfterFirst, 'should produce more frames after second chunk + flush')
  })

  it('reset clears pipeline state between streams', () => {
    const samples = new Float32Array(2000)
    for (let i = 0; i < 2000; i++) {
      samples[i] = Math.sin(2 * Math.PI * 200 * i / 44100)
    }

    const frames1 = []
    const pipeline = new AnalysisPipeline({ onFrame: (f) => frames1.push(f) })
    pipeline.pushChunk(samples, 44100)
    pipeline.flush()
    assert.ok(frames1.length > 0, 'first run should produce frames')

    pipeline.reset()

    const frames2 = []
    pipeline.onFrame = (f) => frames2.push(f)
    pipeline.pushChunk(samples, 44100)
    pipeline.flush()
    assert.ok(frames2.length > 0, 'second run should produce frames')
    assert.equal(frames2.length, frames1.length, 'both runs should produce same frame count')
  })

  it('handles empty input gracefully', () => {
    const frames = AnalysisPipeline.analyze(new Float32Array(0), 16000)
    assert.equal(frames.length, 0)
  })
})
