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
})
