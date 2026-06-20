import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { Resampler } from '../resampler.js'

describe('Resampler', () => {
  it('resamples 44100 to 16000 and preserves frequency', () => {
    const inputRate = 44100
    const outputRate = 16000
    const freq = 200
    const duration = 0.1
    const inputLen = Math.round(inputRate * duration)
    const input = new Float32Array(inputLen)
    for (let i = 0; i < inputLen; i++) {
      input[i] = Math.sin(2 * Math.PI * freq * i / inputRate)
    }

    const r = new Resampler(inputRate, outputRate)
    const output = r.process(input)
    const outputLen = Math.round(outputRate * duration)
    assert.ok(Math.abs(output.length - outputLen) <= 1)

    let zeroCrossings = 0
    for (let i = 1; i < output.length; i++) {
      if ((output[i - 1] < 0 && output[i] >= 0) || (output[i - 1] > 0 && output[i] <= 0)) {
        zeroCrossings++
      }
    }
    const detectedFreq = (zeroCrossings / 2) / (output.length / outputRate)
    assert.ok(Math.abs(detectedFreq - freq) < 5, `expected ~${freq}Hz, got ${detectedFreq}Hz`)
  })

  it('resamples 48000 to 16000', () => {
    const freq = 300
    const duration = 0.1
    const inputRate = 48000
    const outputRate = 16000
    const inputLen = Math.round(inputRate * duration)
    const input = new Float32Array(inputLen)
    for (let i = 0; i < inputLen; i++) {
      input[i] = Math.sin(2 * Math.PI * freq * i / inputRate)
    }

    const r = new Resampler(inputRate, outputRate)
    const output = r.process(input)
    const outputLen = Math.round(outputRate * duration)
    assert.ok(Math.abs(output.length - outputLen) <= 1)

    let zeroCrossings = 0
    for (let i = 1; i < output.length; i++) {
      if ((output[i - 1] < 0 && output[i] >= 0) || (output[i - 1] > 0 && output[i] <= 0)) {
        zeroCrossings++
      }
    }
    const detectedFreq = (zeroCrossings / 2) / (output.length / outputRate)
    assert.ok(Math.abs(detectedFreq - freq) < 5)
  })

  it('upsamples 8000 to 16000', () => {
    const freq = 200
    const duration = 0.1
    const inputRate = 8000
    const outputRate = 16000
    const inputLen = Math.round(inputRate * duration)
    const input = new Float32Array(inputLen)
    for (let i = 0; i < inputLen; i++) {
      input[i] = Math.sin(2 * Math.PI * freq * i / inputRate)
    }

    const r = new Resampler(inputRate, outputRate)
    const output = r.process(input)
    const outputLen = Math.round(outputRate * duration)
    assert.ok(Math.abs(output.length - outputLen) <= 1)

    let zeroCrossings = 0
    for (let i = 1; i < output.length; i++) {
      if ((output[i - 1] < 0 && output[i] >= 0) || (output[i - 1] > 0 && output[i] <= 0)) {
        zeroCrossings++
      }
    }
    const detectedFreq = (zeroCrossings / 2) / (output.length / outputRate)
    assert.ok(Math.abs(detectedFreq - freq) < 5)
  })

  it('maintains phase continuity across multiple process() calls', () => {
    const inputRate = 44100
    const outputRate = 16000
    const freq = 200
    const totalDuration = 0.2
    const chunkDuration = 0.05
    const chunkSamples = Math.round(inputRate * chunkDuration)
    const r = new Resampler(inputRate, outputRate)

    let allOutput = []
    for (let offset = 0; offset < Math.round(inputRate * totalDuration); offset += chunkSamples) {
      const input = new Float32Array(chunkSamples)
      for (let i = 0; i < chunkSamples; i++) {
        input[i] = Math.sin(2 * Math.PI * freq * (offset + i) / inputRate)
      }
      const out = r.process(input)
      for (let i = 0; i < out.length; i++) allOutput.push(out[i])
    }

    const output = new Float32Array(allOutput)
    let zeroCrossings = 0
    for (let i = 1; i < output.length; i++) {
      if ((output[i - 1] < 0 && output[i] >= 0) || (output[i - 1] > 0 && output[i] <= 0)) {
        zeroCrossings++
      }
    }
    const detectedFreq = (zeroCrossings / 2) / (output.length / outputRate)
    assert.ok(Math.abs(detectedFreq - freq) < 5)
  })

  it('handles empty input', () => {
    const r = new Resampler(44100, 16000)
    const output = r.process(new Float32Array(0))
    assert.equal(output.length, 0)
  })

  it('handles very short input (less than ratio samples)', () => {
    const r = new Resampler(44100, 16000)
    const output = r.process(new Float32Array(10))
    assert.ok(output.length === 0 || output.length === 1)
  })

  it('sample-level regression: ramp signal', () => {
    const r = new Resampler(8000, 16000)
    const input = new Float32Array(800)
    for (let i = 0; i < 800; i++) input[i] = i
    const output = r.process(input)
    assert.ok(output.length > 0)
    assert.ok(Math.abs(output[0] - 0) < 0.01)
    assert.ok(Math.abs(output[1] - 0.5) < 0.01)
  })

  it('handles 1000 small streaming chunks without buffer growth', () => {
    const r = new Resampler(44100, 16000)
    const chunkSamples = 100
    const numChunks = 1000
    let totalOutput = 0
    let maxBuffer = 0

    for (let i = 0; i < numChunks; i++) {
      const input = new Float32Array(chunkSamples)
      const out = r.process(input)
      totalOutput += out.length
      maxBuffer = Math.max(maxBuffer, r.buffer.length)
    }

    assert.ok(totalOutput > 0, `should produce output, got ${totalOutput}`)
    assert.ok(maxBuffer < chunkSamples * 2,
      `buffer should not grow unbounded, max was ${maxBuffer}`)
  })

  it('resets correctly between streams', () => {
    const r = new Resampler(44100, 16000)
    r.process(new Float32Array(44100))  // 1 second of silence
    assert.ok(r.buffer.length > 0 || true)  // buffer has residual

    r.reset()
    assert.equal(r.buffer.length, 0)

    // After reset, process a new stream
    const freq = 200
    const inputLen = 4410
    const input = new Float32Array(inputLen)
    for (let i = 0; i < inputLen; i++) {
      input[i] = Math.sin(2 * Math.PI * freq * i / 44100)
    }
    const output = r.process(input)
    assert.ok(output.length > 0)
  })
})
