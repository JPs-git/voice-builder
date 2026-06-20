import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { FrameProcessor } from '../frame-processor.js'

describe('FrameProcessor', () => {
  it('extracts frames with correct size and hop', () => {
    const sampleRate = 16000
    const frameSize = 400
    const hopSize = 160
    const fp = new FrameProcessor({ sampleRate, frameSize, hopSize })
    const frames = []
    fp.onFrame = (frame) => frames.push(frame)

    // Push 2 seconds of audio (32000 samples)
    const duration = 2
    const totalSamples = sampleRate * duration
    const input = new Float32Array(totalSamples)
    for (let i = 0; i < totalSamples; i++) {
      input[i] = Math.sin(2 * Math.PI * 200 * i / sampleRate)
    }
    fp.push(input)

    const expectedFrames = Math.floor((totalSamples - frameSize) / hopSize) + 1
    assert.equal(frames.length, expectedFrames)

    for (const f of frames) {
      assert.equal(f.samples.length, frameSize)
    }
  })

  it('first frame starts at sample 0', () => {
    const fp = new FrameProcessor({ sampleRate: 16000, frameSize: 400, hopSize: 160 })
    const frames = []
    fp.onFrame = (frame) => frames.push(frame)

    const input = new Float32Array(16000)
    for (let i = 0; i < input.length; i++) {
      input[i] = Math.sin(2 * Math.PI * 200 * i / 16000)
    }
    fp.push(input)

    assert.equal(frames.length, Math.floor((16000 - 400) / 160) + 1)
    assert.equal(frames[0].time, 0 / 16000)
    assert.equal(frames[1].time, 160 / 16000)
  })

  it('accumulates across multiple push() calls', () => {
    const fp = new FrameProcessor({ sampleRate: 16000, frameSize: 400, hopSize: 160 })
    const frames = []
    fp.onFrame = (frame) => frames.push(frame)

    fp.push(new Float32Array(200))  // less than a frame
    assert.equal(frames.length, 0)

    fp.push(new Float32Array(400))  // should produce at least 1 frame
    assert.ok(frames.length >= 1)
    assert.equal(frames[0].samples.length, 400)
  })

  it('handles empty input', () => {
    const fp = new FrameProcessor({ sampleRate: 16000, frameSize: 400, hopSize: 160 })
    const frames = []
    fp.onFrame = (frame) => frames.push(frame)
    fp.push(new Float32Array(0))
    assert.equal(frames.length, 0)
  })

  it('returns correct frame count for known input length', () => {
    const fp = new FrameProcessor({ sampleRate: 16000, frameSize: 400, hopSize: 160 })
    const frames = []
    fp.onFrame = (frame) => frames.push(frame)

    fp.push(new Float32Array(400))  // exactly one frame
    assert.equal(frames.length, 1)

    fp.push(new Float32Array(160))  // one hop more
    assert.equal(frames.length, 2)
  })
})
